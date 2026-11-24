"""Prepara i dati statici della preview a partire dall'esportazione della webapp di progetto (v2/webapp/dati).

Si lancia dalla cartella `preview/` con l'ambiente del progetto di lavoro:
    ..\\.venv\\Scripts\\python.exe scripts\\prepara_dati.py <meta.json di /api/meta>

Non ricalcola il modello: copia, riduce e trasforma file già esportati. Derivazioni fatte qui:
- densità delle aree = residenti / ettari di tutta l'area (poligono in EPSG:25832), come `esporta_strati.py`
  (WA11-dati, 24/11/2026); classi = quintili non pesati sulle 90 aree (scelta dell'utente);
- confine del comune = unione delle 90 aree statistiche; maschera = il resto del riquadro;
- immagini dell'ombra colorate (la quota d'ombra resta quella del PNG in grigi: grigio = 255 × quota);
- nomi con le maiuscole solo dove servono [conv. della preview].
Il manifesto (origine, versione della run, SHA256) va in `scripts/manifest_dati.json`: è per noi, non è una pagina
del sito.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from datetime import datetime
from pathlib import Path

import geopandas as gpd
import pyarrow.dataset as ds
from shapely.geometry import Point
import numpy as np
import pandas as pd
from PIL import Image
from shapely import transform
from shapely.geometry import Polygon, mapping
from shapely.ops import unary_union

QUI = Path(__file__).resolve().parents[1]
CSI = QUI.parent
SRC = CSI / "v2" / "webapp" / "dati"
COPPIE = CSI / "v2" / "run_completa_v2" / "mezzi" / "grandi" / "coppie_q.parquet"
IMPRONTE = CSI / "v2" / "run_completa_v2" / "grandi" / "origini_impronte.gpkg"
OUT = QUI / "public" / "dati"
MANIFESTO = QUI / "scripts" / "manifest_dati.json"
CRS_MISURA = "EPSG:25832"
TOLLERANZA_M = 1.0          # come l'esportazione degli edifici della webapp (edifici.json: tolleranza_m = 1.0)


def leggi_json(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def scrivi_json(p: Path, o) -> None:
    p.write_text(json.dumps(o, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def arrotonda_geom(g, cifre=6):
    # solo arrotondamento delle coordinate (circa 0,1 m a 6 cifre), senza ricostruire la topologia
    return transform(g, lambda c: np.round(c, cifre))


# ------------------------------------------------------------------------------------------------ nomi leggibili
MINUSCOLE = {"di", "del", "della", "dei", "degli", "delle", "dello", "da", "dal", "dalla", "e", "ed", "in", "al",
             "alla", "ai", "agli", "allo", "sul", "sulla", "la", "il", "lo", "le", "gli", "a", "per", "con", "tra",
             "fra", "nel", "nella", "ex"}
ELISIONI = ("dell'", "dall'", "all'", "nell'", "sull'", "d'", "l'", "un'")
SIGLE = {"CAAB", "CNR", "PEEP", "ITIS", "IACP", "ACER", "FS", "INA", "ENEL", "CEP", "AUSL", "ASL", "CAI", "ARCI",
         "UISP", "URP", "RSA", "IPSIA", "ATC"}
ABBREVIAZIONI = {"P.CO": "Parco", "G.NO": "Giardino", "GIARD.": "Giardino", "V.": "Via", "P.ZA": "Piazza",
                 "P.ZZA": "Piazza", "P.E.E.P.": "PEEP"}
ROMANI = re.compile(r"^(X{0,3})(IX|IV|V?I{0,3})$")
ACCENTI = {"a'": "à", "e'": "è", "i'": "ì", "o'": "ò", "u'": "ù"}


def _maiuscola_dopo(s: str) -> str:
    # maiuscola all'inizio e dopo «-», «(», «.», «/», «'» (Sant'Orsola)
    return re.sub(r"(^|[-(./'])([a-zà-ù])", lambda m: m.group(1) + m.group(2).upper(), s)


def _parola(w: str, prima: bool) -> str:
    testa = re.match(r"^[(\"]*", w).group(0)                     # parentesi o virgolette davanti
    corpo = w[len(testa):]
    nudo = re.sub(r"[^\w]", "", corpo).upper()
    if corpo.upper() in ABBREVIAZIONI:
        return testa + ABBREVIAZIONI[corpo.upper()]
    if nudo in SIGLE or (nudo and ROMANI.match(nudo)):
        return testa + corpo.upper()
    low = corpo.lower()
    for k, v in ACCENTI.items():
        if low.endswith(k):
            low = low[:-2] + v
    if not prima and "." not in low and re.sub(r"[^\w]", "", low) in MINUSCOLE:
        return testa + low
    for e in ELISIONI:
        if low.startswith(e) and len(low) > len(e):
            el = e if not prima else e[:1].upper() + e[1:]
            return testa + el + _maiuscola_dopo(low[len(e):])
    return testa + _maiuscola_dopo(low)


def nome_leggibile(s: str | None) -> str | None:
    if not s:
        return s
    s = re.sub(r"\s+", " ", str(s).strip())
    parole = s.split(" ")
    # «prima» anche dopo «·» o un trattino isolato (Z16 · La Birra, Lungoreno Fabbri - Triumvirato)
    return " ".join(_parola(w, i == 0 or parole[i - 1] in ("·", "-", "–")) for i, w in enumerate(parole))


def quintili(v: np.ndarray) -> list[float]:
    v = v[np.isfinite(v)]
    return [float(np.quantile(v, q)) for q in (0.2, 0.4, 0.6, 0.8)]


def main() -> int:
    if len(sys.argv) < 2:
        print("uso: prepara_dati.py <meta.json di /api/meta>")
        return 1
    OUT.mkdir(parents=True, exist_ok=True)
    man_src = leggi_json(SRC / "manifest.json")
    meta = leggi_json(Path(sys.argv[1]))
    if meta["versione_run"] != man_src["versione_run"]:
        print("meta e manifest di versioni diverse:", meta["versione_run"], man_src["versione_run"])
        return 1
    num = meta["numeri"]
    file_scritti: dict[str, dict] = {}
    (OUT / "manifest.json").unlink(missing_ok=True)          # il manifesto non sta più fra i file del sito

    def registra(nome: str, origine: str):
        p = OUT / nome
        file_scritti[nome] = {"origine": origine, "byte": p.stat().st_size,
                              "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}

    def scrivi_gdf(g: gpd.GeoDataFrame, nome: str, origine: str):
        (OUT / nome).write_text(g.to_json(drop_id=True, ensure_ascii=False), encoding="utf-8")
        registra(nome, origine)

    # ---------------------------------------------------------------- aree statistiche: densità e confine
    a = gpd.read_file(SRC / "aree.geojson")
    a25 = a.to_crs(CRS_MISURA)
    ettari = a25.geometry.area.to_numpy() / 1e4
    a["ettari"] = np.round(ettari, 2)
    a["densita"] = np.round(a["residenti"].to_numpy(float) / ettari, 2)
    somma_res = float(a["residenti"].sum())
    a["residenti"] = np.round(a["residenti"].astype(float)).astype(int)
    aa = a[["codice", "area", "quartiere", "residenti", "ettari", "densita", "geometry"]].copy()
    aa["area"] = aa["area"].map(nome_leggibile)
    aa["geometry"] = aa.geometry.map(arrotonda_geom)
    scrivi_gdf(aa, "aree.geojson", "v2/webapp/dati/aree.geojson; ettari e densità calcolati qui (EPSG:25832)")

    confine25 = unary_union(list(a25.geometry.buffer(1.0))).buffer(-1.0).simplify(5.0)
    confine = gpd.GeoSeries([confine25], crs=CRS_MISURA).to_crs("EPSG:4326").iloc[0]
    parti = list(confine.geoms) if confine.geom_type == "MultiPolygon" else [confine]
    mondo = [(10.6, 44.0), (12.1, 44.0), (12.1, 45.0), (10.6, 45.0)]
    maschera = Polygon(mondo, [list(p.exterior.coords) for p in parti])
    gc = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {"tipo": "confine"}, "geometry": mapping(arrotonda_geom(confine, 6))},
        {"type": "Feature", "properties": {"tipo": "fuori"}, "geometry": mapping(arrotonda_geom(maschera, 6))}]}
    scrivi_json(OUT / "confine.geojson", gc)
    registra("confine.geojson", "unione delle 90 aree statistiche (v2/webapp/dati/aree.geojson), semplificata a 5 m")
    riquadro = [round(float(x), 5) for x in a.total_bounds]

    # ---------------------------------------------------------------- fragilità per sezione di censimento
    # e densità di residenti per sezione (residenti Istat della sezione / superficie della sezione in ettari)
    s = gpd.read_file(SRC / "sezioni.geojson")
    res_s = s["residenti"].fillna(0).to_numpy(float)
    ha_s = s.to_crs(CRS_MISURA).geometry.area.to_numpy() / 1e4
    dens_s = np.where(res_s > 0, res_s / ha_s, np.nan)
    ss = gpd.GeoDataFrame({
        "a": (res_s > 0).astype(int),
        "v": [round(float(x), 3) if pd.notna(x) else None for x in s["V"]],
        "d": [round(float(x), 1) if np.isfinite(x) else None for x in dens_s],
        "r": [int(round(x)) if x > 0 else None for x in res_s],
    }, geometry=s.geometry.map(arrotonda_geom).values, crs=s.crs)
    scrivi_gdf(ss, "sezioni.geojson", "v2/webapp/dati/sezioni.geojson: V (fragilità), abitata sì/no, residenti e "
               "densità (residenti / ettari della sezione, EPSG:25832)")
    # quintili della densità pesati per residenti: ogni colore riunisce un quinto dei residenti (come la fragilità)
    ok_s = res_s > 0
    o_d = dens_s[ok_s]; w_d = res_s[ok_s]; i_d = np.argsort(o_d); c_d = np.cumsum(w_d[i_d]) / w_d.sum()
    q_dens = [round(float(o_d[i_d][np.searchsorted(c_d, q)]), 1) for q in (0.2, 0.4, 0.6, 0.8)]
    print("quintili densità per sezione", q_dens)

    # ---------------------------------------------------------------- parchi
    p = gpd.read_file(SRC / "parchi.geojson")
    rif = leggi_json(SRC / "rifugi.json")
    rango = {c["park_id"]: c["rango"] for c in rif["classifica"]}
    # valore come rifugio (rifugi.json, regola V2-30): ombra e sedute, con acqua e bagni dentro le due offerte
    valore = {c["park_id"]: c["valore"] for c in rif["classifica"]}
    pp = p[["park_id", "nome", "area_ha", "offerta_ombra_m2", "O_omega1", "offerta_sedute", "n_sedute", "n_fontanelle", "n_bagni",
            "geometry"]].copy()
    pp["nome"] = pp["nome"].map(nome_leggibile)
    pp["rango"] = pp["park_id"].map(rango).astype("Int64")
    pp["valore"] = pp["park_id"].map(valore).astype(float).round(4)
    for c, k in (("area_ha", 2), ("offerta_ombra_m2", 0), ("O_omega1", 3), ("offerta_sedute", 0)):
        pp[c] = pp[c].astype(float).round(k)
    pp["geometry"] = pp.geometry.map(arrotonda_geom)
    scrivi_gdf(pp, "parchi.geojson", "v2/webapp/dati/parchi.geojson + rango da rifugi.json")

    # ---------------------------------------------------------------- i 5 rifugi: schede, oggetti, ombra colorata
    migliori = []
    geo_parchi = p.set_index("park_id").geometry

    def punto_nome(g):
        # un solo nome per parco: punto interno della parte più grande (le multiparti ripetevano il nome)
        if g.geom_type == "MultiPolygon":
            g = max(g.geoms, key=lambda x: x.area)
        q_ = g.representative_point()
        return [round(q_.x, 6), round(q_.y, 6)]

    for m in rif["migliori"]:
        img = m["immagine_ombra"]
        g = np.asarray(Image.open(SRC / img["file"]).convert("LA"))
        quota = g[..., 0].astype(float) / 255.0
        alfa_in = g[..., 1] > 0
        # sole → ombra: giallo pallido, verde medio, verde scuro [conv. della preview]
        stop = np.array([[255, 233, 160], [127, 179, 107], [15, 81, 50]], float)
        t = np.clip(quota, 0, 1) * 2
        i0 = np.minimum(t.astype(int), 1)
        f = (t - i0)[..., None]
        rgb = stop[i0] * (1 - f) + stop[i0 + 1] * f
        out = np.dstack([rgb.round().astype(np.uint8), np.where(alfa_in, 235, 0).astype(np.uint8)])
        nome_png = f"ombra_{m['park_id']}.png"
        Image.fromarray(out, mode="RGBA").save(OUT / nome_png, optimize=True)
        registra(nome_png, f"v2/webapp/dati/{img['file']} (quota d'ombra 12–15, giu–ago 2025, 0,5 m), colorata qui")
        migliori.append({
            "rango": m["rango"], "park_id": m["park_id"], "nome": nome_leggibile(m["nome"]),
            "area_ha": round(m["area_ha"], 2), "quota_ombra": round(m["O_omega1"], 3),
            "posti": m["sedute_contate"], "posti_ombra": m["sedute_contate_all_ombra_fisica"],
            "fontanelle": m["n_fontanelle"], "bagni": m["n_bagni"],
            "immagine": nome_png, "angoli": img["angoli_lonlat"], "etichetta": punto_nome(geo_parchi[m["park_id"]]),
        })
    o = gpd.read_file(SRC / "rifugi_oggetti.geojson")
    o = o[o["contato"].astype(bool)][["park_id", "tipo", "all_ombra", "geometry"]].copy()
    o["tipo"] = o["tipo"].replace({"tavolo_picnic": "tavolo"})
    # all'ombra: 1 / 0, vuoto per fontanelle e bagni (geopandas lo leggerebbe come 1.0 / 0.0)
    o["all_ombra"] = [None if v is None or pd.isna(v) else int(bool(v)) for v in o["all_ombra"].astype(object)]
    o["geometry"] = o.geometry.map(arrotonda_geom)
    scrivi_gdf(o, "rifugi_oggetti.geojson", "v2/webapp/dati/rifugi_oggetti.geojson, solo oggetti contati nel calcolo")

    # ---------------------------------------------------------------- zone
    z = gpd.read_file(SRC / "zone.geojson")
    zz = z[["zona", "nome", "residenti", "critici", "quota_critici", "prioritaria", "dipende_dal_confine",
            "geometry"]].copy()
    zz["nome"] = zz["nome"].map(nome_leggibile)
    zz["residenti"] = zz["residenti"].round().astype(int)
    zz["critici"] = zz["critici"].round().astype(int)
    zz["quota_critici"] = zz["quota_critici"].round(3)
    # V2-47: 1 = la zona perde più di metà dei critici con i parchi oltre il confine stimati; null (zona assente
    # dalla sensibilità del confine) si scrive 0, cioè nessuna etichetta, come nella webapp
    zz["dipende_dal_confine"] = (z["dipende_dal_confine"] == 1).astype(int)
    zz["prioritaria"] = zz["prioritaria"].astype(bool).astype(int)
    zz["geometry"] = zz.geometry.map(arrotonda_geom)
    scrivi_gdf(zz, "zone.geojson", "v2/webapp/dati/zone.geojson")

    # ---------------------------------------------------------------- edifici: minuti, U, critico (niente residenti)
    e = pd.read_parquet(SRC / "edifici.parquet",
                        columns=["codice_ogg", "SEZ21_ID", "pop", "t_piedi", "t_bici", "t_bus", "t_auto", "U", "critico",
                                 "causa", "P_E", "P_V", "P_1_meno_Serv"])
    # minuti per mezzo fino al più vicino dei parchi di almeno 0,5 ha (la soglia «grande» del modello, la stessa di
    # t_piedi_grande: manifest dei dati della webapp, «grande» = area ≥ soglia_ha), dai tempi delle coppie
    # edificio-parco del modello (I_piedi…I_auto, minuti equivalenti); senza coppia = oltre il bacino, oltre 30 minuti
    SOGLIA_GRANDE_HA = 0.5
    parchi_g = set(pp.loc[pp["area_ha"] >= SOGLIA_GRANDE_HA, "park_id"])
    cq = ds.dataset(COPPIE).to_table(columns=["codice_ogg", "park_id", "I_piedi", "I_bici", "I_bus", "I_auto"]).to_pandas()
    cq["park_id"] = cq["park_id"].astype(str)
    grandi_t = (cq[cq["park_id"].isin(parchi_g)].groupby("codice_ogg")[["I_piedi", "I_bici", "I_bus", "I_auto"]].min()
              .rename(columns={"I_piedi": "h", "I_bici": "hb", "I_bus": "hu", "I_auto": "ha"}))
    del cq
    registra_fonte = f"{len(parchi_g)} parchi di almeno {SOGLIA_GRANDE_HA} ha"
    print(registra_fonte)
    g = gpd.read_file(IMPRONTE)[["codice_ogg", "geometry"]].to_crs(CRS_MISURA)
    g["geometry"] = g.geometry.simplify(TOLLERANZA_M, preserve_topology=True)
    g = g.to_crs("EPSG:4326").merge(e, on="codice_ogg", how="inner").merge(grandi_t, left_on="codice_ogg", right_index=True,
                                                                          how="left")
    abit = g["pop"].to_numpy(float) > 0
    CAUSE = {"caldo": 0, "fragilita": 1, "servizio": 2, "misto": 3, "nessuna": 4}
    cg = g[abit]
    residenti_cause = {k: float(cg.loc[cg["causa"] == k, "pop"].sum()) for k in CAUSE}
    print("cause, residenti di tutti gli edifici abitati", {k: round(v) for k, v in residenti_cause.items()})

    def minuti(col):
        v = g[col].to_numpy(float)
        return [None if (not ok or not np.isfinite(x)) else round(float(x), 1) for x, ok in zip(v, abit)]

    def quinto(col):
        v = g[col].to_numpy(float)
        return [int(min(np.floor(x * 5), 4)) if ok and np.isfinite(x) else None for x, ok in zip(v, abit)]

    props = pd.DataFrame({
        "a": abit.astype(int),
        "t": minuti("t_piedi"), "tb": minuti("t_bici"), "tu": minuti("t_bus"), "ta": minuti("t_auto"),
        "h": minuti("h"), "hb": minuti("hb"), "hu": minuti("hu"), "ha": minuti("ha"),
        "u": [round(float(x), 3) if ok and np.isfinite(x) else None for x, ok in zip(g["U"].to_numpy(float), abit)],
        "c": [int(x) if ok and pd.notna(x) else None for x, ok in zip(g["critico"], abit)],
        # causa principale della priorità (Shapley di U rispetto all'edificio tipico, V2-40 punto 3, colonna causa)
        "k": [CAUSE.get(x) if ok else None for x, ok in zip(g["causa"], abit)],
        # caldo, fragilità e carenza di parchi come quinto di residenti (P_… sono percentili pesati per residenti)
        "qe": quinto("P_E"), "qv": quinto("P_V"), "qs": quinto("P_1_meno_Serv"),
    })
    ge = gpd.GeoDataFrame(props, geometry=g.geometry.map(arrotonda_geom).values, crs="EPSG:4326")
    scrivi_gdf(ge, "edifici.geojson", "v2/run_completa_v2/grandi/origini_impronte.gpkg (semplificate a 1 m) + "
               "v2/webapp/dati/edifici.parquet (t_piedi…t_auto, U, critico, causa, P_E, P_V e P_1_meno_Serv come quinti; nessun "
               "numero di residenti) + "
               f"run_completa_v2/mezzi/grandi/coppie_q.parquet (minimo di I per mezzo verso i {len(parchi_g)} parchi di "
               f"almeno {SOGLIA_GRANDE_HA} ha)")

    # mediane pesate per residenti dei minuti, per mezzo (oltre il bacino = infinito)
    def mediana(col):
        v = g[col].to_numpy(float); w = g["pop"].to_numpy(float)
        v = np.where(np.isfinite(v), v, np.inf)[abit]; w = w[abit]
        i = np.argsort(v); c = np.cumsum(w[i]) / w.sum()
        x = float(v[i][np.searchsorted(c, 0.5)])
        return round(x, 1) if np.isfinite(x) else None
    mediane = {m: {"tutti": mediana(a_), "grandi": mediana(b_)} for m, a_, b_ in
               (("piedi", "t_piedi", "h"), ("bici", "t_bici", "hb"), ("bus", "t_bus", "hu"), ("auto", "t_auto", "ha"))}
    print("mediane", mediane)

    # ---------------------------------------------------------------- punti: 1 punto = 10 residenti a priorità massima
    # Per ogni sezione: residenti a priorità massima = somma dei residenti degli edifici critici della sezione; i
    # punti (parte intera di x/10, più uno con probabilità uguale al resto) cadono a caso dentro gli edifici critici
    # della sezione, scelti in proporzione all'impronta e non ai residenti: così non si legge il numero di un singolo
    # edificio. Seme fisso, la mappa è riproducibile [conv. della preview].
    PER_PUNTO = 10
    rng = np.random.default_rng(20261124)
    crit = g[(g["critico"].fillna(False).astype(bool).to_numpy()) & abit].to_crs(CRS_MISURA).copy()
    crit["m2"] = crit.area
    punti = []
    for sez, gr in crit.groupby("SEZ21_ID"):
        x = gr["pop"].sum() / PER_PUNTO
        n = int(np.floor(x)) + int(rng.random() < x - np.floor(x))
        if n == 0:
            continue
        pesi = gr["m2"].to_numpy() / gr["m2"].sum()
        geoms = gr.geometry.to_numpy()
        for k in rng.choice(len(gr), size=n, p=pesi):
            poli = geoms[k]
            x0, y0, x1, y1 = poli.bounds
            for _ in range(200):
                pt = Point(rng.uniform(x0, x1), rng.uniform(y0, y1))
                if poli.contains(pt):
                    break
            else:
                pt = poli.representative_point()
            punti.append(pt)
    gp = gpd.GeoDataFrame(geometry=gpd.GeoSeries(punti, crs=CRS_MISURA).to_crs("EPSG:4326").map(arrotonda_geom))
    scrivi_gdf(gp, "punti.geojson", f"edifici critici di edifici.parquet + impronte; 1 punto = {PER_PUNTO} residenti a "
               "priorità massima per sezione, posizione casuale (seme 20261124) dentro gli edifici critici")
    print(f"punti: {len(gp)} (attesi circa {crit['pop'].sum() / PER_PUNTO:.0f})")

    # zone prioritarie per la lista del pannello
    z_pri = []
    for _, rz in z[z["prioritaria"].astype(bool)].sort_values("critici", ascending=False).iterrows():
        b_ = rz.geometry.bounds
        z_pri.append({"zona": int(rz["zona"]), "nome": nome_leggibile(rz["nome"]), "critici": round(float(rz["critici"])),
                      "riquadro": [round(v, 5) for v in b_]})

    # ---------------------------------------------------------------- dati per testi e legende
    L = meta["legende"]
    zone_conf = [int(x) for x in z.loc[z["dipende_dal_confine"] == 1, "zona"]]
    # offerta d'ombra: quintili pesati per superficie del parco, così ogni colore copre un quinto della superficie dei
    # parchi sulla mappa (con i quintili per numero di parchi il 70 % della superficie cade nella classe più alta)
    def quintili_area(col, cifre):
        o_ = pp[col].to_numpy(float); w_ = pp["area_ha"].to_numpy(float)
        i_ = np.argsort(o_); c_ = np.cumsum(w_[i_]) / w_.sum()
        return [round(float(o_[i_][np.searchsorted(c_, q)]), cifre) for q in (0.2, 0.4, 0.6, 0.8)]
    q_off = [int(x) for x in quintili_area("offerta_ombra_m2", 0)]
    # stesso criterio per il valore come rifugio, che è il dato colorato sulla mappa dei parchi
    q_val = quintili_area("valore", 4)
    dati = {
        "riquadro": riquadro,
        "numeri": {
            "residenti": round(num["residenti"]), "pezzi_abitati": num["edifici_con_residenti"],
            "aree": int(len(a)), "sezioni_abitate": int(ss["a"].sum()), "parchi": num["parchi"], "zone": num["zone"],
            "critici": round(num["critici"]), "quota_critici": num["quota_critici"],
            "critici_in_zone": round(num["critici_in_zone"]), "zone_prioritarie": num["zone_prioritarie"],
            "zone_dipende_dal_confine": zone_conf,
            "piedi": {"tutti": num["piedi"]["tutti"]["mediana"], "grande": num["piedi"]["grande"]["mediana"]},
            "mediane": mediane, "parchi_grandi": len(parchi_g), "cause_residenti": residenti_cause,
        },
        "legende": {
            "densita": {"classi": q_dens},
            "offerta_ombra_m2": {"classi": q_off},
            "valore": {"classi": q_val},
            "U": {"classi": L["U"]["classi"], "soglia": num["soglia_U"]},
            "V": {"classi": L["V"]["classi"]},
            "minuti": {"classi": [2, 5, 10, 20]},
        },
        "rifugi": migliori,
        "zone_prioritarie": z_pri,
    }
    scrivi_json(OUT / "dati.json", dati)
    registra("dati.json", "/api/meta della webapp (numeri e legende) + rifugi.json")

    manifest = {
        "creato_il": datetime.now().astimezone().isoformat(timespec="seconds"),
        "comando": r"..\.venv\Scripts\python.exe scripts\prepara_dati.py <meta.json>",
        "script_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "sorgente": {"cartella": "v2/webapp/dati", "versione_run": man_src["versione_run"],
                     "cartella_run": man_src.get("cartella_run"), "esportata_il": man_src.get("creato_il")},
        "regole": {"minuti": "soglie dei numeri della run (entro 2, 5, 10 minuti) più 20 [conv. della preview]",
                   "densita": "densità per sezione di censimento; quintili pesati per residenti [conv. della preview]",
                   "V": "quintili pesati per residenti di /api/meta (legende.V)",
                   "offerta_ombra_m2": "quintili pesati per superficie dei parchi [conv. della preview]; la webapp usa "
                                       "i quintili per numero di parchi",
                   "valore": "valore come rifugio di rifugi.json; quintili pesati per superficie dei parchi [conv. della preview]"},
        "controlli": {"somma_residenti_aree": somma_res, "residenti_run": num["residenti"]},
        "file": file_scritti,
    }
    scrivi_json(MANIFESTO, manifest)
    tot = sum(v["byte"] for v in file_scritti.values())
    print(f"ok: {len(file_scritti)} file, {tot / 1e6:.1f} MB; residenti nelle aree {somma_res:,.0f} "
          f"(run {num['residenti']:,.0f}); zone sul confine {zone_conf}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

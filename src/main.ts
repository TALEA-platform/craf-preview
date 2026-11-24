import '@fontsource-variable/inter';
import 'maplibre-gl/dist/maplibre-gl.css';
import './stile.css';
import * as maplibregl from 'maplibre-gl';
import type { ExpressionSpecification, Map as MappaGL, StyleSpecification } from 'maplibre-gl';
// MapLibre 6 carica il worker da un file a parte: lo si fa copiare da Vite e se ne passa l'indirizzo (come la webapp)
import urlLavoratore from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { TESTI, type Causa, type Lingua, type Modo, type Testi, type Vista } from './testi';
import { COLORI, OGGETTI, SFUMATURA_OMBRA, type Tavolozza } from './colori';

maplibregl.setWorkerUrl(urlLavoratore);

// ------------------------------------------------------------------------------------------------ tipi dei dati
interface Rifugio {
  rango: number; park_id: string; nome: string; area_ha: number; quota_ombra: number;
  posti: number; posti_ombra: number; fontanelle: number; bagni: number; immagine: string; angoli: [number, number][]; etichetta: [number, number];
}
interface Dati {
  riquadro: [number, number, number, number];
  numeri: {
    residenti: number; pezzi_abitati: number; aree: number; sezioni_abitate: number; parchi: number; zone: number; critici: number;
    quota_critici: number; critici_in_zone: number; zone_prioritarie: number[]; zone_dipende_dal_confine: number[];
    piedi: { tutti: number; grande: number };
    mediane: Record<Modo, { tutti: number | null; grandi: number | null }>;
    parchi_grandi: number;
    cause_residenti: Record<'caldo' | 'fragilita' | 'servizio' | 'misto' | 'nessuna', number>;
  };
  legende: { densita: { classi: number[] }; offerta_ombra_m2: { classi: number[] }; valore: { classi: number[] }; U: { classi: number[] }; V: { classi: number[] }; minuti: { classi: number[] } };
  rifugi: Rifugio[];
  zone_prioritarie: { zona: number; nome: string; critici: number; riquadro: [number, number, number, number] }[];
}
interface Parco {
  park_id: string; nome: string; area_ha: number; offerta_ombra_m2: number; O_omega1: number; offerta_sedute: number; n_sedute: number;
  n_fontanelle: number; n_bagni: number; rango: number | null; valore: number; bbox: [number, number, number, number];
}

type Strato = 'densita' | 'fragilita' | 'parchi' | 'minuti' | 'grandi' | 'priorita' | 'cause' | 'zone' | 'punti';
const VISTE: Vista[] = ['residenti', 'parchi', 'vicinanza', 'risultato'];
const STRATI_DI: Record<Vista, Strato[]> = {
  residenti: ['densita', 'fragilita'],
  parchi: ['parchi'],
  vicinanza: ['minuti', 'grandi'],
  risultato: ['priorita', 'cause', 'zone', 'punti'],
};

// ------------------------------------------------------------------------------------------------ mappe di base
type Base = 'scuro' | 'chiaro' | 'orto';
const FONT = ['Noto Sans Bold'];
const ORTOFOTO: StyleSpecification = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    orto: {
      type: 'raster', tileSize: 256, minzoom: 0, maxzoom: 21,
      // tile server delle ortofoto del Comune di Bologna (open data, ODbL), schema XYZ in EPSG:3857
      tiles: ['https://sitmappe.comune.bologna.it/tms/tileserver/Ortofoto2026/{z}/{x}/{y}.png'],
      attribution: 'Ortofoto 2026 © Comune di Bologna (ODbL)',
    },
  },
  layers: [
    { id: 'sfondo', type: 'background', paint: { 'background-color': '#1a1f1c' } },
    { id: 'orto', type: 'raster', source: 'orto', paint: { 'raster-brightness-max': 0.82, 'raster-saturation': -0.2, 'raster-fade-duration': 150 } },
  ],
};
const BASI: Record<Base, string | StyleSpecification> = {
  scuro: 'https://tiles.openfreemap.org/styles/dark',
  chiaro: 'https://tiles.openfreemap.org/styles/positron',
  orto: ORTOFOTO,
};

// ------------------------------------------------------------------------------------------------ stato
const q = new URLSearchParams(location.search);
const stato = {
  lingua: (q.get('lingua') === 'it' || q.get('lingua') === 'en' ? q.get('lingua') : navigator.language?.toLowerCase().startsWith('it') ? 'it' : 'en') as Lingua,
  vista: 'residenti' as Vista,
  strato: { residenti: 'densita', parchi: 'parchi', vicinanza: 'minuti', risultato: 'priorita' } as Record<Vista, Strato>,
  base: (['scuro', 'chiaro', 'orto'].includes(q.get('base') ?? '') ? q.get('base') : 'scuro') as Base,
  modo: (['piedi', 'bici', 'bus', 'auto'].includes(q.get('mezzo') ?? '') ? q.get('mezzo') : 'piedi') as Modo,
  causa: (['principale', 'caldo', 'fragilita', 'parchi'].includes(q.get('causa') ?? '') ? q.get('causa') : 'principale') as Causa,
  rifugio: null as string | null,
  parcoScelto: null as string | null,
  tabella: { ordine: 'rango' as keyof Parco, verso: 1, cerca: '', tutti: false },
};
let D: Dati;
let PARCHI: Parco[] = [];
let mappa: MappaGL;
const t = (): Testi => TESTI[stato.lingua];
// una sola tavolozza: i colori dei dati non cambiano con la mappa di base
const P = (): Tavolozza => COLORI;

// ------------------------------------------------------------------------------------------------ utilità
const fmt = (v: number, cifre = 0) =>
  new Intl.NumberFormat(stato.lingua === 'it' ? 'it-IT' : 'en-GB', { maximumFractionDigits: cifre, minimumFractionDigits: cifre, useGrouping: 'always' } as unknown as Intl.NumberFormatOptions).format(v);
// useGrouping «always»: anche le migliaia a quattro cifre hanno il punto (5.200 accanto a 14.000)
// in italiano la percentuale ha lo spazio (59 %), in inglese no (59%)
const pct = (v: number) => `${fmt(v * 100, 0)}${stato.lingua === 'it' ? ' %' : '%'}`;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};
const $ = (s: string) => document.querySelector(s) as HTMLElement;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

function scalino(prop: string, soglie: number[], colori: string[]): ExpressionSpecification {
  const e: unknown[] = ['step', ['to-number', ['get', prop]], colori[0]];
  soglie.forEach((s, i) => e.push(s, colori[i + 1]));
  return e as ExpressionSpecification;
}
function classeDi(v: number, soglie: number[]) {
  let i = 0;
  for (const s of soglie) if (v >= s) i++;
  return i;
}

// proprietà degli edifici con i minuti: t… al parco più vicino, h… al parco con valore alto più vicino; suffisso del mezzo
const SUFFISSO: Record<Modo, string> = { piedi: '', bici: 'b', bus: 'u', auto: 'a' };
function campoMinuti(s: Strato) {
  return (s === 'grandi' ? 'h' : 't') + SUFFISSO[stato.modo];
}

// mappe di un solo fattore: quinto di residenti di caldo (P_E), fragilità (P_V) e carenza di parchi (P_1_meno_Serv)
const CAMPO_CAUSA: Record<Exclude<Causa, 'principale'>, [string, (c: Tavolozza) => string[]]> = {
  caldo: ['qe', (c) => c.caldo], fragilita: ['qv', (c) => c.fragilita], parchi: ['qs', (c) => c.carenza],
};

function coloreEdifici(s: Strato): ExpressionSpecification {
  const c = P();
  if (s === 'minuti' || s === 'grandi') {
    const p = campoMinuti(s);
    return ['case', ['==', ['get', 'a'], 0], c.nessunResidente, ['==', ['get', p], null], c.oltre, scalino(p, D.legende.minuti.classi, c.minuti)];
  }
  if (s === 'priorita') {
    return ['case', ['==', ['get', 'a'], 0], c.nessunResidente, ['==', ['get', 'c'], 1], c.priorita[5],
      ['==', ['get', 'u'], null], c.nessunResidente, scalino('u', D.legende.U.classi, c.priorita.slice(0, 5))];
  }
  if (s === 'cause') {
    if (stato.causa === 'principale') {
      return ['case', ['==', ['get', 'a'], 0], c.nessunResidente,
        ['match', ['get', 'k'], 0, c.causa[0], 1, c.causa[1], 2, c.causa[2], 3, c.causa[3], c.causa[4]]];
    }
    const [campo, rampa] = CAMPO_CAUSA[stato.causa];
    return ['case', ['==', ['get', 'a'], 0], c.nessunResidente, ['==', ['get', campo], null], c.nessunResidente,
      ['match', ['get', campo], 0, rampa(c)[0], 1, rampa(c)[1], 2, rampa(c)[2], 3, rampa(c)[3], rampa(c)[4]]];
  }
  // vista «Dove vivono»: edifici abitati in grigio, sotto i punti
  return ['case', ['==', ['get', 'a'], 1], 'rgba(150,156,152,0.35)', c.nessunResidente];
}

// ------------------------------------------------------------------------------------------------ strati della mappa
// i dati vanno sopra a strade, edifici e linee della mappa di base, sotto le sole scritte: si cerca l'ultimo strato
// non di testo (esclusi i confini di stato) e si inserisce prima della prima scritta che lo segue
function primoSimbolo(): string | undefined {
  const L = mappa.getStyle().layers ?? [];
  let ultimo = -1;
  L.forEach((l, i) => { if (l.type !== 'symbol' && !l.id.startsWith('boundary')) ultimo = i; });
  return L.slice(ultimo + 1).find((l) => l.type === 'symbol')?.id;
}

function aggiungiStrati() {
  const c = P();
  const prima = primoSimbolo();
  const b = './dati/';
  const fonte = (id: string, file: string, extra: Record<string, unknown> = {}) => {
    if (!mappa.getSource(id)) mappa.addSource(id, { type: 'geojson', data: b + file, ...extra } as maplibregl.GeoJSONSourceSpecification);
  };
  fonte('aree', 'aree.geojson');
  fonte('sezioni', 'sezioni.geojson');
  fonte('parchi', 'parchi.geojson');
  fonte('zone', 'zone.geojson');
  fonte('punti', 'punti.geojson');
  fonte('edifici', 'edifici.geojson', { tolerance: 0.2 });
  fonte('oggetti', 'rifugi_oggetti.geojson');
  fonte('confine', 'confine.geojson');

  const lineaChiara = c.lineeAree;
  mappa.addLayer({ id: 'aree-fill', type: 'fill', source: 'aree', paint: { 'fill-color': scalino('densita', D.legende.densita.classi, c.densita), 'fill-opacity': 0.88 } }, prima);
  mappa.addLayer({ id: 'aree-linea', type: 'line', source: 'aree', paint: { 'line-color': lineaChiara, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.6, 15, 1.6] } }, prima);
  mappa.addLayer({ id: 'sezioni-fill', type: 'fill', source: 'sezioni', paint: {
    'fill-color': ['case', ['any', ['==', ['get', 'a'], 0], ['==', ['get', 'v'], null]], c.nessunResidente, scalino('v', D.legende.V.classi, c.fragilita)],
    'fill-opacity': ['case', ['==', ['get', 'a'], 0], 0.35, 0.88] } }, prima);
  mappa.addLayer({ id: 'sezioni-dens', type: 'fill', source: 'sezioni', paint: {
    'fill-color': ['case', ['any', ['==', ['get', 'a'], 0], ['==', ['get', 'd'], null]], c.nessunResidente, scalino('d', D.legende.densita.classi, c.densita)],
    'fill-opacity': ['case', ['==', ['get', 'a'], 0], 0.35, 0.88] } }, prima);
  mappa.addLayer({ id: 'sezioni-linea', type: 'line', source: 'sezioni', minzoom: 13, paint: { 'line-color': lineaChiara, 'line-width': 0.4 } }, prima);

  // parchi: alone, riempimento e bordo luminoso perché si distinguano bene dal resto della mappa
  mappa.addLayer({ id: 'parchi-alone', type: 'line', source: 'parchi', paint: { 'line-color': c.parcoAlone, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 3, 16, 8], 'line-blur': ['interpolate', ['linear'], ['zoom'], 11, 2, 16, 6] } }, prima);
  mappa.addLayer({ id: 'parchi-fill', type: 'fill', source: 'parchi', paint: { 'fill-color': scalino('valore', D.legende.valore.classi, c.offerta), 'fill-opacity': 0.95 } }, prima);
  mappa.addLayer({ id: 'parchi-linea', type: 'line', source: 'parchi', paint: { 'line-color': c.parcoBordo, 'line-opacity': 1, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 16, 1.4] } }, prima);

  mappa.addLayer({ id: 'edifici-fill', type: 'fill', source: 'edifici', paint: { 'fill-color': c.neutro, 'fill-opacity': 0.94 } }, prima);
  mappa.addLayer({ id: 'edifici-alone', type: 'line', source: 'edifici', maxzoom: 15.5, paint: { 'line-color': c.neutro, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.1, 14, 0.6, 15.5, 0] } }, prima);
  mappa.addLayer({ id: 'edifici-bordo', type: 'line', source: 'edifici', minzoom: 15.5, paint: { 'line-color': c.bordoEdifici, 'line-width': 0.5 } }, prima);

  // zone colorate per residenti a priorità massima, su scala logaritmica (da poche decine a oltre 14.000)
  const tappe = tappeZone();
  const rampa: unknown[] = ['interpolate', ['linear'], ['ln', ['max', ['to-number', ['get', 'critici']], 1]]];
  tappe.forEach((v, i) => rampa.push(Math.log(v), c.zonaScala[i]));
  mappa.addLayer({ id: 'zone-fill', type: 'fill', source: 'zone', paint: { 'fill-color': rampa as ExpressionSpecification, 'fill-opacity': 0.9 } }, prima);

  // fuori dal comune: velo; confine: linea con un alone
  mappa.addLayer({ id: 'fuori', type: 'fill', source: 'confine', filter: ['==', ['get', 'tipo'], 'fuori'], paint: { 'fill-color': c.fuori } }, prima);
  mappa.addLayer({ id: 'zone-linea', type: 'line', source: 'zone', filter: ['==', ['get', 'prioritaria'], 1], paint: { 'line-color': 'rgba(0,0,0,0.7)', 'line-width': 5.5, 'line-blur': 1 } });
  mappa.addLayer({ id: 'zone-pri', type: 'line', source: 'zone', filter: ['==', ['get', 'prioritaria'], 1], paint: { 'line-color': '#ffffff', 'line-width': 2.4 } });
  mappa.addLayer({ id: 'zone-confine', type: 'line', source: 'zone', filter: ['==', ['get', 'dipende_dal_confine'], 1], paint: { 'line-color': '#ffffff', 'line-width': 1.4, 'line-dasharray': [2, 1.6] } });
  mappa.addLayer({ id: 'punti', type: 'circle', source: 'punti', paint: {
    'circle-color': c.puntoMassima, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 1.5, 14, 2.8, 17, 5],
    'circle-stroke-color': 'rgba(255,255,255,0.85)', 'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 11, 0.3, 15, 1] } });
  mappa.addLayer({ id: 'confine-alone', type: 'line', source: 'confine', filter: ['==', ['get', 'tipo'], 'confine'], paint: { 'line-color': c.confineAlone, 'line-width': 5, 'line-blur': 2 } });
  mappa.addLayer({ id: 'confine', type: 'line', source: 'confine', filter: ['==', ['get', 'tipo'], 'confine'], paint: { 'line-color': c.confine, 'line-width': 1.8 } });
  mappa.addLayer({ id: 'parchi-scelto-alone', type: 'line', source: 'parchi', filter: ['==', ['get', 'park_id'], ''], paint: { 'line-color': 'rgba(0,0,0,0.6)', 'line-width': 6, 'line-blur': 1 } });
  mappa.addLayer({ id: 'parchi-scelto', type: 'line', source: 'parchi', filter: ['==', ['get', 'park_id'], ''], paint: { 'line-color': c.scelto, 'line-width': 3 } });

  mappa.addLayer({ id: 'oggetti', type: 'circle', source: 'oggetti', minzoom: 14, paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 2.5, 18, 6],
    'circle-color': ['match', ['get', 'tipo'],
      'seduta', ['case', ['==', ['get', 'all_ombra'], 1], OGGETTI.sedutaOmbra, OGGETTI.sedutaSole],
      'tavolo', ['case', ['==', ['get', 'all_ombra'], 1], OGGETTI.sedutaOmbra, OGGETTI.sedutaSole],
      'fontanella', OGGETTI.fontanella, 'bagno', OGGETTI.bagno, '#666'],
    // sedute e tavoli all'ombra: bianchi con bordo verde scuro, così si leggono sopra l'ombra
    'circle-stroke-color': ['case', ['==', ['get', 'all_ombra'], 1], OGGETTI.verdeScuro, '#ffffff'],
    'circle-stroke-width': ['case', ['==', ['get', 'all_ombra'], 1], 2, 1.2] } });
  mappa.addLayer({ id: 'oggetti-tavoli', type: 'symbol', source: 'oggetti', minzoom: 14, filter: ['==', ['get', 'tipo'], 'tavolo'],
    layout: { 'text-field': 'T', 'text-size': 9, 'text-font': FONT, 'text-allow-overlap': true }, paint: { 'text-color': OGGETTI.verdeScuro } });

  aggiornaMappa();
}

function visibile(id: string, si: boolean) {
  if (mappa.getLayer(id)) mappa.setLayoutProperty(id, 'visibility', si ? 'visible' : 'none');
}

function aggiornaMappa() {
  if (!mappa?.getLayer('aree-fill')) return;
  const v = stato.vista;
  const s = stato.strato[v];
  const edifici = v === 'vicinanza' || (v === 'risultato' && s !== 'zone');
  visibile('aree-fill', false);
  visibile('aree-linea', false);
  visibile('sezioni-dens', v === 'residenti' && s === 'densita');
  visibile('sezioni-fill', v === 'residenti' && s === 'fragilita');
  visibile('sezioni-linea', v === 'residenti');
  for (const id of ['parchi-alone', 'parchi-fill', 'parchi-linea', 'parchi-scelto', 'parchi-scelto-alone']) visibile(id, v === 'parchi');
  for (const id of ['edifici-fill', 'edifici-alone', 'edifici-bordo']) visibile(id, edifici);
  for (const id of ['zone-fill', 'zone-linea', 'zone-pri', 'zone-confine']) visibile(id, v === 'risultato' && s === 'zone');
  visibile('punti', v === 'risultato' && s === 'punti');
  visibile('oggetti', v === 'parchi' && stato.rifugio !== null);
  visibile('oggetti-tavoli', v === 'parchi' && stato.rifugio !== null);
  if (edifici) {
    const col = coloreEdifici(s);
    mappa.setPaintProperty('edifici-fill', 'fill-color', col);
    mappa.setPaintProperty('edifici-alone', 'line-color', col);
  }
  const r = stato.rifugio ?? '';
  mappa.setFilter('oggetti', ['==', ['get', 'park_id'], r]);
  mappa.setFilter('oggetti-tavoli', ['all', ['==', ['get', 'tipo'], 'tavolo'], ['==', ['get', 'park_id'], r]]);
  mappa.setFilter('parchi-scelto', ['==', ['get', 'park_id'], stato.parcoScelto ?? '']);
  mappa.setFilter('parchi-scelto-alone', ['==', ['get', 'park_id'], stato.parcoScelto ?? '']);
  if (mappa.getLayer('ombra')) mappa.removeLayer('ombra');
  if (mappa.getSource('ombra')) mappa.removeSource('ombra');
  const rif = D.rifugi.find((x) => x.park_id === stato.rifugio);
  if (v === 'parchi' && rif) {
    mappa.addSource('ombra', { type: 'image', url: './dati/' + rif.immagine, coordinates: rif.angoli as [[number, number], [number, number], [number, number], [number, number]] });
    mappa.addLayer({ id: 'ombra', type: 'raster', source: 'ombra', paint: { 'raster-opacity': 0.94, 'raster-fade-duration': 300 } }, 'oggetti');
  }
}

function cambiaBase(b: Base) {
  if (b === stato.base) return;
  stato.base = b;
  mappa.setStyle(BASI[b], { diff: false });
  mappa.once('style.load', aggiungiStrati);
  disegnaBasi();
  disegnaLegenda();
  disegnaTabella();
}

// ------------------------------------------------------------------------------------------------ interfaccia
const ICONE: Record<Vista | 'info', string> = {
  residenti: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  parchi: '<svg viewBox="0 0 24 24"><path d="M12 22v-7"/><path d="M17 8a5 5 0 1 0-10 0 4 4 0 0 0-1 7.9h12A4 4 0 0 0 17 8z"/></svg>',
  vicinanza: '<svg viewBox="0 0 24 24"><circle cx="13" cy="4" r="2"/><path d="m9 20 3-6 3 3v4M7 13l3-4 4 2 3 3M10 9l-1 4"/></svg>',
  risultato: '<svg viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
};

function disegnaBarra() {
  const T = t();
  $('#titolo').textContent = T.titolo;
  $('#sottotitolo').textContent = T.sottotitolo;
  document.title = `${T.titolo} · ${T.sottotitolo}`;
  document.documentElement.lang = stato.lingua;
  const l = $('#lingue');
  l.innerHTML = '';
  for (const g of ['it', 'en'] as Lingua[]) {
    const b = el('button', 'chip' + (g === stato.lingua ? ' attivo' : ''), g.toUpperCase());
    b.setAttribute('aria-pressed', String(g === stato.lingua));
    b.onclick = () => { stato.lingua = g; disegnaTutto(); };
    l.append(b);
  }
  const info = $('#info');
  info.innerHTML = `${ICONE.info}<span>${T.info}</span>`;
  info.onclick = apriBenvenuto;
}

function disegnaSchede() {
  const T = t();
  const s = $('#schede');
  s.innerHTML = '';
  VISTE.forEach((v, i) => {
    const b = el('button', 'scheda' + (v === stato.vista ? ' attiva' : '') + (v === 'risultato' ? ' finale' : ''));
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(v === stato.vista));
    b.innerHTML = `<span class="icona">${ICONE[v]}</span><span class="testo"><span class="etichetta"><span class="num">${i + 1}</span>${T.schede[v][0]}</span><span class="desc">${T.schede[v][1]}</span></span>`;
    b.onclick = () => vaiAVista(v);
    s.append(b);
  });
}

function vaiAVista(v: Vista) {
  stato.vista = v;
  if (v !== 'parchi') { stato.rifugio = null; stato.parcoScelto = null; }
  disegnaTutto();
  if (mappa) inquadraCitta();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// conteggi di persone arrotondati a due cifre significative: il dettaglio all'unità non è un dato da mostrare
function circa(v: number) {
  return `<span class="circa">${t().circa}</span> ${tondo(v)}`;
}

function numero(valore: string, etichetta: string) {
  return `<div class="numero"><div class="valore">${valore}</div><div class="etichetta">${etichetta}</div></div>`;
}

function opzioneStrato(v: Vista, s: Strato, [nome, riga]: [string, string]) {
  const b = el('button', 'strato' + (stato.strato[v] === s ? ' scelto' : ''));
  b.setAttribute('role', 'radio');
  b.setAttribute('aria-checked', String(stato.strato[v] === s));
  b.innerHTML = `<span class="pallino"></span><span><span class="nome">${nome}</span><span class="riga">${riga}</span></span>`;
  b.onclick = () => { stato.strato[v] = s; disegnaPannello(); aggiornaMappa(); disegnaLegenda(); };
  return b;
}

function gruppo(...b: HTMLElement[]) {
  const g = el('div', 'gruppo');
  g.setAttribute('role', 'radiogroup');
  g.append(...b);
  return g;
}

function disegnaPannello() {
  const T = t();
  const p = $('#pannello');
  p.innerHTML = '';
  const N = D.numeri;
  const v = stato.vista;
  if (v === 'residenti') {
    const R = T.residenti;
    p.append(el('h2', '', R.titolo), el('p', 'frase', R.testo));
    p.append(gruppo(opzioneStrato(v, 'densita', R.strati.densita), opzioneStrato(v, 'fragilita', R.strati.fragilita)));
    if (stato.strato.residenti === 'fragilita') p.append(el('p', 'frase piccola', R.testoFragilita));
    p.append(el('div', 'numeri', numero(circa(N.residenti), R.numeri.residenti) + numero(fmt(N.sezioni_abitate), R.numeri.sezioni)));
    p.append(el('p', 'aiuto', R.nota));
  } else if (v === 'parchi') {
    const Pc = T.parchi;
    p.append(el('h2', '', Pc.titolo), el('p', 'frase', Pc.testo));
    p.append(el('div', 'numeri', numero(fmt(N.parchi), Pc.numeri.parchi)));
    p.append(el('h3', '', Pc.migliori));
    const lista = el('div', 'rifugi');
    const tutti = el('button', 'rifugio tutti' + (stato.rifugio === null ? ' scelto' : ''), `<span class="nome">${Pc.tutti}</span>`);
    tutti.onclick = () => scegliRifugio(null);
    lista.append(tutti);
    for (const r of D.rifugi) {
      const b = el('button', 'rifugio' + (stato.rifugio === r.park_id ? ' scelto' : ''));
      b.innerHTML = `<span class="rango">${r.rango}</span><span class="nome">${esc(r.nome)}</span>`;
      b.onclick = () => scegliRifugio(r.park_id);
      lista.append(b);
      if (stato.rifugio === r.park_id) {
        const S = Pc.scheda;
        lista.append(el('div', 'scheda-parco',
          `<div><b>${fmt(r.area_ha, 1)} ha</b> ${S.area}</div>` +
          `<div><b>${pct(r.quota_ombra)}</b> ${S.ombra}</div>` +
          `<div>${S.posti(`<b>${fmt(r.posti_ombra)}</b>`, fmt(r.posti))}</div>` +
          `<div><b>${fmt(r.fontanelle)}</b> ${S.fontanella(r.fontanelle)} · <b>${fmt(r.bagni)}</b> ${S.bagno(r.bagni)}</div>`));
      }
    }
    p.append(lista);
    p.append(el('p', 'nota-regola', Pc.regola));
    p.append(el('p', 'aiuto', Pc.nota));
  } else if (v === 'vicinanza') {
    const V = T.vicinanza;
    p.append(el('h2', '', V.titolo), el('p', 'frase', V.testo));
    p.append(gruppo(opzioneStrato(v, 'minuti', V.strati.minuti), opzioneStrato(v, 'grandi', V.strati.grandi)));
    const mezzi = el('div', 'mezzi', `<span class="etichetta-b">${V.mezzo}</span>`);
    const chips = el('div', 'chips');
    for (const m of ['piedi', 'bici', 'bus', 'auto'] as Modo[]) {
      const b = el('button', 'chip' + (m === stato.modo ? ' attivo' : ''), V.modiChip[m]);
      b.setAttribute('aria-pressed', String(m === stato.modo));
      b.onclick = () => { stato.modo = m; disegnaPannello(); aggiornaMappa(); disegnaLegenda(); };
      chips.append(b);
    }
    mezzi.append(chips);
    p.append(mezzi);
    const med = N.mediane[stato.modo];
    const mm = (x: number | null) => (x === null ? T.passaggio.oltre : fmt(x, 1));
    const sAlti = stato.strato.vicinanza === 'grandi';
    p.append(el('div', 'numeri', numero(mm(sAlti ? med.grandi : med.tutti), (sAlti ? V.numeri.grandi : V.numeri.minuti)(V.modi[stato.modo]))));
    p.append(el('p', 'aiuto', V.nota));
  } else {
    const R = T.risultato;
    p.append(el('h2', '', R.titolo), el('p', 'frase', R.testo));
    p.append(el('div', 'ingredienti', `<div class="ing-titolo">${R.ingredienti.titolo}</div>` +
      R.ingredienti.righe.map(([a, b]) => `<div class="ing"><b>${a}</b><span>${b}</span></div>`).join('')));
    p.append(gruppo(opzioneStrato(v, 'priorita', R.strati.priorita), opzioneStrato(v, 'cause', R.strati.cause), opzioneStrato(v, 'zone', R.strati.zone), opzioneStrato(v, 'punti', R.strati.punti)));
    if (stato.strato.risultato === 'cause') {
      const C = R.causa;
      const scelte = el('div', 'mezzi', `<span class="etichetta-b">${C.mostra}</span>`);
      const chips = el('div', 'chips');
      for (const k of ['principale', 'caldo', 'fragilita', 'parchi'] as Causa[]) {
        const b = el('button', 'chip' + (k === stato.causa ? ' attivo' : ''), C.chip[k]);
        b.setAttribute('aria-pressed', String(k === stato.causa));
        b.onclick = () => { stato.causa = k; disegnaPannello(); aggiornaMappa(); disegnaLegenda(); };
        chips.append(b);
      }
      scelte.append(chips);
      p.append(scelte);
      const cc = N.cause_residenti;
      const LC = T.legende.paroleCausa;
      const voci: [string, string, number][] = [
        [P().causa[1], LC[1], cc.fragilita], [P().causa[0], LC[0], cc.caldo], [P().causa[2], LC[2], cc.servizio],
        [P().causa[3], LC[3], cc.misto], [P().causa[4], LC[4], cc.nessuna],
      ];
      p.append(el('div', 'cause-num', `<div class="ing-titolo">${C.titolo}</div><ul>` +
        voci.map(([col, parola, n]) => `<li><span class="campione" style="--c:${col}"></span><span>${parola}</span><b>${t().circa} ${tondo(n)}</b></li>`).join('') + '</ul>'));
      p.append(el('p', 'aiuto', C.nota));
    } else {
      p.append(el('div', 'numeri', numero(circa(N.critici), `${R.numeri.massima} (${pct(N.quota_critici)})`)));
    }
    if (stato.strato.risultato === 'zone') {
      p.append(el('h3', '', R.prioritarie(fmt(D.zone_prioritarie.length))));
      const lista = el('div', 'rifugi');
      for (const z of D.zone_prioritarie) {
        const b = el('button', 'rifugio zona-b');
        b.innerHTML = `<span class="rango">${z.zona}</span><span class="nome">${esc(z.nome.replace(/^Z\d+ · /, ''))}<span class="sotto-b">${t().circa} ${tondo(z.critici)} ${T.passaggio.residentiMassima}</span></span>`;
        b.onclick = () => mappa.fitBounds([[z.riquadro[0], z.riquadro[1]], [z.riquadro[2], z.riquadro[3]]], { padding: 60, duration: 1400, essential: true });
        lista.append(b);
      }
      p.append(lista);
      p.append(el('p', 'aiuto', R.nota));
    }
  }
  // percorso verso il risultato
  const i = VISTE.indexOf(v);
  const nav = el('div', 'percorso');
  nav.innerHTML = `<div class="riga-p"><div class="barrette">${VISTE.map((x, k) => `<button class="barretta${k <= i ? ' piena' : ''}${k === i ? ' attuale' : ''}" aria-label="${T.schede[x][0]}" data-k="${k}"></button>`).join('')}</div><span class="passo">${T.passo(i + 1, VISTE.length)}</span></div>`;
  nav.querySelectorAll<HTMLButtonElement>('.barretta').forEach((b) => { b.onclick = () => vaiAVista(VISTE[Number(b.dataset.k)]); });
  if (i < VISTE.length - 1) {
    const av = el('button', 'avanti', `${T.avanti}: ${T.schede[VISTE[i + 1]][0]} <span aria-hidden="true">→</span>`);
    av.onclick = () => vaiAVista(VISTE[i + 1]);
    nav.append(av);
  }
  p.append(nav);
  const f = el('details', 'fonti');
  f.innerHTML = `<summary>${T.fonti}</summary><p>${T.fontiTesto}</p>`;
  p.append(f);
}

// tappe della scala delle zone: decine, centinaia, migliaia di residenti a priorità massima e la zona più grande
function tappeZone() {
  const max = Math.max(...D.zone_prioritarie.map((z) => z.critici), 2001);
  return [20, 200, 2000, max];
}

// ------------------------------------------------------------------------------------------------ legenda
// scala verticale: una riga per classe, il valore più alto in cima, con la parola e, dove serve, l'intervallo
interface Riga { colore: string; parola: string; dettaglio?: string; forma?: string }

/** arrotonda le soglie a due cifre significative per leggerle a colpo d'occhio (5.240 → 5.200; 13.518 → 14.000) */
function tondo(v: number) {
  if (Math.abs(v) < 10) return fmt(v, v < 1 ? 1 : 0);
  const k = 10 ** (Math.floor(Math.log10(Math.abs(v))) - 1);
  return fmt(Math.round(v / k) * k);
}
function intervalli(soglie: number[], unita = '') {
  const L = t().legende;
  const u = unita ? ` ${unita}` : '';
  const out = [`${L.menoDi} ${tondo(soglie[0])}${u}`];
  for (let i = 1; i < soglie.length; i++) out.push(`${tondo(soglie[i - 1])}–${tondo(soglie[i])}${u}`);
  out.push(`${L.oltre} ${tondo(soglie[soglie.length - 1])}${u}`);
  return out;
}
function righe(colori: string[], parole: string[], dettagli?: string[]): Riga[] {
  return colori.map((c, i) => ({ colore: c, parola: parole[i], dettaglio: dettagli?.[i] }));
}
function scala(titolo: [string, string], r: Riga[], extra: Riga[] = []) {
  const riga = (x: Riga) => `<li><span class="campione ${x.forma ?? ''}" style="--c:${x.colore}"></span><span class="parola">${x.parola}</span>` +
    `<span class="dettaglio">${x.dettaglio ?? ''}</span></li>`;
  return `<div class="leg-titolo">${titolo[0]}</div><div class="leg-sotto">${titolo[1]}</div>` +
    `<ul class="leg-scala">${[...r].reverse().map(riga).join('')}</ul>` +
    (extra.length ? `<ul class="leg-scala leg-extra">${extra.map(riga).join('')}</ul>` : '');
}

function disegnaLegenda() {
  const L = t().legende;
  const c = P();
  const s = stato.strato[stato.vista];
  const vuoti: Riga[] = [{ colore: c.nessunResidente, parola: L.nessunResidente }];
  let h = '';
  if (s === 'densita') {
    h = scala(L.densita, righe(c.densita, L.parole5, intervalli(D.legende.densita.classi, L.unitaDensita)), vuoti);
  } else if (s === 'fragilita') {
    h = scala(L.fragilita, righe(c.fragilita, L.parole5), vuoti);
  } else if (s === 'parchi') {
    // niente valori in m² nella legenda: l'offerta non è una grandezza che chi guarda può leggere (richiesta dell'utente)
    if (!stato.rifugio) h = scala(L.offerta, righe(c.offerta, L.paroleOfferta));
    else {
      const O = L.oggetti;
      h = `<div class="leg-titolo">${L.ombra[0]}</div><div class="leg-sotto">${L.ombra[1]}</div>` +
        `<div class="leg-sfumatura" style="background:linear-gradient(90deg,${SFUMATURA_OMBRA.join(',')})"></div><div class="leg-estremi"><span>${L.sole}</span><span>${L.ombraParola}</span></div>` +
        `<ul class="leg-oggetti">${[
          ['#fff', O.sedutaOmbra, 'punto ombra'], [OGGETTI.sedutaSole, O.sedutaSole, 'punto'], ['#fff', O.tavolo, 'punto ombra tavolo'],
          [OGGETTI.fontanella, O.fontanella, 'punto'], [OGGETTI.bagno, O.bagno, 'punto'],
        ].map(([col, p, f]) => `<li><span class="campione ${f}" style="--c:${col}"></span>${p}</li>`).join('')}</ul>`;
    }
  } else if (s === 'minuti' || s === 'grandi') {
    const V = t().vicinanza;
    h = scala([s === 'minuti' ? L.minuti : L.grandi, `${V.modiChip[stato.modo]} · ${L.minutiSotto}`], righe([...c.minuti, c.oltre], L.paroleMinuti), vuoti);
  } else if (s === 'priorita') {
    h = scala(L.priorita, righe(c.priorita, L.parolePriorita), vuoti);
  } else if (s === 'cause') {
    if (stato.causa === 'principale') {
      // stesso ordine della lista nel pannello (la scala si legge dall'alto): fragilità, caldo, parchi, più cause, nessuna
      const o = [4, 3, 2, 0, 1];
      h = scala(L.causa, righe(o.map((i) => c.causa[i]), o.map((i) => L.paroleCausa[i])), vuoti);
    } else {
      const titolo = stato.causa === 'caldo' ? L.caldo : stato.causa === 'fragilita' ? L.fragilitaE : L.carenza;
      h = scala(titolo, righe(CAMPO_CAUSA[stato.causa][1](c), L.parole5), vuoti);
    }
  } else if (s === 'punti') {
    h = scala(L.punti, [{ colore: c.neutro, parola: L.edificioAbitato }, { colore: c.puntoMassima, parola: L.unPunto, forma: 'punto' }]);
  } else {
    const n = fmt(D.numeri.zone_prioritarie.length);
    const tappe = tappeZone();
    h = `<div class="leg-titolo">${L.zone[0]}</div><div class="leg-sotto">${L.zone[1]}</div>` +
      `<div class="leg-sfumatura" style="background:linear-gradient(90deg,${c.zonaScala.join(',')})"></div>` +
      `<div class="leg-estremi">${tappe.map((v) => `<span>${tondo(v)}</span>`).join('')}</div>` +
      `<ul class="leg-scala leg-extra">` +
      `<li><span class="campione linea doppia"></span><span class="parola">${L.zonaPrioritaria(n)}</span><span class="dettaglio"></span></li>` +
      `<li><span class="campione linea tratteggio" style="--c:#5b6b62"></span><span class="parola">${L.zonaConfine}</span><span class="dettaglio"></span></li></ul>`;
  }
  $('#legenda').innerHTML = h;
}

function disegnaBasi() {
  const T = t();
  const b = $('#basi');
  b.innerHTML = `<div class="etichetta-b">${T.mappaBase}</div>`;
  const r = el('div', 'chips');
  for (const k of ['scuro', 'chiaro', 'orto'] as Base[]) {
    const c = el('button', 'chip' + (k === stato.base ? ' attivo' : ''), T.basi[k]);
    c.onclick = () => cambiaBase(k);
    r.append(c);
  }
  b.append(r);
}

// ------------------------------------------------------------------------------------------------ tabella dei parchi
function disegnaTabella() {
  const box = $('#tabella');
  if (stato.vista !== 'parchi') { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  const T = t().parchi.tabella;
  const C = T.colonne;
  const tb = stato.tabella;
  const cerca = tb.cerca.trim().toLowerCase();
  let righe = PARCHI.filter((p) => !cerca || p.nome.toLowerCase().includes(cerca));
  const k = tb.ordine;
  righe = [...righe].sort((a, b) => {
    const x = a[k] as number | string | null;
    const y = b[k] as number | string | null;
    if (x === null) return 1;
    if (y === null) return -1;
    return (typeof x === 'string' ? x.localeCompare(String(y), stato.lingua) : (x as number) - (y as number)) * tb.verso;
  });
  const totale = righe.length;
  const mostrate = tb.tutti || cerca ? righe : righe.slice(0, 20);
  const col: [keyof Parco, string, string][] = [
    ['rango', C.rango, 'num'], ['nome', C.nome, ''], ['area_ha', C.area, 'num'], ['O_omega1', C.ombra, 'num'],
    ['offerta_ombra_m2', C.offerta, 'num'], ['offerta_sedute', C.sedute, 'num'], ['n_fontanelle', C.fontanelle, 'num'], ['n_bagni', C.bagni, 'num'],
  ];
  const freccia = (c: keyof Parco) => (c === k ? (tb.verso === 1 ? ' ↑' : ' ↓') : '');
  const verdi = COLORI.offerta;
  box.innerHTML = `<div class="tab-testa"><div><h3>${T.titolo}</h3><p>${T.sotto}</p></div><input type="search" class="cerca" placeholder="${T.cerca}" value="${esc(tb.cerca)}" aria-label="${T.cerca}"></div>` +
    `<div class="tab-scorri"><table><thead><tr>${col.map(([id, n, cl]) => `<th class="${cl}" data-c="${id}" aria-sort="${id === k ? (tb.verso === 1 ? 'ascending' : 'descending') : 'none'}"><button>${n}${freccia(id)}</button></th>`).join('')}</tr></thead><tbody>` +
    (mostrate.length ? mostrate.map((p) => `<tr data-id="${p.park_id}" class="${p.park_id === stato.parcoScelto ? 'scelta' : ''}${p.rango !== null && p.rango <= 5 ? ' migliore' : ''}">` +
      `<td class="num"><span class="rango-t">${p.rango ?? '–'}</span></td><td class="nome-t">${esc(p.nome)}</td><td class="num">${fmt(p.area_ha, 2)}</td><td class="num">${pct(p.O_omega1)}</td>` +
      `<td class="num"><span class="pastiglia" style="background:${verdi[classeDi(p.valore, D.legende.valore.classi)]}"></span>${fmt(p.offerta_ombra_m2)}</td>` +
      `<td class="num">${fmt(p.offerta_sedute)}</td><td class="num">${fmt(p.n_fontanelle)}</td><td class="num">${fmt(p.n_bagni)}</td></tr>`).join('')
      : `<tr><td colspan="8" class="vuota">${T.nessuno}</td></tr>`) +
    `</tbody></table></div>` + (!cerca && totale > 20 ? `<button class="altri">${tb.tutti ? T.meno : T.tutti(totale)}</button>` : '');
  const inp = box.querySelector('.cerca') as HTMLInputElement;
  inp.oninput = () => {
    tb.cerca = inp.value;
    disegnaTabella();
    const i2 = $('#tabella .cerca') as HTMLInputElement;
    i2.focus();
    i2.setSelectionRange(i2.value.length, i2.value.length);
  };
  box.querySelectorAll<HTMLElement>('th').forEach((th) => {
    th.onclick = () => {
      const id = th.dataset.c as keyof Parco;
      if (tb.ordine === id) tb.verso *= -1;
      else { tb.ordine = id; tb.verso = id === 'rango' || id === 'nome' ? 1 : -1; }
      disegnaTabella();
    };
  });
  box.querySelectorAll<HTMLTableRowElement>('tbody tr[data-id]').forEach((tr) => { tr.onclick = () => scegliParco(tr.dataset.id as string); });
  const altri = box.querySelector('.altri') as HTMLButtonElement | null;
  if (altri) altri.onclick = () => { tb.tutti = !tb.tutti; disegnaTabella(); };
}

function scegliParco(id: string) {
  const p = PARCHI.find((x) => x.park_id === id);
  if (!p) return;
  if (D.rifugi.some((r) => r.park_id === id)) { scegliRifugio(id); }
  else {
    stato.rifugio = null;
    stato.parcoScelto = id;
    disegnaPannello(); disegnaLegenda(); aggiornaMappa(); disegnaTabella();
    mappa.fitBounds([[p.bbox[0], p.bbox[1]], [p.bbox[2], p.bbox[3]]], { padding: 80, maxZoom: 17, duration: 1400, essential: true });
  }
  $('.carta-mappa').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function scegliRifugio(id: string | null) {
  stato.rifugio = id;
  stato.parcoScelto = id;
  disegnaPannello(); disegnaLegenda(); aggiornaMappa(); disegnaTabella();
  const r = D.rifugi.find((x) => x.park_id === id);
  if (r) {
    const xs = r.angoli.map((a) => a[0]);
    const ys = r.angoli.map((a) => a[1]);
    mappa.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 40, duration: 1600, essential: true });
  } else inquadraCitta();
}

const citta = (): [[number, number], [number, number]] => [[D.riquadro[0], D.riquadro[1]], [D.riquadro[2], D.riquadro[3]]];
function inquadraCitta() {
  mappa.fitBounds(citta(), { padding: 24, duration: 1200, essential: true });
}

// ------------------------------------------------------------------------------------------------ scheda al passaggio
function vuoto(x: unknown) {
  return x === null || x === undefined || x === 'null';
}

function attivaPassaggio() {
  const card = $('#passaggio');
  const strati = (): string[] => {
    const v = stato.vista;
    const s = stato.strato[v];
    if (v === 'residenti') return s === 'densita' ? ['sezioni-dens'] : s === 'fragilita' ? ['sezioni-fill'] : ['edifici-fill'];
    if (v === 'parchi') return stato.rifugio ? ['oggetti', 'parchi-fill'] : ['parchi-fill'];
    return s === 'zone' ? ['zone-fill'] : s === 'punti' ? [] : ['edifici-fill'];
  };
  mappa.on('mousemove', (e) => {
    const ids = strati().filter((id) => mappa.getLayer(id));
    const f = mappa.queryRenderedFeatures(e.point, { layers: ids })[0];
    if (!f) { card.hidden = true; mappa.getCanvas().style.cursor = ''; return; }
    const p = f.properties as Record<string, unknown>;
    const T = t();
    const L = T.legende;
    const Pa = T.passaggio;
    let h = '';
    const id = f.layer.id;
    if (id === 'aree-fill') h = `<b>${esc(String(p.area))}</b><span>${fmt(Number(p.densita), 0)} ${Pa.residentiHa} · ${t().circa} ${tondo(Number(p.residenti))} ${Pa.residenti}</span>`;
    else if (id === 'sezioni-dens') {
      h = vuoto(p.d) || Number(p.a) !== 1 ? `<span>${L.nessunResidente}</span>` : `<b>${fmt(Number(p.d), 0)} ${Pa.residentiHa}</b><span>${t().circa} ${tondo(Number(p.r))} ${Pa.residenti}</span>`;
    } else if (id === 'sezioni-fill') {
      h = vuoto(p.v) || Number(p.a) !== 1 ? `<span>${L.nessunResidente}</span>` : `<b>${L.fragilita[0]}: ${L.parole5[classeDi(Number(p.v), D.legende.V.classi)]}</b>`;
    } else if (id === 'parchi-fill') h = `<b>${esc(String(p.nome))}</b><span>${fmt(Number(p.area_ha), 2)} ha · ${pct(Number(p.O_omega1))} ${Pa.allOmbra}</span>`;
    else if (id === 'oggetti') {
      const O = L.oggetti;
      const ombra = Number(p.all_ombra) === 1;
      h = `<b>${p.tipo === 'seduta' ? (ombra ? O.sedutaOmbra : O.sedutaSole) : p.tipo === 'tavolo' ? `${O.tavolo} · ${ombra ? L.ombraParola : L.sole}` : O[p.tipo as 'fontanella' | 'bagno']}</b>`;
    } else if (id === 'zone-fill') h = `<b>${esc(String(p.nome))}</b><span>${t().circa} ${tondo(Number(p.critici))} ${Pa.residentiMassima} · ${pct(Number(p.quota_critici))} ${Pa.dellaZona}</span>`;
    else {
      const s = stato.strato[stato.vista];
      if (Number(p.a) !== 1) h = `<span>${L.nessunResidente}</span>`;
      else if (s === 'minuti' || s === 'grandi') {
        const k = campoMinuti(s);
        h = `<b>${vuoto(p[k]) ? Pa.oltre : fmt(Number(p[k]), 1)} ${Pa.minuti} ${T.vicinanza.modi[stato.modo]}</b>`;
      } else if (s === 'priorita') {
        const lv = Number(p.c) === 1 ? 5 : vuoto(p.u) ? -1 : classeDi(Number(p.u), D.legende.U.classi);
        h = lv < 0 ? `<span>${L.nessunResidente}</span>` : `<b>${L.priorita[0]}: ${L.parolePriorita[lv]}</b>`;
      } else if (s === 'cause') {
        if (stato.causa === 'principale') h = vuoto(p.k) ? `<span>${L.nessunResidente}</span>` : `<b>${L.causa[0]}: ${L.paroleCausa[Number(p.k)]}</b>`;
        else {
          const k = CAMPO_CAUSA[stato.causa][0];
          const titolo = stato.causa === 'caldo' ? L.caldo : stato.causa === 'fragilita' ? L.fragilitaE : L.carenza;
          h = vuoto(p[k]) ? `<span>${L.nessunResidente}</span>` : `<b>${titolo[0]}: ${L.parole5[Number(p[k])]}</b>`;
        }
      } else if (s === 'zone') h = `<b>${Number(p.c) === 1 ? L.edificioMassima : L.altroEdificio}</b>`;
    }
    card.innerHTML = h;
    card.hidden = false;
    mappa.getCanvas().style.cursor = id === 'parchi-fill' ? 'pointer' : '';
  });
  mappa.on('mouseout', () => { card.hidden = true; });
  mappa.on('click', 'parchi-fill', (e) => {
    const id = e.features?.[0]?.properties?.park_id as string | undefined;
    if (id) scegliParco(id);
  });
}

// ------------------------------------------------------------------------------------------------ benvenuto
function apriBenvenuto() {
  const T = t();
  const B = T.benvenuto;
  const m = $('#benvenuto');
  m.innerHTML = `<div class="finestra" role="dialog" aria-modal="true" aria-labelledby="bt"><h2 id="bt">${B.titolo}</h2>${B.testo.map((x) => `<p>${x}</p>`).join('')}` +
    `<div class="passi-b"><div class="passi-titolo">${B.passi}</div><ol>${VISTE.map((v, i) => `<li class="${v === 'risultato' ? 'finale' : ''}"><span class="num">${i + 1}</span>${T.schede[v][0]}</li>`).join('')}</ol></div>` +
    `<p class="nota-b">${B.nota}</p><div class="azioni-b"><button class="primario">${B.risultato}</button><button class="secondario">${B.inizio}</button></div></div>`;
  m.hidden = false;
  const chiudi = () => { m.hidden = true; };
  (m.querySelector('.primario') as HTMLButtonElement).onclick = () => { chiudi(); vaiAVista('risultato'); };
  (m.querySelector('.secondario') as HTMLButtonElement).onclick = () => { chiudi(); vaiAVista('residenti'); };
  (m.querySelector('.primario') as HTMLButtonElement).focus();
  m.onclick = (e) => { if (e.target === m) chiudi(); };
  document.addEventListener('keydown', function chiudiEsc(e) { if (e.key === 'Escape') { chiudi(); document.removeEventListener('keydown', chiudiEsc); } });
}

function disegnaTutto() {
  disegnaBarra();
  disegnaSchede();
  disegnaPannello();
  disegnaLegenda();
  disegnaBasi();
  disegnaTabella();
  aggiornaMappa();
}

// ------------------------------------------------------------------------------------------------ avvio
function riquadroDi(g: { coordinates: unknown }): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const visita = (c: unknown): void => {
    if (typeof (c as number[])[0] === 'number') {
      const [x, y] = c as number[];
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    } else (c as unknown[]).forEach(visita);
  };
  visita(g.coordinates);
  return [x0, y0, x1, y1];
}

async function avvia() {
  const [dati, parchi] = await Promise.all([
    fetch('./dati/dati.json').then((r) => r.json()),
    fetch('./dati/parchi.geojson').then((r) => r.json()),
  ]);
  D = dati;
  PARCHI = (parchi as { features: { properties: Omit<Parco, 'bbox'>; geometry: { coordinates: unknown } }[] }).features.map((f) => ({ ...f.properties, bbox: riquadroDi(f.geometry) }));
  // link diretti: ?vista=parchi&rifugio=P-...  ?vista=risultato&strato=zone  ?base=chiaro  ?benvenuto=0
  const v = q.get('vista') as Vista | null;
  if (v && VISTE.includes(v)) stato.vista = v;
  const s = q.get('strato') as Strato | null;
  if (s && STRATI_DI[stato.vista].includes(s)) stato.strato[stato.vista] = s;
  const r = q.get('rifugio');
  if (r && D.rifugi.some((x) => x.park_id === r)) stato.vista = 'parchi';
  mappa = new maplibregl.Map({
    container: 'mappa', style: BASI[stato.base], bounds: citta(), fitBoundsOptions: { padding: 24 },
    minZoom: 9.5, maxZoom: 19, attributionControl: { compact: true },
  });
  mappa.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  mappa.once('style.load', aggiungiStrati);
  mappa.on('load', attivaPassaggio);
  disegnaTutto();
  if (r && stato.vista === 'parchi') mappa.once('load', () => scegliRifugio(r));
  if (q.get('benvenuto') !== '0') apriBenvenuto();
}
avvia();

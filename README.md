# Rifugi climatici all’aperto di Bologna · Anteprima

Anteprima dei risultati del modello in quattro passi, con una breve spiegazione, in italiano e inglese. Tutto lato
client: un sito statico (Vite + MapLibre) con i dati già calcolati in `public/dati/`.

1. **Residenti e fragilità:** densità di residenti e fragilità al caldo per sezione di censimento.
2. **Parchi:** i 385 parchi per valore come rifugio climatico; i cinque rifugi migliori con la mappa dell'ombra a 0,5 m e gli
   oggetti contati (sedute, tavoli, fontanelle, bagni); sotto la mappa la tabella di tutti i parchi, ordinabile e con
   ricerca.
3. **Vicinanza:** minuti fino al parco più vicino e fino al parco più vicino di almeno mezzo ettaro, a piedi, in
   bici, in bus o in auto.
4. **Il risultato:** priorità di intervento edificio per edificio, in sei livelli; cause della priorità (causa
   principale, caldo, fragilità, carenza di parchi); zone dove si concentrano i residenti a priorità molto alta;
   punti (1 = 10 residenti a priorità molto alta).

Mappe di base: scura (predefinita), chiara, ortofoto. L'applicazione completa (racconto e dati in dettaglio) è in
sviluppo e sostituirà questa anteprima.

## Avvio in locale

```
npm ci
npm run dev        # http://127.0.0.1:5180
npm run build      # sito in dist/
npm run preview    # http://127.0.0.1:5181, prova del sito costruito
```

Link diretti: `?vista=residenti|parchi|vicinanza|risultato`,
`?strato=densita|fragilita|minuti|grandi|priorita|cause|zone|punti`, `?causa=principale|caldo|fragilita|parchi`,
`?mezzo=piedi|bici|bus|auto`, `?rifugio=<park_id>`,
`?base=scuro|chiaro|orto`, `?lingua=it|en`, `?benvenuto=0` (senza finestra iniziale).

## Pubblicazione

Il workflow `.github/workflows/pagine.yml` costruisce il sito a ogni push su `main` e lo pubblica su GitHub Pages in
`https://<utente>.github.io/<repository>/preview/`; la radice rimanda lì. Nella repository: Settings → Pages →
Source = «GitHub Actions».

## Dati

`public/dati/` è prodotto da `scripts/prepara_dati.py` a partire dall'esportazione del progetto di lavoro; il
manifesto `scripts/manifest_dati.json` riporta l'origine e lo SHA256 di ogni file. Lo script non ricalcola il
modello: riduce i file e deriva solo la densità delle sezioni (residenti / ettari della sezione in EPSG:25832), il confine
comunale dall'unione delle aree, le immagini dell'ombra colorate e i nomi dei parchi con le maiuscole. Si lancia dalla
cartella del progetto di lavoro, non da questa repository.

Nessun dato sui residenti per singolo edificio: per gli edifici ci sono solo minuti per mezzo, livello di priorità,
appartenenza alla priorità molto alta, causa principale e quinti di caldo, fragilità e carenza di parchi.

## Fonti e licenze

- Parchi, edifici (Carta tecnica comunale), aree statistiche e rete pedonale: open data del Comune di Bologna,
  CC BY 4.0.
- Fontanelle, bagni e sedute: Comune di Bologna (SIT e open data), con integrazioni da OpenStreetMap.
- Redditi: Comune di Bologna, redditi IRPEF per area statistica, CC BY 4.0.
- Ortofoto 2026: Comune di Bologna, ODbL (tile server comunale).
- Residenti: Istat, censimento permanente 2023 su sezioni di censimento 2021, CC BY 4.0.
- Usi degli edifici e percorsi: © OpenStreetMap contributors, ODbL 1.0.
- Rete bus: TPER, GTFS, CC BY 3.0 IT.
- Quote del terreno: Regione Emilia-Romagna, DTM 2023, CC BY 4.0.
- Temperatura della superficie: stima a 10 m da dati satellitari Landsat e Sentinel-2.
- Ombra: modello digitale della superficie a 0,5 m dal rilievo LiDAR 2023 della Regione Emilia-Romagna.
- Mappe di base: OpenFreeMap, OpenMapTiles, © OpenStreetMap contributors.
- Carattere Inter: SIL Open Font License 1.1.

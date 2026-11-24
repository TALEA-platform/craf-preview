/**
 * Colori della preview: una sola tavolozza per tutte le mappe di base (scura, chiara, ortofoto), così un dato ha
 * sempre gli stessi colori. Le scale sono a più tinte con luminosità media o alta, leggibili sia sul fondo scuro sia
 * sul chiaro; più valore = colore più carico. Origine:
 * - densità: Brewer YlOrBr, accorciata agli estremi [conv. della preview];
 * - fragilità: Brewer Purples, accorciata agli estremi (la webapp usa la stessa famiglia per V);
 * - offerta d'ombra: Brewer YlGn senza il giallo più chiaro, come la sfumatura dell'ombra dei rifugi (dal giallo del sole al verde dell'ombra);
 * - minuti: Brewer GnBu; «oltre 30» in arancio fuori scala;
 * - priorità: Brewer RdYlBu nella parte calda con il verde acqua di SCALA_COPERTURA per «bassa»
 *   (`v2/webapp/frontend/src/formato/colori.ts`); «massima» in magenta, tinta a sé perché si riconosca su ogni fondo
 *   (la webapp usa un rosso molto scuro, che sul fondo scuro sparisce) [conv. della preview];
 * - oggetti dei parchi: COLORI_PARCHI di colori.ts.
 */
export interface Tavolozza {
  priorita: string[];
  neutro: string;
  nessunResidente: string;
  densita: string[];
  fragilita: string[];
  offerta: string[];
  parcoBordo: string;
  parcoAlone: string;
  minuti: string[];
  oltre: string;
  zona: string;
  zonaScala: string[];
  causa: string[];
  caldo: string[];
  carenza: string[];
  puntoMassima: string;
  confine: string;
  confineAlone: string;
  fuori: string;
  lineeAree: string;
  bordoEdifici: string;
  etichetta: string;
  aloneEtichetta: string;
  scelto: string;
}

export const COLORI: Tavolozza = {
  priorita: ['#4aa79a', '#fee08b', '#fdae61', '#f46d43', '#d73027', '#c51b7d'],
  neutro: 'rgba(150,156,152,0.6)',
  nessunResidente: 'rgba(128,134,130,0.45)',
  densita: ['#fff0c2', '#fcd17d', '#f0a548', '#cf7a2b', '#9a5222'],
  fragilita: ['#f0e6fa', '#cdb4ec', '#a585d6', '#7d57bb', '#5a3399'],
  offerta: ['#d9f0a3', '#addd8e', '#78c679', '#31a354', '#006837'],
  parcoBordo: 'rgba(0,40,20,0.55)',
  parcoAlone: 'rgba(120,200,110,0.28)',
  minuti: ['#c2e5bb', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8'],
  oltre: '#f08a24',
  zona: '#9a62d6',
  // zone per residenti a priorità massima: dal rosa chiaro al magenta di «massima» [conv. della preview]
  zonaScala: ['#fbd3e6', '#f08bbd', '#d6438f', '#a8156a'],
  // cause della priorità: caldo, fragilità, parchi scarsi o lontani, più cause insieme [conv. della preview]
  causa: ['#f0592b', '#9b6be0', '#2f8fd8', '#f5c542', 'rgba(150,156,152,0.35)'],
  caldo: ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'],
  carenza: ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'],
  puntoMassima: '#c51b7d',
  confine: '#ffffff',
  confineAlone: 'rgba(0,0,0,0.55)',
  fuori: 'rgba(110,116,112,0.28)',
  lineeAree: 'rgba(255,255,255,0.6)',
  bordoEdifici: 'rgba(0,0,0,0.3)',
  etichetta: '#ffffff',
  aloneEtichetta: 'rgba(0,30,12,0.85)',
  scelto: '#ffd400',
};

/** oggetti dei parchi */
export const OGGETTI = {
  sedutaOmbra: '#ffffff',
  sedutaSole: '#f2b134',
  fontanella: '#1d91c0',
  bagno: '#253494',
  verdeScuro: '#004d19',
};

/** sfumatura dell'ombra dei rifugi (uguale a scripts/prepara_dati.py) */
export const SFUMATURA_OMBRA = ['#ffe9a0', '#7fb36b', '#0f5132'];

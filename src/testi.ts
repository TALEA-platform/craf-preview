/**
 * Testi della preview in italiano e inglese. I numeri non stanno qui: vengono da `dati.json` e si inseriscono con le
 * funzioni del chiamante. Niente formule nei testi: le regole sono dette a parole.
 */
export type Lingua = 'it' | 'en';
export type Vista = 'residenti' | 'parchi' | 'vicinanza' | 'risultato';
export type Modo = 'piedi' | 'bici' | 'bus' | 'auto';
export type Causa = 'principale' | 'caldo' | 'fragilita' | 'parchi';

type Coppia = [string, string];

export interface Testi {
  titolo: string;
  sottotitolo: string;
  mappaBase: string;
  basi: { scuro: string; chiaro: string; orto: string };
  benvenuto: { titolo: string; testo: string[]; passi: string; nota: string; risultato: string; inizio: string };
  info: string;
  schede: Record<Vista, Coppia>;
  avanti: string;
  passo: (n: number, di: number) => string;
  residenti: {
    titolo: string;
    testo: string;
    strati: { densita: Coppia; fragilita: Coppia };
    numeri: { residenti: string; sezioni: string };
    testoFragilita: string;
    nota: string;
  };
  parchi: {
    titolo: string;
    testo: string;
    regola: string;
    migliori: string;
    tutti: string;
    scheda: { area: string; ombra: string; posti: (a: string, b: string) => string; fontanella: (n: number) => string; bagno: (n: number) => string };
    numeri: { parchi: string };
    nota: string;
    tabella: {
      titolo: string;
      sotto: string;
      cerca: string;
      colonne: { rango: string; nome: string; area: string; ombra: string; offerta: string; sedute: string; fontanelle: string; bagni: string };
      tutti: (n: number) => string;
      meno: string;
      nessuno: string;
    };
  };
  vicinanza: {
    titolo: string;
    testo: string;
    strati: { grandi: Coppia; minuti: Coppia };
    mezzo: string;
    modiChip: Record<Modo, string>;
    modi: Record<Modo, string>;
    numeri: { grandi: (m: string) => string; minuti: (m: string) => string };
    nota: string;
  };
  risultato: {
    titolo: string;
    testo: string;
    ingredienti: { titolo: string; righe: [string, string][] };
    strati: { priorita: Coppia; cause: Coppia; zone: Coppia; punti: Coppia };
    causa: { mostra: string; chip: Record<Causa, string>; titolo: string; nota: string };
    prioritarie: (n: string) => string;
    numeri: { massima: string; zone: (n: string) => string };
    nota: string;
  };
  legende: {
    parole5: string[];
    densita: Coppia;
    unitaDensita: string;
    fragilita: Coppia;
    offerta: Coppia;
    paroleOfferta: string[];
    ombra: Coppia;
    sole: string;
    ombraParola: string;
    oggetti: { sedutaOmbra: string; sedutaSole: string; tavolo: string; fontanella: string; bagno: string };
    minuti: string;
    grandi: string;
    minutiSotto: string;
    paroleMinuti: string[];
    priorita: Coppia;
    parolePriorita: string[];
    zone: Coppia;
    punti: Coppia;
    unPunto: string;
    edificioAbitato: string;
    edificioMassima: string;
    causa: Coppia;
    paroleCausa: string[];
    caldo: Coppia;
    fragilitaE: Coppia;
    carenza: Coppia;
    altroEdificio: string;
    zona: string;
    zonaPrioritaria: (n: string) => string;
    zonaConfine: string;
    nessunResidente: string;
    menoDi: string;
    oltre: string;
  };
  passaggio: { residentiHa: string; residenti: string; minuti: string; oltre: string; residentiMassima: string; allOmbra: string; offerta: string; dellaZona: string };
  circa: string;
  fonti: string;
  fontiTesto: string;
}

export const TESTI: Record<Lingua, Testi> = {
  it: {
    titolo: 'Rifugi climatici all’aperto di Bologna',
    sottotitolo: 'Parchi, residenti e vicinanza · anteprima dei risultati',
    mappaBase: 'Mappa di base',
    basi: { scuro: 'Scura', chiaro: 'Chiara', orto: 'Ortofoto' },
    benvenuto: {
      titolo: 'I parchi di Bologna come rifugi dal caldo',
      testo: [
        'Nelle estati calde i parchi sono rifugi climatici all’aperto: possono offrire ombra, posti a sedere, acqua e bagni.',
        'Il modello mette insieme, per ogni edificio abitato di Bologna, quattro elementi: il caldo intorno all’edificio, la fragilità dei residenti, la qualità dei parchi e quanto sono raggiungibili a piedi, in bici, in bus e in auto.',
        'Il risultato indica dove i residenti sono meno protetti dal caldo: lì servono parchi migliori, collegamenti migliori o nuovi rifugi climatici all’aperto.',
      ],
      passi: 'Il percorso in quattro passi',
      nota: 'È un’anteprima del lavoro in corso: l’applicazione completa, con il racconto e i dati in dettaglio, è in sviluppo.',
      risultato: 'Vai al risultato',
      inizio: 'Parti dall’inizio',
    },
    info: 'Il progetto',
    schede: {
      residenti: ['Residenti e fragilità', 'Densità e fragilità climatica'],
      parchi: ['Parchi', 'I rifugi climatici'],
      vicinanza: ['Vicinanza', 'Minuti ai parchi'],
      risultato: ['Il risultato', 'Chi è meno protetto'],
    },
    avanti: 'Avanti',
    passo: (n, di) => `Passo ${n} di ${di}`,
    residenti: {
      titolo: 'Residenti e fragilità climatica',
      testo: 'Residenti e fragilità vengono dal censimento Istat 2023 e si leggono per sezione di censimento, la zona più piccola per cui Istat pubblica i dati. Nel calcolo i residenti di ogni sezione sono poi divisi fra i suoi edifici abitabili, in proporzione al volume.',
      strati: {
        densita: ['Densità di residenti', 'Residenti per ettaro, per sezione di censimento'],
        fragilita: ['Fragilità al caldo', 'Per sezione di censimento'],
      },
      numeri: { residenti: 'residenti (Istat, censimento 2023)', sezioni: 'sezioni di censimento abitate' },
      testoFragilita: 'La fragilità al caldo unisce in parti uguali due elementi: la quota di residenti sotto i 5 anni o dai 75 anni in su, e il reddito (dove i redditi sono più bassi la fragilità è più alta). È un confronto con il resto di Bologna, non una misura assoluta.',
      nota: 'La densità usa tutta la superficie della sezione, strade, parchi e colline compresi: le sezioni con molto verde risultano quindi meno dense.',
    },
    parchi: {
      titolo: 'I parchi come rifugi climatici',
      testo: 'Un parco è un buon rifugio climatico quando offre ombra nelle ore più calde e posti a sedere all’ombra, con acqua e bagni dentro o vicino. La mappa colora ogni parco per il suo valore come rifugio: contano l’ombra, le sedute all’ombra, le fontanelle e i bagni.',
      regola: 'I cinque rifugi migliori sono i parchi con il valore più alto. Conta quanta ombra c’è in tutto: un parco grande, all’ombra per metà, offre più ombra di uno piccolo quasi tutto all’ombra.',
      migliori: 'I cinque rifugi migliori',
      tutti: 'Tutta la città',
      scheda: {
        area: 'di superficie',
        ombra: 'della superficie all’ombra nelle ore calde',
        posti: (a, b) => `${a} sedute e tavoli su ${b} all’ombra per più di metà delle ore calde`,
        fontanella: (n) => (n === 1 ? 'fontanella' : 'fontanelle'),
        bagno: (n) => (n === 1 ? 'bagno' : 'bagni'),
      },
      numeri: { parchi: 'parchi e giardini pubblici' },
      nota: 'Un parco si sceglie dalla lista o dalla tabella sotto la mappa. Per i cinque rifugi la mappa mostra anche l’ombra, con il dettaglio di mezzo metro, e le sedute, i tavoli, le fontanelle e i bagni usati nel calcolo.',
      tabella: {
        titolo: 'Tutti i parchi',
        sotto: 'In ordine di valore come rifugio climatico. Offerta di sedute: ogni seduta conta per la parte delle ore calde che passa all’ombra (un tavolo vale una seduta e mezza), un po’ meno dove mancano acqua o bagni. Una riga mostra il parco sulla mappa.',
        cerca: 'Cerca un parco',
        colonne: { rango: '#', nome: 'Parco', area: 'Superficie (ha)', ombra: 'All’ombra', offerta: 'Offerta d’ombra (m²)', sedute: 'Offerta di sedute', fontanelle: 'Fontanelle', bagni: 'Bagni' },
        tutti: (n) => `Mostra tutti i ${n} parchi`,
        meno: 'Mostra i primi 20',
        nessuno: 'Nessun parco con questo nome',
      },
    },
    vicinanza: {
      titolo: 'Quanto è vicino un parco',
      testo: 'Per ogni edificio abitato, i minuti fino al parco più vicino, oppure fino al parco più vicino di almeno mezzo ettaro. Il mezzo si sceglie qui sotto; nel risultato finale contano tutti e quattro.',
      strati: {
        minuti: ['Al parco più vicino', 'Qualunque giardino o parco'],
        grandi: ['A un parco di almeno mezzo ettaro', 'Esclusi i giardini più piccoli'],
      },
      mezzo: 'Mezzo',
      modiChip: { piedi: 'A piedi', bici: 'In bici', bus: 'In bus', auto: 'In auto' },
      modi: { piedi: 'a piedi', bici: 'in bici', bus: 'in bus', auto: 'in auto' },
      numeri: {
        grandi: (m) => `minuti ${m}: metà dei residenti ha un parco di almeno mezzo ettaro entro questo tempo`,
        minuti: (m) => `minuti ${m}: metà dei residenti ha un giardino o un parco entro questo tempo`,
      },
      nota: 'Un minuto «equivalente» è il tempo del tragitto, in cui salite e tratti al sole contano di più; in bus comprende anche il cammino fino alla fermata e l’attesa.',
    },
    risultato: {
      titolo: 'Dove i residenti sono meno protetti dal caldo',
      testo: 'Il risultato mette insieme, edificio per edificio, il caldo, la fragilità dei residenti e quello che offrono i parchi raggiungibili. La priorità è molto alta dove fa più caldo, vivono persone più fragili e i parchi vicini offrono poco o sono lontani. Lì si può intervenire migliorando la qualità dei parchi o i collegamenti per raggiungerli, oppure creando nuovi rifugi climatici all’aperto.',
      ingredienti: {
        titolo: 'Che cosa entra nel calcolo',
        righe: [
          ['Caldo', 'temperatura della superficie intorno all’edificio, estati 2017–2026'],
          ['Fragilità', 'bambini piccoli, anziani e reddito dei residenti'],
          ['Parchi', 'ombra e posti a sedere, con acqua e bagni'],
          ['Vicinanza', 'a piedi, in bici, in bus e in auto; l’offerta di ogni parco si divide fra tutti quelli che lo raggiungono'],
        ],
      },
      strati: {
        zone: ['Dove si concentrano', 'Zone con molti residenti a priorità molto alta'],
        punti: ['Quante persone', 'Un punto ogni 10 residenti a priorità molto alta'],
        priorita: ['Priorità per edificio', 'Dove mancano di più rifugi climatici'],
        cause: ['Cause', 'Che cosa alza la priorità, edificio per edificio'],
      },
      causa: {
        mostra: 'Mostra',
        chip: { principale: 'Causa principale', caldo: 'Caldo', fragilita: 'Fragilità', parchi: 'Carenza di parchi' },
        titolo: 'Residenti di Bologna per causa principale',
        nota: 'La causa principale è il fattore che, rispetto a un edificio tipico di Bologna, alza di più la priorità: deve contare per più di metà; se nessuno arriva a metà, le cause sono più d’una; se nessuno la alza, l’edificio è sotto quello tipico. Le altre tre mappe mostrano ogni fattore da solo, per tutti gli edifici abitati.',
      },
      prioritarie: (n) => `Le ${n} zone prioritarie`,
      numeri: { massima: 'residenti negli edifici a priorità molto alta', zone: (n) => `di loro vive in una delle ${n} zone` },
      nota: 'I parchi dei comuni vicini non sono ancora nel calcolo. In una prova che li stima, le zone tratteggiate, vicine al confine, perdono più di metà degli edifici a priorità molto alta.',
    },
    legende: {
      parole5: ['molto bassa', 'bassa', 'media', 'alta', 'molto alta'],
      densita: ['Densità di residenti', 'Residenti per ettaro, per sezione di censimento · ogni colore riunisce un quinto dei residenti'],
      unitaDensita: 'ab/ha',
      fragilita: ['Fragilità al caldo', 'Per sezione di censimento · ogni colore riunisce un quinto dei residenti'],
      offerta: ['Valore come rifugio climatico', 'Ombra e sedute all’ombra, con acqua e bagni, rispetto agli altri parchi · ogni colore copre un quinto della superficie dei parchi'],
      paroleOfferta: ['basso', 'medio-basso', 'medio', 'alto', 'molto alto'],
      ombra: ['Ombra fra le 12 e le 15', 'Giugno–agosto 2025 · dettaglio di mezzo metro'],
      sole: 'sempre al sole',
      ombraParola: 'sempre all’ombra',
      oggetti: { sedutaOmbra: 'seduta all’ombra', sedutaSole: 'seduta al sole', tavolo: 'tavolo', fontanella: 'fontanella', bagno: 'bagno' },
      minuti: 'Minuti al parco più vicino',
      grandi: 'Minuti al parco di almeno mezzo ettaro più vicino',
      minutiSotto: 'minuti equivalenti, per edificio abitato',
      paroleMinuti: ['meno di 2 min', '2–5 min', '5–10 min', '10–20 min', '20–30 min', 'oltre 30 min'],
      priorita: ['Priorità di intervento', 'Più alta dove fa più caldo, i residenti sono più fragili e i parchi offrono poco · «molto alta» riguarda il 10 % dei residenti di Bologna'],
      parolePriorita: ['bassa', 'medio-bassa', 'media', 'medio-alta', 'alta', 'molto alta'],
      zone: ['Residenti a priorità molto alta per zona', 'Le zone sono i gruppi di sezioni dove questi residenti si raccolgono'],
      punti: ['Dove vivono i residenti a priorità molto alta', 'I punti sono sparsi a caso sugli edifici a priorità molto alta di ogni sezione'],
      unPunto: '1 punto = 10 residenti',
      edificioAbitato: 'edificio abitato',
      edificioMassima: 'edificio a priorità molto alta',
      causa: ['Causa principale della priorità', 'Il fattore che alza di più la priorità, rispetto a un edificio tipico di Bologna'],
      paroleCausa: ['caldo', 'fragilità dei residenti', 'parchi scarsi o lontani', 'più cause insieme', 'nessuna: sotto un edificio tipico'],
      caldo: ['Esposizione al caldo', 'Temperatura della superficie intorno all’edificio, estati 2017–2026 · ogni colore riunisce un quinto dei residenti'],
      fragilitaE: ['Fragilità dei residenti', 'Bambini piccoli, anziani e reddito · ogni colore riunisce un quinto dei residenti'],
      carenza: ['Carenza di parchi', 'Poca ombra e poche sedute all’ombra raggiungibili · ogni colore riunisce un quinto dei residenti'],
      altroEdificio: 'altro edificio abitato',
      zona: 'zona',
      zonaPrioritaria: (n) => `zona prioritaria: le ${n} che, per residenti e livello di priorità, pesano da sole metà di tutte le zone`,
      zonaConfine: 'zona che può cambiare con i parchi oltre il confine',
      nessunResidente: 'nessun residente',
      menoDi: 'meno di',
      oltre: 'oltre',
    },
    passaggio: { residentiHa: 'residenti per ettaro', residenti: 'residenti', minuti: 'minuti', oltre: 'oltre 30', residentiMassima: 'residenti in edifici a priorità molto alta', allOmbra: 'all’ombra', offerta: 'di offerta d’ombra', dellaZona: 'dei residenti della zona' },
    circa: 'circa',
    fonti: 'Fonti',
    fontiTesto: 'Parchi, edifici (Carta tecnica comunale), aree statistiche e rete pedonale: open data del Comune di Bologna (CC BY 4.0). Fontanelle, bagni e sedute: Comune di Bologna (SIT e open data), con integrazioni da OpenStreetMap. Redditi: Comune di Bologna, redditi IRPEF per area statistica (CC BY 4.0). Ortofoto 2026: Comune di Bologna (ODbL). Residenti: Istat, censimento permanente 2023 su sezioni di censimento 2021 (CC BY 4.0). Usi degli edifici e percorsi: © OpenStreetMap contributors (ODbL). Rete bus: TPER, GTFS (CC BY 3.0 IT). Quote del terreno: Regione Emilia-Romagna, DTM 2023 (CC BY 4.0). Temperatura della superficie: stima a 10 m da dati satellitari Landsat e Sentinel-2. Ombra: modello digitale della superficie a 0,5 m dal rilievo LiDAR 2023 della Regione Emilia-Romagna. Mappe di base: OpenFreeMap, OpenMapTiles, © OpenStreetMap contributors.',
  },
  en: {
    titolo: 'Outdoor climate shelters of Bologna',
    sottotitolo: 'Parks, residents and proximity · preview of results',
    mappaBase: 'Base map',
    basi: { scuro: 'Dark', chiaro: 'Light', orto: 'Aerial' },
    benvenuto: {
      titolo: 'Bologna’s parks as shelters from the heat',
      testo: [
        'In hot summers, parks are outdoor climate shelters: they can offer shade, places to sit, water and toilets.',
        'For every inhabited building in Bologna, the model brings together four elements: the heat around the building, the residents’ vulnerability, the quality of the parks and how easily they can be reached on foot, by bike, by bus and by car.',
        'The result shows where residents are least protected from the heat: there, better parks, better connections or new outdoor climate shelters are needed.',
      ],
      passi: 'The path in four steps',
      nota: 'This is a preview of work in progress: the full application, with the story and the detailed data, is under development.',
      risultato: 'Go to the result',
      inizio: 'Start from the beginning',
    },
    info: 'The project',
    schede: {
      residenti: ['Residents and vulnerability', 'Density and climate vulnerability'],
      parchi: ['Parks', 'The climate shelters'],
      vicinanza: ['Proximity', 'Minutes to parks'],
      risultato: ['The result', 'Who is least protected'],
    },
    avanti: 'Next',
    passo: (n, di) => `Step ${n} of ${di}`,
    residenti: {
      titolo: 'Residents and climate vulnerability',
      testo: 'Residents and vulnerability come from the 2023 Istat census and are read by census section, the smallest area for which Istat publishes data. In the calculation the residents of each section are then divided among its habitable buildings, in proportion to their volume.',
      strati: {
        densita: ['Resident density', 'Residents per hectare, by census section'],
        fragilita: ['Heat vulnerability', 'By census section'],
      },
      numeri: { residenti: 'residents (Istat, 2023 census)', sezioni: 'inhabited census sections' },
      testoFragilita: 'Heat vulnerability combines two elements in equal parts: the share of residents under 5 or aged 75 and over, and income (where incomes are lower, vulnerability is higher). It is a comparison with the rest of Bologna, not an absolute measure.',
      nota: 'Density uses the whole surface of the section, streets, parks and hills included, so sections with a lot of greenery come out less dense.',
    },
    parchi: {
      titolo: 'Parks as climate shelters',
      testo: 'A park is a good climate shelter when it offers shade in the hottest hours and shaded places to sit, with water and toilets inside or nearby. The map colours each park by its value as a shelter: shade, shaded seats, drinking fountains and toilets all count.',
      regola: 'The five best shelters are the parks with the highest value. What counts is how much shade there is overall: a large park half in the shade offers more shade than a small one almost entirely shaded.',
      migliori: 'The five best shelters',
      tutti: 'Whole city',
      scheda: {
        area: 'in area',
        ombra: 'of the area in the shade in the hot hours',
        posti: (a, b) => `${a} of ${b} seats and tables in the shade for more than half of the hot hours`,
        fontanella: (n) => (n === 1 ? 'drinking fountain' : 'drinking fountains'),
        bagno: (n) => (n === 1 ? 'toilet' : 'toilets'),
      },
      numeri: { parchi: 'public parks and gardens' },
      nota: 'A park can be picked from the list or from the table below the map. For the five shelters the map also shows the shade, with half-metre detail, and the seats, tables, drinking fountains and toilets used in the calculation.',
      tabella: {
        titolo: 'All parks',
        sotto: 'Ordered by value as a climate shelter. Seating supply: each seat counts for the share of the hot hours it spends in the shade (a table counts as one and a half seats), a little less where water or toilets are missing. Selecting a row shows the park on the map.',
        cerca: 'Search for a park',
        colonne: { rango: '#', nome: 'Park', area: 'Area (ha)', ombra: 'In shade', offerta: 'Shade supply (m²)', sedute: 'Seating supply', fontanelle: 'Fountains', bagni: 'Toilets' },
        tutti: (n) => `Show all ${n} parks`,
        meno: 'Show the first 20',
        nessuno: 'No park with this name',
      },
    },
    vicinanza: {
      titolo: 'How close a park is',
      testo: 'For every inhabited building, the minutes to the nearest park, or to the nearest park of at least half a hectare. The mode is chosen below; in the final result all four count.',
      strati: {
        minuti: ['To the nearest park', 'Any garden or park'],
        grandi: ['To a park of at least half a hectare', 'The smallest gardens excluded'],
      },
      mezzo: 'Mode',
      modiChip: { piedi: 'On foot', bici: 'By bike', bus: 'By bus', auto: 'By car' },
      modi: { piedi: 'on foot', bici: 'by bike', bus: 'by bus', auto: 'by car' },
      numeri: {
        grandi: (m) => `minutes ${m}: half of residents have a park of at least half a hectare within this time`,
        minuti: (m) => `minutes ${m}: half of residents have a garden or park within this time`,
      },
      nota: 'An “equivalent” minute is the travel time, with slopes and sunny stretches counting more; by bus it also includes the walk to the stop and the wait.',
    },
    risultato: {
      titolo: 'Where residents are least protected from the heat',
      testo: 'The result brings together, building by building, the heat, the residents’ vulnerability and what the reachable parks offer. Priority is very high where it is hottest, residents are more vulnerable and nearby parks offer little or are far away. There, action can improve the quality of parks or the connections to reach them, or create new outdoor climate shelters.',
      ingredienti: {
        titolo: 'What goes into the calculation',
        righe: [
          ['Heat', 'land surface temperature around the building, summers 2017–2026'],
          ['Vulnerability', 'young children, older people and residents’ income'],
          ['Parks', 'shade and places to sit, with water and toilets'],
          ['Proximity', 'on foot, by bike, by bus and by car; each park’s supply is shared among everyone who can reach it'],
        ],
      },
      strati: {
        zone: ['Where they cluster', 'Zones with many very-high-priority residents'],
        punti: ['How many people', 'One dot per 10 very-high-priority residents'],
        priorita: ['Priority by building', 'Where climate shelters are most lacking'],
        cause: ['Causes', 'What raises priority, building by building'],
      },
      causa: {
        mostra: 'Show',
        chip: { principale: 'Main cause', caldo: 'Heat', fragilita: 'Vulnerability', parchi: 'Lack of parks' },
        titolo: 'Bologna’s residents by main cause',
        nota: 'The main cause is the factor that, compared with a typical building in Bologna, raises priority the most: it must account for more than half; if none reaches half, there are several causes; if none raises it, the building is below the typical one. The other three maps show each factor on its own, for all inhabited buildings.',
      },
      prioritarie: (n) => `The ${n} priority zones`,
      numeri: { massima: 'residents in very-high-priority buildings', zone: (n) => `of them live in one of the ${n} zones` },
      nota: 'Parks in neighbouring municipalities are not yet in the calculation. In a test that estimates them, the dashed zones, near the boundary, lose more than half of their very-high-priority buildings.',
    },
    legende: {
      parole5: ['very low', 'low', 'medium', 'high', 'very high'],
      densita: ['Resident density', 'Residents per hectare, by census section · each colour gathers one fifth of residents'],
      unitaDensita: 'residents/ha',
      fragilita: ['Heat vulnerability', 'By census section · each colour gathers one fifth of residents'],
      offerta: ['Value as a climate shelter', 'Shade and seats in the shade, with water and toilets, compared with the other parks · each colour covers one fifth of the park surface'],
      paroleOfferta: ['low', 'medium-low', 'medium', 'high', 'very high'],
      ombra: ['Shade between 12:00 and 15:00', 'June–August 2025 · half-metre detail'],
      sole: 'always in the sun',
      ombraParola: 'always in the shade',
      oggetti: { sedutaOmbra: 'seat in the shade', sedutaSole: 'seat in the sun', tavolo: 'table', fontanella: 'drinking fountain', bagno: 'toilet' },
      minuti: 'Minutes to the nearest park',
      grandi: 'Minutes to the nearest park of at least half a hectare',
      minutiSotto: 'equivalent minutes, per inhabited building',
      paroleMinuti: ['under 2 min', '2–5 min', '5–10 min', '10–20 min', '20–30 min', 'over 30 min'],
      priorita: ['Priority for action', 'Higher where it is hotter, residents are more vulnerable and parks offer little · “very high” covers 10% of Bologna’s residents'],
      parolePriorita: ['low', 'medium-low', 'medium', 'medium-high', 'high', 'very high'],
      zone: ['Highest-priority residents by zone', 'Zones are the groups of census sections where these residents cluster'],
      punti: ['Where very-high-priority residents live', 'Dots are placed at random on the very-high-priority buildings of each section'],
      unPunto: '1 dot = 10 residents',
      edificioAbitato: 'inhabited building',
      edificioMassima: 'very-high-priority building',
      causa: ['Main cause of priority', 'The factor that raises priority the most, compared with a typical building in Bologna'],
      paroleCausa: ['heat', 'residents’ vulnerability', 'few or distant parks', 'several causes', 'none: below a typical building'],
      caldo: ['Heat exposure', 'Land surface temperature around the building, summers 2017–2026 · each colour gathers one fifth of residents'],
      fragilitaE: ['Residents’ vulnerability', 'Young children, older people and income · each colour gathers one fifth of residents'],
      carenza: ['Lack of parks', 'Little shade and few shaded seats within reach · each colour gathers one fifth of residents'],
      altroEdificio: 'other inhabited building',
      zona: 'zone',
      zonaPrioritaria: (n) => `priority zone: the ${n} that, by residents and priority level, weigh as much as half of all zones`,
      zonaConfine: 'zone that may change with parks beyond the boundary',
      nessunResidente: 'no residents',
      menoDi: 'under',
      oltre: 'over',
    },
    passaggio: { residentiHa: 'residents per hectare', residenti: 'residents', minuti: 'minutes', oltre: 'over 30', residentiMassima: 'residents in very-high-priority buildings', allOmbra: 'in the shade', offerta: 'of shade supply', dellaZona: 'of the zone’s residents' },
    circa: 'about',
    fonti: 'Sources',
    fontiTesto: 'Parks, buildings (municipal technical map), statistical areas and pedestrian network: City of Bologna open data (CC BY 4.0). Drinking fountains, toilets and seats: City of Bologna (GIS and open data), with additions from OpenStreetMap. Income: City of Bologna, IRPEF income by statistical area (CC BY 4.0). Aerial photo 2026: City of Bologna (ODbL). Residents: Istat, permanent census 2023 on 2021 census sections (CC BY 4.0). Building uses and paths: © OpenStreetMap contributors (ODbL). Buses: TPER, GTFS (CC BY 3.0 IT). Terrain: Emilia-Romagna Region, DTM 2023 (CC BY 4.0). Land surface temperature: 10 m estimate from Landsat and Sentinel-2 satellite data. Shade: 0.5 m digital surface model from the 2023 LiDAR survey of the Emilia-Romagna Region. Base maps: OpenFreeMap, OpenMapTiles, © OpenStreetMap contributors.',
  },
};

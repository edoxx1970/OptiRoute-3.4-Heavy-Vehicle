# OptiRoute 3.0

Refactoring di OptiRoute 2.0 verso un gestionale di pianificazione giri.

## Cosa è già stato portato nella 3.0

- Importazione XLSX/CSV.
- Modello dati separato per spedizioni, mezzi e giri.
- Motore di ottimizzazione separato dalla UI.
- Peso e volume per veicolo.
- Limite km per giro.
- Priorità spedizione.
- Tempo di servizio per fermata.
- 2-opt.
- Prima fase di ottimizzazione con scambio tra giri.
- API server-side `/api/route` predisposta per routing stradale.
- Struttura Next.js compatibile con Vercel.

## Cosa NON è ancora da considerare production-ready

1. Geocoding browser: va spostato lato server e messo in cache/database.
2. `/api/route` usa OSRM pubblico come provider dimostrativo: per uso commerciale serve un provider/API con SLA o un'istanza dedicata.
3. La UI non ha ancora la mappa interattiva.
4. Mancano database, autenticazione, aziende, autisti, stato consegna e storico.
5. Il motore deve evolvere a VRP con time windows e matrice stradale reale.
6. I punti fissi sono conservati nella UI ma non sono ancora usati come vincolo di assegnazione nel nuovo motore: questa è una scelta deliberata per non replicare il limite rigido della 2.0 prima del modello dati definitivo.

## Avvio

```bash
npm install
npm run dev
```

## Deploy

Il progetto è strutturato per essere importato in GitHub e deployato su Vercel.

## Strategia

La 3.0 non sostituisce alla cieca la 2.0: il motore viene isolato e poi potenziato per incrementi testabili.


## 3.1
Fondazione backend PostgreSQL/Prisma e API per spedizioni, mezzi, autisti e pianificazioni.


## 3.2
Persistenza del piano, creazione atomica di giri/fermate e workflow dello stato consegna. Vedi `README-3.2.md`.


## 3.3
Routing stradale tramite matrice tempo/distanza e pianificazione vincolata. Vedi `README-3.3.md`.


## 3.4
Vincoli specifici per trasporto pesante, turni autisti, assegnazione mezzo/autista ed eccezioni. Vedi `README-3.4.md`.

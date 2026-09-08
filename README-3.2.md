# OptiRoute 3.2 — planning persistence & delivery workflow

La 3.2 collega il motore di pianificazione alla persistenza e introduce il primo ciclo operativo della consegna.

## Novità

### Pianificazione persistente
`POST /api/plans/optimize`:
1. riceve spedizioni geocodificate e vincoli;
2. usa il motore OptiRoute;
3. crea il piano;
4. crea i giri;
5. crea le fermate;
6. aggiorna lo stato delle spedizioni;
7. usa una transazione PostgreSQL.

### Operatività consegna
`PATCH /api/routes/{routeId}/stops/{stopId}/status`

Stati:
- pending
- en_route
- arrived
- delivered
- failed

### UI
La schermata planner ora ha un primo collegamento al gestionale per leggere mezzi, autisti e piani salvati.

## Criticità ancora aperte

- Autenticazione reale e isolamento per tenant.
- Le coordinate devono essere generate dal backend e cacheate.
- Il motore usa ancora una distanza geometrica con fattore strada come fallback.
- Il provider di routing deve essere sostituito/configurato con un servizio adatto alla produzione.
- Mancano finestre temporali realmente vincolanti nel solver.
- Mancano turni autista, pause, costi, restrizioni del mezzo e vincoli di accesso.
- Mappa operativa e navigazione devono essere integrate.

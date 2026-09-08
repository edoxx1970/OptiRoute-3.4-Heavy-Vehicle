# OptiRoute 3.1 — fondazione backend

La 3.1 aggiunge il modello persistente per trasformare il planner in un gestionale.

## Domini
- Azienda e utenti
- Spedizioni
- Mezzi
- Autisti
- Pianificazioni
- Giri
- Fermate

## API
- `GET /api/health`
- `GET|POST /api/shipments?companyId=...`
- `GET|POST /api/vehicles?companyId=...`
- `GET|POST /api/drivers?companyId=...`
- `GET|POST /api/plans?companyId=...`

## Database
PostgreSQL tramite Prisma. Configurare `DATABASE_URL`.

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

## Prossimo incremento
- autenticazione e autorizzazioni;
- collegamento UI ↔ database;
- geocoding server-side con cache;
- matrice routing reale;
- salvataggio atomico dei giri;
- assegnazione mezzo/autista;
- stato consegna e storico.

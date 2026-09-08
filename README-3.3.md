# OptiRoute 3.3 — real-road routing & constraint-aware planning

La 3.3 introduce il salto tecnico centrale: il motore non deve più stimare la rete stradale solo con distanza geometrica.

## Nuovo flusso

1. Spedizioni con coordinate.
2. Creazione della matrice stradale distanza/tempo.
3. Ottimizzazione tenendo conto di:
   - portata;
   - volume;
   - numero massimo di fermate;
   - distanza massima;
   - finestre orarie;
   - tempi di servizio;
   - ritorno al deposito.
4. Salvataggio atomico del piano, dei giri e delle fermate.
5. Spedizioni non assegnabili marcate come `exception`.

## Endpoint

`POST /api/plans/optimize-v33`

Il body minimo comprende:
- `companyId`
- `planDate`
- `depot: {lat, lon}`

Le spedizioni possono essere passate nel body oppure lette dal database.

## Routing

Il codice usa un provider compatibile con l'API OSRM `/table`. `ROUTING_URL` consente di sostituire il provider.

**Nota produzione:** l'endpoint demo pubblico di OSRM non deve essere considerato una garanzia SLA per un prodotto commerciale. In produzione va usato un servizio dedicato/self-hosted o un provider con contratto, limiti e affidabilità adeguati.

## Criticità ancora da risolvere prima della produzione

- geocoding server-side con normalizzazione indirizzi e cache;
- gestione reale delle finestre temporali (fusi, date, pause e attese);
- vincoli stradali per mezzi pesanti (altezza, peso, ZTL, divieti);
- turni autisti e pause;
- costi e KPI;
- autenticazione/ruoli/multi-tenant;
- audit log;
- retry/fallback del provider routing;
- ottimizzazione globale multi-giro più sofisticata (VRPTW/heterogeneous fleet);
- integrazione Google Maps/navigazione.

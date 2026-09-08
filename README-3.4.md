# OptiRoute 3.4 — heavy vehicle constraints

La 3.4 porta il planner verso l'uso reale nel trasporto pesante.

## Vincoli introdotti

- capacità di peso;
- capacità volumetrica;
- numero massimo fermate;
- turno autista;
- orario di fine giro;
- finestre orarie cliente;
- restrizioni del mezzo;
- distanza massima;
- scelta congiunta mezzo/autista;
- eccezioni esplicite quando una consegna non è compatibile.

## Endpoint

`POST /api/plans/optimize-heavy`

Il servizio:
1. legge spedizioni, mezzi e autisti;
2. genera una matrice stradale;
3. applica i vincoli;
4. assegna i carichi;
5. salva il piano/giri/fermate in una transazione.

## Punto critico

Le restrizioni stradali (altezza, peso, lunghezza, ZTL, divieti camion) non possono essere inventate dal solver. Devono provenire da un provider cartografico/routing che supporti profili camion o da dati aziendali verificati.

La 3.4 quindi crea l'architettura per tali vincoli; non dichiara che un normale OSRM demo conosca automaticamente tutti i divieti per camion.

## Prossimo step

3.5: geocoding robusto + profilo camion del routing + mappa operativa + drag/drop dei giri + apertura navigazione.

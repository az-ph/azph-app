# AZ-ph · App gestione Matrimoni

Preventivi, area Sposi e gestione dei Matrimoni di AZ-ph. Regole di sviluppo in `CLAUDE.md`.

## Configurazione (una volta sola)

**Segreti GitHub** (Settings → Secrets and variables → Actions, ambiente `produzione`):

| Segreto | Dove si trova |
| --- | --- |
| `SUPABASE_PROJECT_REF` | Supabase → Project Settings → General → Reference ID |
| `SUPABASE_DB_PASSWORD` | La password del database salvata alla creazione del progetto |
| `SUPABASE_ACCESS_TOKEN` | Supabase → Account → Access Tokens → Generate new token |

**Variabili Netlify**: vedi `.env.example`.

## Come si lavora

- Branch + pull request; `main` = produzione.
- Le migrazioni in `supabase/migrations/` vengono applicate dalla GitHub Action "Migrazioni database" al merge su `main`.
- Netlify pubblica a ogni push.

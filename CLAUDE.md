# AZ-ph · App gestione Matrimoni

App di AZ-ph (Alessandro Zaniboni, fotografo di matrimoni) che sostituisce il sistema Google Sheets + Apps Script dei preventivi.
La specifica completa è nel documento di progetto `claude/app-specifica-tecnica.md` (Project "[AZph] Overview" su claude.ai). Questo file riassume le regole che valgono sempre.

## Stack

- Next.js (App Router, TypeScript) su Netlify. Supabase (Postgres, Auth, Storage, Edge Functions), regione Frankfurt. Resend per le mail. Zod per ogni input.
- `main` = produzione. Lavorare su branch e aprire una pull request.

## Regole non negoziabili

1. **Privacy by design.**
   - Ogni nuova tabella, nella stessa migrazione: `enable row level security`, `grant` minimi espliciti (`authenticated` per l'area admin, mai `anon`), policy con `privato.is_admin()`. Il progetto Supabase non concede accessi automatici: senza grant la tabella è invisibile.
   - La pagina Sposi legge il database solo dal server (service role) e restituisce un elenco esplicito di campi. Mai `select *`, mai `note_private` o righe `nota_privata`, mai dati di altri matrimoni.
   - Nessun dato personale negli URL e nei log. Token dei link Sposi: 22+ caratteri casuali.
   - IP e user agent si salvano solo nell'accettazione del contratto. Il tracciamento della pagina (`evento_pagina`) non usa IP né cookie.
   - La service role key esiste solo lato server.
2. **Duplicabilità.** Niente di specifico di AZ-ph nel codice: marchio, testi, contratto, listino, zone e condizioni stanno in `impostazioni`, `voce_listino`, `modello_messaggio`, `contratto_versione`.
3. **Migrazioni solo in avanti** in `supabase/migrations/`, mai modificare una migrazione già su `main`. Le applica la GitHub Action `migrazioni.yml`.
4. **Importi in centesimi** (`integer`). Date gg.mm.aaaa e orari hh.mm nell'interfaccia.
5. **Contratto e accettazioni sono immutabili** (trigger nel database).
6. Niente invii automatici agli Sposi oltre alla mail di conferma: il resto nasce come bozza.

## Stile dei testi verso gli Sposi

"Matrimonio" e "Sposi" sempre maiuscoli; si dà del voi. Colori: salvia `#9caf88`, verde scuro `#62744f`, tinta `#e2e9da`, antracite `#383838`. Font: Playfair Display (titoli, prezzi), Jost (testo).

## Comandi

- `npm run dev` · `npm run build` · `npm run lint` · `npm test` (Vitest)
- `npx supabase migration new <nome>` per una nuova migrazione.

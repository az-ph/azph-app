"use client";

import { useState, useTransition } from "react";
import { PROVINCE, dividiIndirizzo, indirizzoValido, unisciIndirizzo, type Indirizzo } from "@/lib/sposi/indirizzo";
import { salvaIndirizzi } from "./azioni";

type Sposo = { nome: string; telefono: string; email: string; codice_fiscale: string; indirizzo: string; indirizzo_preparativi: string };

/** Codice fiscale parzialmente nascosto: la pagina è raggiungibile da chiunque abbia il link. */
function cfNascosto(cf: string): string {
  return cf.length === 16 ? `${cf.slice(0, 6)}••••••••${cf.slice(14)}` : cf;
}

/** Area Sposi: i dati inseriti alla conferma e l'indirizzo dei preparativi, da completare prima del Matrimonio. */
export function DatiSposi({ token, sposi, modificabile }: { token: string; sposi: Sposo[]; modificabile: boolean }) {
  const [valori, setValori] = useState<Indirizzo[]>(() => [0, 1].map((i) => dividiIndirizzo(sposi[i]?.indirizzo_preparativi ?? "")));
  const [cf, setCf] = useState(["", ""]);
  const [msg, setMsg] = useState<{ ok: boolean; testo: string } | null>(null);
  const [inCorso, avvia] = useTransition();

  const imposta = (i: number, patch: Partial<Indirizzo>) => setValori(valori.map((v, j) => (j === i ? { ...v, ...patch } : v)));

  function salva() {
    setMsg(null);
    if (cf.some((c) => c.trim() && !/^[A-Z0-9]{16}$/.test(c.replace(/\s/g, "").toUpperCase()))) {
      setMsg({ ok: false, testo: "Il codice fiscale deve avere 16 caratteri." });
      return;
    }
    if (valori.some((v) => !indirizzoValido(v))) {
      setMsg({ ok: false, testo: "Completate ogni indirizzo iniziato: via, CAP di 5 cifre, località e provincia." });
      return;
    }
    avvia(async () => {
      const r = await salvaIndirizzi(token, { sposi: valori.map((v, i) => ({ indirizzo_preparativi: unisciIndirizzo(v), codice_fiscale: cf[i] })) });
      if (r.ok) setCf(["", ""]);
      setMsg(r.ok ? { ok: true, testo: "Salvato, grazie!" } : { ok: false, testo: r.errore ?? "Errore" });
    });
  }

  return (
    <section id="azp-dati">
      <div className="wrap">
        <p className="sez">I vostri dati</p>
        <h2>Dati e preparativi</h2>
        <p>Questi sono i dati che mi avete lasciato. Se qualcosa è cambiato scrivetemi.
          {modificabile && " L’indirizzo dei preparativi inseritelo qualche settimana prima del Matrimonio, se vi preparate fuori dalla location."}</p>
        <div className="sposi">
          {[0, 1].map((i) => {
            const s = sposi[i];
            if (!s) return null;
            const v = valori[i];
            const righe = ([["Telefono", s.telefono], ["Email", s.email], ["Codice fiscale", cfNascosto(s.codice_fiscale)], ["Residenza", s.indirizzo]] as [string, string][])
              .filter(([, x]) => x);
            return (
              <fieldset key={i}>
                <legend>{s.nome || `Sposa/o ${i + 1}`}</legend>
                <dl className="dati-sposo">{righe.map(([k, x]) => <div key={k}><dt>{k}</dt><dd>{x}</dd></div>)}</dl>
                {modificabile && (
                  <label className="campo"><span>Codice fiscale da correggere</span>
                    <input type="text" maxLength={16} autoComplete="off" placeholder="Solo se va cambiato" value={cf[i]}
                      onChange={(e) => setCf(cf.map((c, j) => (j === i ? e.target.value.toUpperCase() : c)))} />
                  </label>
                )}
                <div className="campo ind"><span>Indirizzo dei preparativi</span>
                  <div className="ind-griglia">
                    <input type="text" placeholder="Via e numero civico" value={v.via} disabled={!modificabile} onChange={(e) => imposta(i, { via: e.target.value })} />
                    <input type="text" placeholder="CAP" inputMode="numeric" maxLength={5} value={v.cap} disabled={!modificabile} onChange={(e) => imposta(i, { cap: e.target.value })} />
                    <input type="text" placeholder="Località" value={v.loc} disabled={!modificabile} onChange={(e) => imposta(i, { loc: e.target.value })} />
                    <select aria-label="Provincia" value={v.prov} disabled={!modificabile} onChange={(e) => imposta(i, { prov: e.target.value })}>
                      <option value="">Prov.</option>{PROVINCE.map((p) => <option key={p}>{p}</option>)}<option value="EE">Estero</option>
                    </select>
                  </div>
                  <small className="nota-campo">Lasciate vuoto se vi preparate in location</small>
                </div>
              </fieldset>
            );
          })}
        </div>
        {modificabile && (
          <button className="cta" type="button" onClick={salva} disabled={inCorso}>{inCorso ? "Salvataggio…" : "Salva"}</button>
        )}
        {msg && <p className={msg.ok ? "salvato" : "errore"} role="status">{msg.testo}</p>}
      </div>
    </section>
  );
}

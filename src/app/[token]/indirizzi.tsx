"use client";

import { useState, useTransition } from "react";
import { PROVINCE, dividiIndirizzo, indirizzoValido, unisciIndirizzo, type Indirizzo } from "@/lib/sposi/indirizzo";
import { salvaIndirizzi } from "./azioni";

type Sposo = { nome: string; indirizzo: string; indirizzo_preparativi: string };

export function Indirizzi({ token, sposi, modificabile }: { token: string; sposi: Sposo[]; modificabile: boolean }) {
  const [valori, setValori] = useState(() => [0, 1].map((i) => ({
    residenza: dividiIndirizzo(sposi[i]?.indirizzo ?? ""), preparativi: dividiIndirizzo(sposi[i]?.indirizzo_preparativi ?? ""),
  })));
  const [msg, setMsg] = useState<{ ok: boolean; testo: string } | null>(null);
  const [inCorso, avvia] = useTransition();
  const mancano = sposi.some((s) => !s.indirizzo);

  const imposta = (i: number, k: "residenza" | "preparativi", patch: Partial<Indirizzo>) =>
    setValori(valori.map((v, j) => (j === i ? { ...v, [k]: { ...v[k], ...patch } } : v)));

  function salva() {
    setMsg(null);
    if (valori.some((v) => !indirizzoValido(v.residenza) || !indirizzoValido(v.preparativi))) {
      setMsg({ ok: false, testo: "Completate ogni indirizzo iniziato: via, CAP di 5 cifre, località e provincia." });
      return;
    }
    avvia(async () => {
      const r = await salvaIndirizzi(token, {
        sposi: valori.map((v) => ({ indirizzo: unisciIndirizzo(v.residenza), indirizzo_preparativi: unisciIndirizzo(v.preparativi) })),
      });
      setMsg(r.ok ? { ok: true, testo: "Indirizzi salvati, grazie!" } : { ok: false, testo: r.errore ?? "Errore" });
    });
  }

  const campo = (i: number, k: "residenza" | "preparativi", etichetta: string, nota?: string) => {
    const v = valori[i][k];
    return (
      <div className="campo ind"><span>{etichetta}</span>
        <div className="ind-griglia">
          <input type="text" placeholder="Via e numero civico" value={v.via} disabled={!modificabile} onChange={(e) => imposta(i, k, { via: e.target.value })} />
          <input type="text" placeholder="CAP" inputMode="numeric" maxLength={5} value={v.cap} disabled={!modificabile} onChange={(e) => imposta(i, k, { cap: e.target.value })} />
          <input type="text" placeholder="Località" value={v.loc} disabled={!modificabile} onChange={(e) => imposta(i, k, { loc: e.target.value })} />
          <select aria-label="Provincia" value={v.prov} disabled={!modificabile} onChange={(e) => imposta(i, k, { prov: e.target.value })}>
            <option value="">Prov.</option>{PROVINCE.map((p) => <option key={p}>{p}</option>)}<option value="EE">Estero</option>
          </select>
        </div>
        {nota && <small className="nota-campo">{nota}</small>}
      </div>
    );
  };

  return (
    <section id="azp-dati">
      <div className="wrap">
        <p className="sez">I vostri dati</p>
        <h2>Indirizzi</h2>
        {mancano && modificabile && <p>Mi servono per la fattura e per organizzare i preparativi: inseriteli quando volete.</p>}
        <div className="sposi">
          {[0, 1].map((i) => (
            <fieldset key={i}>
              <legend>{sposi[i]?.nome || `Sposa/o ${i + 1}`}</legend>
              {campo(i, "residenza", "Indirizzo di residenza")}
              {campo(i, "preparativi", "Indirizzo dei preparativi", "Lasciate vuoto se vi preparate in location")}
            </fieldset>
          ))}
        </div>
        {modificabile && (
          <button className="cta" type="button" onClick={salva} disabled={inCorso}>{inCorso ? "Salvataggio…" : "Salva gli indirizzi"}</button>
        )}
        {msg && <p className={msg.ok ? "salvato" : "errore"} role="status">{msg.testo}</p>}
      </div>
    </section>
  );
}

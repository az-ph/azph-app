"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DatiPagina } from "@/lib/sposi/componi";
import { albumRisposta, albumSelezione } from "./azioni";

type Album = NonNullable<DatiPagina["album"]>;

const gg = (iso: string | null) => (iso ? new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso)).replace(/\//g, ".") : "");

/** Area Sposi: istruzioni per l'album, selezione e copertina, anteprima da approvare. */
export function SezioneAlbum({ token, a, galleria, solaLettura }: { token: string; a: Album; galleria: string; solaLettura: boolean }) {
  return (
    <section id="azp-anteprima">
      <div className="wrap">
        {a.sopratitolo && <p className="sez">{a.sopratitolo}</p>}
        <h2>{a.titolo}</h2>
        {(a.fase === "istruzioni" || a.fase === "selezione") && <Istruzioni a={a} galleria={galleria} />}
        {(a.fase === "istruzioni" || (a.fase === "selezione" && a.modificabile)) && !solaLettura && <Selezione token={token} a={a} />}
        {a.fase === "selezione" && (
          <div className="ok"><p><b>Selezione ricevuta il {gg(a.selezioneIl)}</b>{a.copertinaTesto ? ` · copertina: ${a.copertinaTesto}` : ""}.</p>
            <p>Sto preparando l’impaginazione: quando è pronta la trovate qui, in questa pagina.</p></div>
        )}
        {(a.fase === "anteprima" || a.fase === "modifiche" || a.fase === "approvato") && <Anteprima token={token} a={a} solaLettura={solaLettura} />}
      </div>
    </section>
  );
}

function Istruzioni({ a, galleria }: { a: Album; galleria: string }) {
  return (
    <>
      {a.intro && <p>{a.intro}</p>}
      {a.passi.length > 0 && <ol className="passi">{a.passi.map(([t, d], i) => <li key={i}><b>{t}</b><p>{d}</p></li>)}</ol>}
      {galleria && (
        <div className="gallerie" style={{ margin: "0 0 1.5rem" }}>
          <a className="btn-gal" href={galleria} target="_blank" rel="noopener noreferrer">Apri la vostra galleria UpYourShoot</a>
        </div>
      )}
      {a.note.map((n, i) => <p key={i} className="nota-campo">{n}</p>)}
    </>
  );
}

function Selezione({ token, a }: { token: string; a: Album }) {
  const router = useRouter();
  const [fatta, setFatta] = useState(!!a.selezioneIl);
  const [cop, setCop] = useState(a.copertina || (a.copertine.length === 1 ? a.copertine[0].valore : ""));
  const [notaCop, setNotaCop] = useState(a.copertinaNota);
  const [note, setNote] = useState(a.noteSposi);
  const [msg, setMsg] = useState<{ ok: boolean; testo: string } | null>(null);
  const [inCorso, avvia] = useTransition();
  const scelta = a.copertine.find((c) => c.valore === cop);

  function invia() {
    setMsg(null);
    if (!fatta) return setMsg({ ok: false, testo: "Spuntate la casella quando avete finito la selezione." });
    if (!cop) return setMsg({ ok: false, testo: "Scegliete la copertina." });
    if (scelta?.nota && !notaCop.trim()) return setMsg({ ok: false, testo: `Manca un’indicazione: ${scelta.nota.toLowerCase()}.` });
    avvia(async () => {
      const r = await albumSelezione(token, { fatta, copertina: cop, copertinaNota: notaCop, note });
      setMsg(r.ok ? { ok: true, testo: "Ricevuto, grazie! Vi scrivo quando l’impaginazione è pronta." } : { ok: false, testo: r.errore ?? "Errore" });
      if (r.ok) router.refresh();
    });
  }

  const corpo = (
    <>
      <label className="scelta"><input type="checkbox" checked={fatta} onChange={(e) => setFatta(e.target.checked)} />
        <span>Abbiamo segnato con il cuore le foto per l’album nella galleria</span></label>
      <fieldset>
        <legend>Copertina e box</legend>
        {a.copertine.length > 1 ? a.copertine.map((c) => (
          <label key={c.valore} className="scelta"><input type="radio" name="copertina" value={c.valore} checked={cop === c.valore} onChange={() => setCop(c.valore)} />
            <span>{c.etichetta}</span></label>
        )) : null}
        {scelta?.nota && (
          <label className="campo"><span>{scelta.nota}</span>
            <input type="text" maxLength={500} value={notaCop} onChange={(e) => setNotaCop(e.target.value)} /></label>
        )}
      </fieldset>
      <label className="campo larga"><span>Note (facoltative)</span>
        <textarea rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <button className="cta" type="button" onClick={invia} disabled={inCorso}>{inCorso ? "Invio…" : a.selezioneIl ? "Aggiorna la scelta" : "Selezione fatta"}</button>
      {msg && <p className={msg.ok ? "salvato" : "errore"} role="status">{msg.testo}</p>}
    </>
  );
  return a.selezioneIl ? <details style={{ margin: "1rem 0 1.5rem", maxWidth: "52rem" }}><summary>Cambia la selezione o la copertina</summary>{corpo}</details> : corpo;
}

function Anteprima({ token, a, solaLettura }: { token: string; a: Album; solaLettura: boolean }) {
  const router = useRouter();
  const [modifiche, setModifiche] = useState(false);
  const [conferma, setConferma] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; testo: string } | null>(null);
  const [inCorso, avvia] = useTransition();

  function rispondi(approva: boolean) {
    setMsg(null);
    if (!approva && !note.trim()) return setMsg({ ok: false, testo: "Scrivete cosa vorreste cambiare." });
    avvia(async () => {
      const r = await albumRisposta(token, { approva, note, versione: a.anteprimaIl });
      setMsg(r.ok ? { ok: true, testo: approva ? "Grazie! Invio l’album in stampa." : "Ricevuto, vi mando la nuova versione appena pronta." } : { ok: false, testo: r.errore ?? "Errore" });
      if (r.ok) router.refresh();
    });
  }

  return (
    <>
      {a.fase === "approvato" && <div className="ok"><p><b>Impaginazione approvata il {gg(a.approvatoIl)}.</b></p><p>L’album è in stampa: la consegna avviene in circa 3 settimane.</p></div>}
      {a.fase === "modifiche" && <div className="ok"><p><b>Modifiche richieste il {gg(a.modificheIl)}.</b></p><p>Vi mando la nuova versione appena pronta, qui in questa pagina.</p></div>}
      {a.fase === "anteprima" && <p>Ecco l’anteprima dell’impaginazione. Guardatela con calma: potete approvarla o chiedermi modifiche.</p>}
      {a.anteprimaUrl ? (
        <>
          <div className="ant-viewer">
            {a.anteprimaPdf
              ? <iframe src={a.anteprimaUrl} title="Anteprima dell’album" />
              // eslint-disable-next-line @next/next/no-img-element
              : <img src={a.anteprimaUrl} alt="Anteprima dell’album" style={{ width: "100%", height: "100%", objectFit: "contain" }} />}
          </div>
          <p className="ant-apri"><a href={a.anteprimaUrl} target="_blank" rel="noopener noreferrer">Apri a tutto schermo</a><span>versione del {gg(a.anteprimaIl)}</span></p>
        </>
      ) : <p className="errore">Anteprima non disponibile in questo momento: ricaricate la pagina tra poco.</p>}
      {a.fase === "anteprima" && !solaLettura && (
        <>
          <div className="ant-bottoni">
            <button className="cta" type="button" disabled={inCorso} onClick={() => { setConferma(true); setModifiche(false); }}>Approvo l’impaginazione</button>
            <button className="cta secondario" type="button" disabled={inCorso} onClick={() => { setModifiche(!modifiche); setConferma(false); }}>Chiedo delle modifiche</button>
          </div>
          {conferma && (
            <>
              <p style={{ marginTop: "1.25rem" }}>Con l’ok l’album va in stampa così com’è: confermate?</p>
              <button className="cta" type="button" disabled={inCorso} onClick={() => rispondi(true)}>{inCorso ? "Invio…" : "Sì, approvo e mando in stampa"}</button>
            </>
          )}
          {modifiche && (
            <>
              <label className="campo larga"><span>Cosa vorreste cambiare? (indicate pagina e foto)</span>
                <textarea rows={5} maxLength={3000} value={note} onChange={(e) => setNote(e.target.value)} /></label>
              <button className="cta" type="button" disabled={inCorso} onClick={() => rispondi(false)}>{inCorso ? "Invio…" : "Invia le modifiche"}</button>
            </>
          )}
          {msg && <p className={msg.ok ? "salvato" : "errore"} role="status">{msg.testo}</p>}
        </>
      )}
    </>
  );
}

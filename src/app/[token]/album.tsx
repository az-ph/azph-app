"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DatiPagina } from "@/lib/sposi/componi";
import { albumRisposta, albumScelta, albumSelezione } from "./azioni";
import { legataA, type VoceOfferta } from "@/lib/listino/motore";
import { Card, PrezzoCard } from "./preventivo";
import { Paragrafi, euroTesto } from "./testo";

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

/** Dopo la consegna delle foto: gli Sposi senza album possono sceglierlo qui. */
export function ProponiAlbum({ token, testi, voci }: { token: string; testi: { sopratitolo: string; titolo: string; corpo: string }; voci: VoceOfferta[] }) {
  const router = useRouter();
  const album = voci.filter((v) => v.categoria === "album");
  const repliche = voci.filter((v) => v.categoria === "replica");
  const [scelto, setScelto] = useState<string | null>(album.length === 1 ? album[0].codice : null);
  const [qta, setQta] = useState<Record<string, number>>({});
  const [conferma, setConferma] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; testo: string } | null>(null);
  const [inCorso, avvia] = useTransition();

  const voce = album.find((v) => v.codice === scelto);
  const attive = repliche.filter((r) => scelto && legataA(r, scelto));
  const totale = (voce?.prezzo ?? 0) + attive.reduce((t, r) => t + r.prezzo * (qta[r.codice] ?? 0), 0);

  function invia() {
    setMsg(null);
    avvia(async () => {
      const r = await albumScelta(token, { album: scelto, qta: Object.fromEntries(attive.map((x) => [x.codice, qta[x.codice] ?? 0])), totale });
      setMsg(r.ok ? { ok: true, testo: "Grazie! Qui sotto trovate subito le istruzioni per la selezione e la copertina." } : { ok: false, testo: r.errore ?? "Errore" });
      if (r.ok) router.refresh();
    });
  }

  return (
    <section className="banda" id="azp-album">
      <div className="wrap">
        {testi.sopratitolo && <p className="sez">{testi.sopratitolo}</p>}
        <h2>{testi.titolo}</h2>
        <Paragrafi testo={testi.corpo} />
        <div className="opzioni due">
          {album.map((v) => <Card key={v.codice} v={v} attiva={scelto === v.codice} disabilitata={inCorso} onClick={() => { setScelto(scelto === v.codice ? null : v.codice); setConferma(false); }} />)}
          {repliche.map((r) => {
            const attiva = !!scelto && legataA(r, scelto);
            const q = attiva ? (qta[r.codice] ?? 0) : 0;
            const cambia = (d: number) => { setQta({ ...qta, [r.codice]: Math.max(0, Math.min(10, q + d)) }); setConferma(false); };
            return (
              <div key={r.codice} className={`opz${q ? " on" : ""}`} style={{ cursor: "default" }}>
                <span className="voce">{r.voce}</span>
                <span className="euro"><PrezzoCard v={r} suffisso={<small> cad.</small>} /></span>
                {r.descrizione && <span className="desc">{r.descrizione}</span>}
                <div className="qta">
                  <button type="button" disabled={!attiva || !q || inCorso} onClick={() => cambia(-1)} aria-label="Una copia in meno">−</button>
                  <output>{q}</output>
                  <button type="button" disabled={!attiva || q >= 10 || inCorso} onClick={() => cambia(1)} aria-label="Una copia in più">+</button>
                  <span className="stato">{attiva ? "" : "Disponibile scegliendo l’album"}</span>
                </div>
              </div>
            );
          })}
        </div>
        {!conferma ? (
          <button className="cta" type="button" disabled={!voce || inCorso} onClick={() => setConferma(true)}>
            {voce ? `Scelgo l’album - ${euroTesto(totale)}` : "Selezionate l’album"}</button>
        ) : (
          <>
            <p style={{ marginTop: "1.25rem" }}>Confermate {voce?.voce}{attive.some((r) => qta[r.codice]) ? " con le repliche indicate" : ""}, per {euroTesto(totale)}? Si salda alla consegna dell’album.</p>
            <div className="ant-bottoni">
              <button className="cta" type="button" disabled={inCorso} onClick={invia}>{inCorso ? "Invio…" : "Sì, confermo"}</button>
              <button className="cta secondario" type="button" disabled={inCorso} onClick={() => setConferma(false)}>Annulla</button>
            </div>
          </>
        )}
        {msg && <p className={msg.ok ? "salvato" : "errore"} role="status">{msg.testo}</p>}
      </div>
    </section>
  );
}

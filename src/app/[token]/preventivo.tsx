"use client";

import { useMemo, useState, useTransition } from "react";
import { selezione, importiConferma, type Offerta, type VoceOfferta, ErroreSelezione } from "@/lib/listino/motore";
import { euro, euroBreve } from "@/lib/formato";
import { conferma, traccia } from "./azioni";
import { Contratto } from "./testo";
import type { Blocco } from "@/lib/sposi/componi";

type SposoForm = { nome: string; telefono: string; email: string; codice_fiscale: string; indirizzo: string; indirizzo_preparativi: string };

export function Preventivo(props: {
  token: string;
  offerta: Offerta;
  servizioSenzaVideo: number | null;
  preselezione: string[];
  sposi: (SposoForm & { ordine: number; consenso_promo: boolean })[];
  titoli: { opzionali?: Blocco; album?: Blocco };
  contratto: string;
  videomaker: string | null;
}) {
  const { offerta, token } = props;
  const duo = !!offerta.duo;
  const voci = offerta.voci;
  const opzionali = voci.filter((v) => v.categoria === "extra" || v.categoria === "prewedding");
  const omaggi = voci.filter((v) => v.categoria === "omaggio");
  const album = voci.filter((v) => v.categoria === "album");
  const repliche = voci.filter((v) => v.categoria === "replica");
  const basiVideo = voci.filter((v) => v.categoria === "video-base");
  const extraVideo = voci.filter((v) => v.categoria === "video");

  const [scelti, setScelti] = useState<Set<string>>(() => new Set(props.preselezione.filter((c) => voci.some((v) => v.codice === c))));
  const [qta, setQta] = useState<Record<string, number>>({});
  const [video, setVideo] = useState<string | null>(duo ? (basiVideo[0]?.codice ?? null) : null);

  const conVideo = !duo || !!video;
  const servizio = duo && !video && props.servizioSenzaVideo !== null ? props.servizioSenzaVideo : offerta.servizio.prezzo;

  const calcolo = useMemo(() => {
    try {
      const sel = selezione(voci, { extra: [...scelti], qta, video });
      const imp = importiConferma({ ...offerta, servizio: { ...offerta.servizio, prezzo: servizio } }, sel);
      return { sel, imp, errore: null as string | null };
    } catch (e) {
      return { sel: null, imp: null, errore: e instanceof ErroreSelezione ? e.message : "Selezione non valida" };
    }
  }, [voci, scelti, qta, video, offerta, servizio]);

  function cambia(v: VoceOfferta) {
    if (v.incluso) return;
    setScelti((prec) => {
      const n = new Set(prec);
      const attiva = !n.has(v.codice);
      if (attiva) {
        // Voci dello stesso gruppo (e gli album) si escludono a vicenda.
        for (const altra of voci) {
          if (altra.codice !== v.codice && ((v.gruppo && altra.gruppo === v.gruppo) || (v.categoria === "album" && altra.categoria === "album"))) n.delete(altra.codice);
        }
        n.add(v.codice);
      } else n.delete(v.codice);
      void traccia(token, v.codice, attiva);
      return n;
    });
  }

  return (
    <>
      <section className="px-6 py-10 bg-salvia text-white">
        <div className="max-w-3xl mx-auto flex items-end justify-between gap-6">
          <div>
            <p className="uppercase tracking-[0.2em] text-xs opacity-80">{duo ? "Pacchetto foto + video" : offerta.formula ? "Servizio fotografico" : ""}</p>
            <p className="font-serif text-4xl">{euroBreve(servizio)}</p>
            {offerta.servizio.barrato > 0 && (!duo || video) && <p className="line-through opacity-70">{euroBreve(offerta.servizio.barrato)}</p>}
          </div>
          {omaggi.length > 0 && (
            <ul className="text-sm text-right">{omaggi.map((o) => <li key={o.codice}>{o.voce} · <b>omaggio</b></li>)}</ul>
          )}
        </div>
      </section>

      {opzionali.length > 0 && (
        <Blocchetto b={props.titoli.opzionali} titolo="Rendetelo vostro">
          <div className="grid gap-3 sm:grid-cols-2">
            {opzionali.map((v) => <Scheda key={v.codice} v={v} attiva={scelti.has(v.codice) || v.incluso} onClick={() => cambia(v)} />)}
          </div>
        </Blocchetto>
      )}

      {album.length > 0 && (
        <Blocchetto b={props.titoli.album} titolo="Wedding album" banda>
          <div className="grid gap-3 sm:grid-cols-2">
            {album.map((v) => <Scheda key={v.codice} v={v} attiva={scelti.has(v.codice)} onClick={() => cambia(v)} />)}
          </div>
          {repliche.filter((r) => scelti.has(r.collegataA ?? "")).map((r) => (
            <label key={r.codice} className="flex items-center gap-3 mt-4">
              <span>{r.voce} ({euroBreve(r.prezzo)} cad.)</span>
              <input type="number" min={0} max={10} value={qta[r.codice] ?? 0} className="w-16 border rounded px-2 py-1"
                onChange={(e) => setQta({ ...qta, [r.codice]: Math.max(0, Math.min(10, Number(e.target.value) || 0)) })} />
            </label>
          ))}
        </Blocchetto>
      )}

      {basiVideo.length > 0 && (
        <Blocchetto titolo={duo ? "Il video" : "Video"} sopratitolo={props.videomaker ? `con ${props.videomaker}` : "Opzionale"}>
          <div className="grid gap-3 sm:grid-cols-2">
            {basiVideo.map((v) => (
              <Scheda key={v.codice} v={v} attiva={video === v.codice}
                onClick={() => { const nuovo = video === v.codice ? null : v.codice; setVideo(nuovo); void traccia(token, v.codice, !!nuovo); }} />
            ))}
          </div>
          {video && extraVideo.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 mt-3">
              {extraVideo.map((v) => <Scheda key={v.codice} v={v} attiva={scelti.has(v.codice)} onClick={() => cambia(v)} />)}
            </div>
          )}
          {duo && !video && <p className="mt-3 text-sm">Senza video il servizio fotografico torna a prezzo pieno.</p>}
          <p className="mt-3 text-xs opacity-70">Contratto e pagamenti del video sono direttamente con il videomaker.</p>
        </Blocchetto>
      )}

      <FormConferma {...props} calcolo={calcolo} servizio={servizio} video={video} scelti={scelti} qta={qta} conVideo={conVideo} />

      <div className="sticky bottom-0 bg-antracite text-white px-6 py-3">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <span>Totale servizi fotografici <b className="font-serif text-xl ml-2">{calcolo.imp ? euro(calcolo.imp.totaleFoto) : "—"}</b>
            {calcolo.imp && calcolo.imp.totaleVideo > 0 && <span className="text-sm opacity-80"> + video {euro(calcolo.imp.totaleVideo)}</span>}</span>
          <a href="#conferma" className="underline">Conferma</a>
        </div>
      </div>
    </>
  );
}

function FormConferma(props: Parameters<typeof Preventivo>[0] & {
  calcolo: { sel: ReturnType<typeof selezione> | null; imp: ReturnType<typeof importiConferma> | null; errore: string | null };
  servizio: number; video: string | null; scelti: Set<string>; qta: Record<string, number>; conVideo: boolean;
}) {
  const vuoto: SposoForm = { nome: "", telefono: "", email: "", codice_fiscale: "", indirizzo: "", indirizzo_preparativi: "" };
  const [sposi, setSposi] = useState<SposoForm[]>(() => [0, 1].map((i) => ({ ...vuoto, ...(props.sposi[i] ?? {}) })));
  const [consenso, setConsenso] = useState(true);
  const [note, setNote] = useState("");
  const [accetto, setAccetto] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [fatto, setFatto] = useState(false);
  const [inCorso, avvia] = useTransition();

  if (fatto) {
    return (
      <section id="conferma" className="px-6 py-14 bg-salvia-chiaro text-center">
        <h2 className="font-serif text-3xl mb-3">Grazie!</h2>
        <p>La vostra conferma è registrata: la data è vostra. Vi scrivo a breve.</p>
      </section>
    );
  }

  const campo = (i: number, k: keyof SposoForm, etichetta: string, facoltativo = false) => (
    <label className="block text-sm">
      <span>{etichetta}{facoltativo && " (facoltativo)"}</span>
      <input value={sposi[i][k]} onChange={(e) => setSposi(sposi.map((s, j) => (j === i ? { ...s, [k]: e.target.value } : s)))}
        className="mt-1 w-full border rounded px-3 py-2 bg-white" />
    </label>
  );

  function invia() {
    setErrore(null);
    avvia(async () => {
      const r = await conferma(props.token, {
        extra: [...props.scelti], qta: props.qta, video: props.video, conVideo: props.conVideo,
        sposi, consensoPromo: consenso, note, accetto,
      });
      if (r.ok) setFatto(true); else setErrore(r.errore ?? "Errore");
    });
  }

  const righe = props.calcolo.sel ? [...props.calcolo.sel.foto, ...props.calcolo.sel.video] : [];
  return (
    <section id="conferma" className="px-6 py-14 bg-salvia-chiaro">
      <div className="max-w-3xl mx-auto">
        <h2 className="font-serif text-3xl mb-6">Conferma</h2>
        <ul className="divide-y mb-8">
          <li className="flex justify-between py-2"><span>Servizio fotografico</span><span>{euro(props.servizio)}</span></li>
          {righe.map((x) => <li key={x.codice} className="flex justify-between py-2"><span>{x.etichetta}</span><span>{x.totale ? euro(x.totale) : "omaggio"}</span></li>)}
        </ul>
        {props.calcolo.errore && <p className="text-red-700 mb-4">{props.calcolo.errore}</p>}

        <div className="grid gap-6 sm:grid-cols-2 mb-6">
          {[0, 1].map((i) => (
            <fieldset key={i} className="space-y-2">
              <legend className="font-medium mb-1">Sposa/o {i + 1}</legend>
              {campo(i, "nome", "Nome e cognome")}
              {campo(i, "telefono", "Telefono")}
              {campo(i, "email", "Email")}
              {campo(i, "codice_fiscale", "Codice fiscale")}
              {campo(i, "indirizzo", "Indirizzo di residenza")}
              {campo(i, "indirizzo_preparativi", "Indirizzo dei preparativi", true)}
            </fieldset>
          ))}
        </div>

        <label className="flex gap-2 mb-3"><input type="checkbox" checked={consenso} onChange={(e) => setConsenso(e.target.checked)} />
          <span>Acconsentiamo all’uso di alcune foto per portfolio, sito e social</span></label>
        <label className="block mb-4 text-sm"><span>Note o richieste (facoltativo)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="mt-1 w-full border rounded px-3 py-2 bg-white" /></label>

        <details className="mb-4 bg-white rounded p-4">
          <summary className="cursor-pointer font-medium">Leggi le condizioni (contratto)</summary>
          <div className="mt-4"><Contratto testo={props.contratto} /></div>
        </details>
        <label className="flex gap-2 mb-6"><input type="checkbox" checked={accetto} onChange={(e) => setAccetto(e.target.checked)} />
          <span>Abbiamo letto le condizioni e confermiamo il servizio con gli opzionali selezionati.</span></label>

        <button type="button" onClick={invia} disabled={inCorso || !!props.calcolo.errore}
          className="bg-salvia-scuro text-white px-6 py-3 rounded disabled:opacity-50">
          {inCorso ? "Invio…" : "Conferma il preventivo"}
        </button>
        {errore && <p role="alert" className="text-red-700 mt-3">{errore}</p>}
      </div>
    </section>
  );
}

function Blocchetto({ b, titolo, sopratitolo, banda, children }: { b?: Blocco; titolo: string; sopratitolo?: string; banda?: boolean; children: React.ReactNode }) {
  return (
    <section className={`px-6 py-14 ${banda ? "bg-salvia-chiaro" : ""}`}>
      <div className="max-w-3xl mx-auto">
        <p className="uppercase tracking-[0.2em] text-xs mb-2 opacity-80">{b?.sopratitolo ?? sopratitolo ?? "Opzionale"}</p>
        <h2 className="font-serif text-3xl mb-6">{b?.titolo ?? titolo}</h2>
        {children}
      </div>
    </section>
  );
}

function Scheda({ v, attiva, onClick }: { v: VoceOfferta; attiva: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={attiva}
      className={`text-left rounded border p-4 transition ${attiva ? "border-salvia-scuro bg-white ring-2 ring-salvia" : "border-neutral-300 bg-white"}`}>
      <div className="flex justify-between gap-3">
        <b>{v.gruppo ? `${v.gruppo} · ` : ""}{v.voce}</b>
        <span className="whitespace-nowrap">
          {v.incluso ? "omaggio" : euroBreve(v.prezzo)}
          {v.barrato > 0 && <span className="line-through opacity-60 ml-2 text-sm">{euroBreve(v.barrato)}</span>}
        </span>
      </div>
      {v.descrizione && <p className="text-sm mt-1 opacity-80">{v.descrizione}</p>}
    </button>
  );
}

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import "@fontsource/allison/400.css";
import "./pagina.css";
import { caricaPagina, matrimonioDaToken, registraEvento } from "@/lib/sposi/dati";
import { statoAccesso } from "@/lib/supabase/sessione";
import { calcolaOfferta, piano } from "@/lib/listino/motore";
import { data, ora } from "@/lib/formato";
import { Paragrafi, Evidenzia, Contratto, Euro, euroTesto } from "./testo";
import { Preventivo } from "./preventivo";
import { Piede } from "./piede";
import { DatiSposi } from "./indirizzi";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Il vostro Matrimonio", robots: { index: false, follow: false } };

const VOCI: Record<string, string> = {
  servizio: "Servizio fotografico", prewedding: "Servizio prematrimoniale", photo_booth: "Photo booth",
  secondo_operatore: "Secondo operatore", memory_box: "Memory box", album: "Album", album_genitori: "Album genitori",
};

type Pagina = Awaited<ReturnType<typeof caricaPagina>>["pagina"];

export default async function PaginaSposi({ params, searchParams }: {
  params: Promise<{ token: string }>; searchParams: Promise<{ confermato?: string }>;
}) {
  const { token } = await params;
  const appenaConfermato = (await searchParams).confermato === "1";
  const mid = await matrimonioDaToken(token);
  if (!mid) notFound();

  const { pagina: p, calcolo } = await caricaPagina(mid);
  if (p.modo === "non_disponibile") {
    return <div id="azp"><div className="azp-carica"><p><b>Pagina non disponibile</b></p>
      <p>Il link potrebbe non essere più attivo. Scrivetemi{p.marchio.email ? <> ad <a href={`mailto:${p.marchio.email}`}>{p.marchio.email as string}</a></> : null}.</p></div></div>;
  }

  // Le visite di Ale (loggato) non contano come aperture degli Sposi.
  const admin = (await statoAccesso()).stato === "admin";
  if (!admin && p.modo === "preventivo") await registraEvento(mid, "apertura").catch(() => {});

  const duo = p.matrimonio.paginaCongiunta;
  const modoCss = p.modo === "preventivo" ? "preventivo" : "sposi";
  const blocco = (k: string) => p.blocchi.find((b) => b.chiave === k);
  const intro = p.blocchi.filter((b) => ["mi-presento", "reportage", "come-lavoro"].includes(b.chiave));
  const servizio = p.modo === "preventivo" ? blocco(duo ? "servizio-duo" : "servizio") : blocco("area-sposi");
  const offerta = p.modo === "preventivo" && calcolo.preventivo ? calcolaOfferta(calcolo.listino, calcolo.preventivo) : null;
  const versione = p.preventivo ? `v${String(p.preventivo.versione).padStart(2, "0")}` : "";
  const ricevimento = [p.matrimonio.location, p.matrimonio.luogo].filter(Boolean).join(" - ");
  const datiFissi = (servizio?.dati ?? []) as [string, string][];

  const dati = ([
    ...(p.modo === "preventivo" && p.preventivo
      ? [[duo ? "Proposta" : "Preventivo", `${versione}${p.preventivo.inviato ? ` del ${data(p.preventivo.inviato)}` : ""}`]] : []),
    ...datiFissi.filter(([k]) => k === "Validità"),
    ["Data evento", data(p.matrimonio.dataInizio)],
    ["Ricevimento", ricevimento],
    ...datiFissi.filter(([k]) => k !== "Validità"),
  ] as [string, string][]).filter(([, v]) => v);

  // Preventivo: versione e validità in una riga sotto il prezzo; gli altri dati dell'istanza diventano voci dell'elenco.
  const validita = datiFissi.find(([k]) => k === "Validità")?.[1];
  const rigaPreventivo = p.modo === "preventivo" && p.preventivo
    ? [`${duo ? "Proposta" : "Preventivo"} ${versione}${p.preventivo.inviato ? ` del ${data(p.preventivo.inviato)}` : ""}`,
       validita ? `${duo ? "valida" : "valido"} ${validita}` : ""].filter(Boolean).join(" · ")
    : "";
  const altriDati = datiFissi.filter(([k]) => k !== "Validità");

  return (
    <div id="azp" data-modo={modoCss} data-duo={duo ? "1" : undefined}>
      <header className="hero">
        {p.marchio.motto && (
          <p className="motto">{(p.marchio.motto as string).split("\n").map((r, i) => <span key={i}>{i > 0 && <br />}{r}</span>)}</p>
        )}
        {p.matrimonio.copertina && (
          <div className="wrap"><div className="cornice quadra">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.matrimonio.copertina} alt="" referrerPolicy="no-referrer" />
          </div></div>
        )}
        <div className="firma-riga">
          {p.marchio.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="logo" src={p.marchio.logo_url as string} alt={(p.marchio.nome as string) ?? ""} referrerPolicy="no-referrer" />
          )}
          <div className="badges">
            {((p.marchio.badges as string[] | undefined) ?? []).map((u) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={u} src={u} alt="Premio Matrimonio.com" referrerPolicy="no-referrer" />
            ))}
          </div>
        </div>
        <div className="nomi">{p.nomi}</div>
        <div className="data">Wedding day | {data(p.matrimonio.dataInizio)}{p.modo === "preventivo" && versione ? ` - ${versione}` : ""}</div>
      </header>

      {appenaConfermato && p.modo === "sposi" && (
        <section className="grazie" id="azp-grazie" role="status">
          <div className="wrap">
            <h2>Grazie, il Matrimonio è confermato</h2>
            <p>La data è vostra! Vi ho mandato una mail con il riepilogo. Da questo stesso link trovate sempre timeline, servizi e pagamenti aggiornati: salvatelo tra i preferiti.</p>
            <a className="cta" href={`/${token}`}>Vai alla vostra area Sposi</a>
          </div>
        </section>
      )}

      {p.modo === "preventivo" && intro.map((b) => (
        <section key={b.chiave} className={b.banda ? "banda" : undefined}>
          <div className="wrap prosa">
            {b.sopratitolo && <p className="sez">{b.sopratitolo}</p>}
            {b.titolo && <h2>{b.titolo}</h2>}
            <Paragrafi testo={b.corpo} />
            {b.passi && <ol className="passi">{b.passi.map(([t, d], i) => <li key={i}><b>{t}</b><p>{d}</p></li>)}</ol>}
            {b.gallerie && p.matrimonio.gallerie.length > 0 && (
              <div className="gallerie">
                {p.matrimonio.gallerie.map((g) => <a key={g.url} className="btn-gal" href={g.url} target="_blank" rel="noopener noreferrer">{g.titolo}</a>)}
              </div>
            )}
          </div>
        </section>
      ))}

      <section id="azp-photo" className="verde">
        <div className="wrap">
          {servizio?.sopratitolo && <p className="sez">{servizio.sopratitolo}</p>}
          {servizio?.titolo && <h2>{servizio.titolo}</h2>}
          {p.matrimonio.galleriaSposi && (
            <div className="gallerie" style={{ margin: "0 0 1.5rem" }}>
              <a className="btn-gal" href={p.matrimonio.galleriaSposi} target="_blank" rel="noopener noreferrer">Apri la vostra galleria UpYourShoot</a>
            </div>
          )}
          {p.modo === "preventivo" ? (
            <div className="prosa larga"><Paragrafi testo={servizio?.corpo} /></div>
          ) : (
            <div className="photo-grid">
              <div className="prosa"><Paragrafi testo={servizio?.corpo} /></div>
              <dl className="dati">{dati.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            </div>
          )}
        </div>
        <div className="blocco-verde" id="azp-timeline">
          <div className="wrap">
            {p.timeline.length > 0 && (
              <ul className="tl">
                {p.timeline.map((t, i) => (
                  <li key={i}><span className="ora">{ora(t.ora)}</span><span>{t.fase}{t.luogo ? ` | ${t.luogo}` : ""}</span></li>
                ))}
              </ul>
            )}
            {p.modo === "preventivo" && (servizio?.inclusi || altriDati.length > 0) && (
              <ul className="inclusi">
                {(servizio?.inclusi ?? []).map((x, i) => <li key={i}><Evidenzia testo={x} /></li>)}
                {altriDati.map(([k, v]) => <li key={k}><b>{k}</b>: {v}</li>)}
              </ul>
            )}
            {p.modo === "preventivo" && (
              <div className="chiusura-servizio">
                {offerta && !duo && (
                  <div className="box-servizio">
                    {servizio?.voce_prezzo && <p className="voce">{servizio.voce_prezzo}</p>}
                    <div className="prezzo">
                      {offerta.servizio.barrato > 0 && <span className="barrato">{euroTesto(offerta.servizio.barrato)}</span>}
                      <Euro centesimi={offerta.servizio.prezzo} />
                    </div>
                    {rigaPreventivo && <p className="riga-preventivo">{rigaPreventivo}</p>}
                  </div>
                )}
                {duo && rigaPreventivo && <p className="riga-preventivo">{rigaPreventivo}</p>}
              </div>
            )}
          </div>
        </div>
      </section>

      {offerta && calcolo.preventivo && (
        <Preventivo
          token={token}
          offerta={offerta}
          servizioSenzaVideo={duo ? calcolaOfferta(calcolo.listino, calcolo.preventivo, { conVideo: false }).servizio.prezzo : null}
          preselezione={p.preventivo?.preselezione ?? []}
          sposi={p.sposi}
          blocchi={{ opzionali: blocco("opzionali"), album: blocco("album"), video: blocco("video") }}
          contratto={p.contratto?.testo ?? ""}
          videomaker={p.matrimonio.videomaker}
        />
      )}

      {p.modo === "preventivo" && !offerta && (
        <section className="conferma"><div className="wrap">
          <h2>Il vostro preventivo</h2>
          <p>Il preventivo è in preparazione: ve lo mando a breve. Per qualsiasi cosa scrivetemi pure.</p>
        </div></section>
      )}

      {(p.modo === "sposi" || p.modo === "chiuso") && <AreaSposi p={p} />}
      {(p.modo === "sposi" || p.modo === "chiuso") && (
        <DatiSposi token={token} modificabile={p.modo === "sposi"} sposi={p.sposi} />
      )}

      <Piede marchio={p.marchio} zone={p.zone} />
    </div>
  );
}

function AreaSposi({ p }: { p: Pagina }) {
  const perVoce = Object.fromEntries(p.importi.map((x) => [x.voce, x.importo]));
  const pi = piano(perVoce);
  const pagato = p.pagamenti.filter((x) => x.pagato_il).reduce((s, x) => s + x.importo, 0);
  return (
    <>
      <section id="azp-pagamenti">
        <div className="wrap">
          <p className="sez">Riepilogo</p>
          <h2>Servizi e pagamenti</h2>
          <ul className="riepilogo">
            {p.importi.map((x) => (
              <li key={x.voce}><span>{VOCI[x.voce] ?? x.voce}</span><span>{x.importo ? euroTesto(x.importo) : "Omaggio"}</span></li>
            ))}
            <li className="tot"><span>Totale</span><span><Euro centesimi={pi.totale} /></span></li>
          </ul>
          <div className="pag">
            <div className={pagato >= pi.acconto ? "fatto" : undefined}>
              <b>Acconto</b>50% dei servizi, al kick-off meeting<div className="imp"><Euro centesimi={pi.acconto} /></div>
            </div>
            <div className={pagato >= pi.servizi ? "fatto" : undefined}>
              <b>Saldo</b>alla consegna delle foto<div className="imp"><Euro centesimi={pi.servizi - pi.acconto} /></div>
            </div>
            {pi.album > 0 && (
              <div className={pagato >= pi.totale ? "fatto" : undefined}>
                <b>Album</b>alla consegna dell’album<div className="imp"><Euro centesimi={pi.album} /></div>
              </div>
            )}
          </div>
          {p.marchio.iban && (
            <div className="bonifico">
              Bonifico a <b>{p.marchio.intestatario as string}</b><br />
              IBAN <code>{p.marchio.iban as string}</code><br />
              Causale: Matrimonio del {data(p.matrimonio.dataInizio)} - {p.nomi}
            </div>
          )}
        </div>
      </section>
      {p.contratto && (
        <section>
          <div className="wrap">
            <p className="sez">Documenti</p>
            <h2>Contratto</h2>
            <details style={{ background: "var(--tinta)" }}>
              <summary>Leggi le condizioni del servizio</summary>
              <Contratto testo={p.contratto.testo} />
            </details>
          </div>
        </section>
      )}
    </>
  );
}

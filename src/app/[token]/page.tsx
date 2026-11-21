import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { caricaPagina, matrimonioDaToken, registraEvento } from "@/lib/sposi/dati";
import { statoAccesso } from "@/lib/supabase/sessione";
import { calcolaOfferta, piano } from "@/lib/listino/motore";
import { data, dataEstesa, euro, ora } from "@/lib/formato";
import { Paragrafi, Evidenzia, Contratto } from "./testo";
import { Preventivo } from "./preventivo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Il vostro Matrimonio", robots: { index: false, follow: false } };

const VOCI: Record<string, string> = {
  servizio: "Servizio fotografico", prewedding: "Servizio prematrimoniale", photo_booth: "Photo booth",
  secondo_operatore: "Secondo operatore", memory_box: "Memory box", album: "Album", album_genitori: "Album genitori",
};

export default async function PaginaSposi({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const mid = await matrimonioDaToken(token);
  if (!mid) notFound();

  const { pagina: p, calcolo } = await caricaPagina(mid);
  if (p.modo === "non_disponibile") {
    return <Cornice><p className="text-center py-24">Questa pagina non è più disponibile. Per qualsiasi cosa scrivetemi pure.</p></Cornice>;
  }

  // Le visite di Ale (loggato) non contano come aperture degli Sposi.
  const admin = (await statoAccesso()).stato === "admin";
  if (!admin && p.modo === "preventivo") await registraEvento(mid, "apertura").catch(() => {});

  const blocco = (k: string) => p.blocchi.find((b) => b.chiave === k);
  const intro = p.blocchi.filter((b) => !["opzionali", "album", "servizio", "servizio-duo", "area-sposi"].includes(b.chiave));
  const servizio = blocco(p.matrimonio.paginaCongiunta ? "servizio-duo" : "servizio") ?? blocco("area-sposi");

  return (
    <Cornice>
      <header className="text-center bg-salvia-scuro text-white">
        {p.matrimonio.copertina && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.matrimonio.copertina} alt="" className="w-full max-h-[70vh] object-cover" referrerPolicy="no-referrer" />
        )}
        <div className="py-10 px-6">
          {p.marchio.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.marchio.logo_url as string} alt={p.marchio.nome as string ?? ""} className="h-14 mx-auto mb-6" referrerPolicy="no-referrer" />
          )}
          <h1 className="font-serif text-4xl mb-2">{p.nomi}</h1>
          <p className="tracking-wide">{dataEstesa(p.matrimonio.dataInizio)}</p>
          {p.matrimonio.location && <p className="opacity-80">{p.matrimonio.location}{p.matrimonio.luogo && ` · ${p.matrimonio.luogo}`}</p>}
        </div>
      </header>

      {p.modo === "preventivo" && intro.map((b) => (
        <Sezione key={b.chiave} sopratitolo={b.sopratitolo} titolo={b.titolo} banda={b.banda}>
          <Paragrafi testo={b.corpo} />
          {b.passi && (
            <ol className="space-y-4 mt-2">
              {b.passi.map(([t, d], i) => (
                <li key={i} className="flex gap-4">
                  <span className="font-serif text-2xl text-salvia-scuro w-8 shrink-0">{i + 1}</span>
                  <div><b>{t}</b><p className="text-justify">{d}</p></div>
                </li>
              ))}
            </ol>
          )}
          {b.gallerie && <Gallerie gallerie={p.matrimonio.gallerie} />}
        </Sezione>
      ))}

      {servizio && (
        <Sezione sopratitolo={servizio.sopratitolo} titolo={servizio.titolo} verde>
          {p.matrimonio.galleriaSposi && (
            <p className="mb-6"><a href={p.matrimonio.galleriaSposi} target="_blank" rel="noopener noreferrer"
              className="inline-block bg-white text-salvia-scuro px-5 py-2 rounded">Apri la vostra galleria UpYourShoot</a></p>
          )}
          <Paragrafi testo={servizio.corpo} />
          {servizio.inclusi && (
            <ul className="list-disc pl-5 space-y-1 mb-4">{servizio.inclusi.map((x, i) => <li key={i}><Evidenzia testo={x} /></li>)}</ul>
          )}
          {p.timeline.length > 0 && (
            <div className="mt-6">
              <h3 className="font-serif text-xl mb-3">Timeline</h3>
              <ul className="space-y-1">
                {p.timeline.map((t, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="w-14 shrink-0 tabular-nums">{ora(t.ora)}</span>
                    <span>{t.fase}{t.luogo && <span className="opacity-80"> · {t.luogo}</span>}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Sezione>
      )}

      {p.modo === "preventivo" && calcolo.preventivo && (
        <Preventivo
          token={token}
          offerta={calcolaOfferta(calcolo.listino, calcolo.preventivo)}
          servizioSenzaVideo={p.matrimonio.paginaCongiunta ? calcolaOfferta(calcolo.listino, calcolo.preventivo, { conVideo: false }).servizio.prezzo : null}
          preselezione={p.preventivo?.preselezione ?? []}
          sposi={p.sposi}
          titoli={{ opzionali: blocco("opzionali"), album: blocco("album") }}
          contratto={p.contratto?.testo ?? ""}
          videomaker={p.matrimonio.videomaker}
        />
      )}

      {(p.modo === "sposi" || p.modo === "chiuso") && <AreaSposi p={p} />}

      <footer className="bg-antracite text-white/80 text-sm py-10 px-6 text-center space-y-1">
        <p className="font-serif text-white text-lg">{p.marchio.titolare as string}</p>
        {p.zone.length > 0 && <p>{p.zone.join(" | ")}</p>}
        <p>{[p.marchio.email, p.marchio.sito].filter(Boolean).join(" · ")}</p>
        <p>C.F. {p.marchio.codice_fiscale as string} · P.IVA {p.marchio.partita_iva as string}</p>
      </footer>
    </Cornice>
  );
}

function AreaSposi({ p }: { p: Awaited<ReturnType<typeof caricaPagina>>["pagina"] }) {
  const perVoce = Object.fromEntries(p.importi.map((x) => [x.voce, x.importo]));
  const pi = piano(perVoce);
  const pagato = p.pagamenti.filter((x) => x.pagato_il).reduce((s, x) => s + x.importo, 0);
  return (
    <Sezione sopratitolo="Riepilogo" titolo="Servizi e pagamenti">
      <ul className="divide-y mb-6">
        {p.importi.map((x) => (
          <li key={x.voce} className="flex justify-between py-2">
            <span>{VOCI[x.voce] ?? x.voce}</span><span>{x.importo ? euro(x.importo) : "omaggio"}</span>
          </li>
        ))}
        <li className="flex justify-between py-2 font-medium"><span>Totale</span><span>{euro(pi.totale)}</span></li>
      </ul>
      <dl className="grid grid-cols-2 gap-y-1 mb-6 max-w-sm">
        <dt>Acconto (50% dei servizi)</dt><dd className="text-right">{euro(pi.acconto)}</dd>
        <dt>Già versato</dt><dd className="text-right">{euro(pagato)}</dd>
        <dt>Da versare</dt><dd className="text-right">{euro(Math.max(0, pi.totale - pagato))}</dd>
      </dl>
      {p.pagamenti.some((x) => x.scadenza) && (
        <ul className="text-sm mb-6">
          {p.pagamenti.filter((x) => x.scadenza).map((x, i) => (
            <li key={i}>{data(x.scadenza)}: {euro(x.importo)} {x.pagato_il ? "· pagato" : ""}</li>
          ))}
        </ul>
      )}
      {p.marchio.iban && (
        <p className="text-sm">Bonifico a {p.marchio.intestatario as string} · IBAN <span className="font-mono">{p.marchio.iban as string}</span><br />
          Causale: Matrimonio del {data(p.matrimonio.dataInizio)} - {p.nomi}</p>
      )}
      {p.contratto && (
        <details className="mt-8">
          <summary className="cursor-pointer font-medium">Contratto</summary>
          <div className="mt-4"><Contratto testo={p.contratto.testo} /></div>
        </details>
      )}
    </Sezione>
  );
}

function Cornice({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-white">{children}</main>;
}

function Sezione({ sopratitolo, titolo, banda, verde, children }: {
  sopratitolo?: string; titolo?: string; banda?: boolean; verde?: boolean; children: React.ReactNode;
}) {
  const sfondo = verde ? "bg-salvia text-white" : banda ? "bg-salvia-chiaro" : "";
  return (
    <section className={`${sfondo} px-6 py-14`}>
      <div className="max-w-3xl mx-auto">
        {sopratitolo && <p className="uppercase tracking-[0.2em] text-xs mb-2 opacity-80">{sopratitolo}</p>}
        {titolo && <h2 className="font-serif text-3xl mb-6">{titolo}</h2>}
        {children}
      </div>
    </section>
  );
}

function Gallerie({ gallerie }: { gallerie: { titolo: string; url: string }[] }) {
  if (!gallerie.length) return null;
  return (
    <div className="flex flex-wrap gap-3 mt-4">
      {gallerie.map((g) => (
        <a key={g.url} href={g.url} target="_blank" rel="noopener noreferrer"
          className="border border-salvia-scuro text-salvia-scuro px-4 py-2 rounded">{g.titolo}</a>
      ))}
    </div>
  );
}

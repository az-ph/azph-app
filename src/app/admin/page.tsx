import Link from "next/link";
import { supabaseSessione } from "@/lib/supabase/sessione";
import { data, dataEstesa } from "@/lib/formato";
import { nomiBrevi } from "@/lib/admin/stati";
import { Kpi, PillStato, Testata, giorniDa } from "./ui";

type Riga = {
  id: string; codice_id: string; stato: string; data_inizio: string | null;
  link: { token: string; revocato_il: string | null }[]; sposi: { ordine: number; nome: string | null }[];
  preventivo: { id: string; inviato_il: string | null }[];
};

export default async function Matrimoni() {
  const supabase = await supabaseSessione();
  const { data: righe, error } = await supabase.from("matrimonio")
    .select("id, codice_id, stato, data_inizio, link:link_sposi ( token, revocato_il ), sposi:sposo ( ordine, nome ), preventivo ( id, inviato_il )")
    .in("stato", ["qte_to_contact", "qte_quote", "wdg_confermato", "wdg_lightroom", "wdg_invoice", "wdg_album_todo", "wdg_album"])
    .order("data_inizio", { ascending: true, nullsFirst: false });

  if (error) return <p className="text-errore">Il database non risponde: {error.message}</p>;
  const matrimoni = (righe ?? []) as unknown as Riga[];
  const nuovo = <Link href="/admin/matrimoni/nuovo" className="f-btn f-btn-pieno">+ Nuovo Matrimonio</Link>;

  if (!matrimoni.length) {
    return (
      <>
        <Testata titolo="Matrimoni" azioni={nuovo} />
        <div className="f-carta p-8 text-center">
          <p>Nessun Matrimonio in corso.</p>
          <p className="mt-3"><Link href="/admin/importa" className="f-link">Importa i dati dal foglio Matrimoni</Link></p>
        </div>
      </>
    );
  }

  const preventivi = matrimoni.filter((m) => m.stato.startsWith("qte"));
  const confermati = matrimoni.filter((m) => m.stato.startsWith("wdg"));
  const futuri = confermati.filter((m) => (giorniDa(m.data_inizio) ?? -1) >= 0);
  const prossimo = futuri[0];
  const gg = giorniDa(prossimo?.data_inizio);
  const anno = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" }).slice(0, 4);
  const inAnno = (a: string) => confermati.filter((m) => m.data_inizio?.startsWith(a)).length;
  const daMandare = preventivi.filter((m) => !m.preventivo.some((p) => p.inviato_il)).length;

  return (
    <>
      <Testata titolo="Matrimoni" sotto={`${matrimoni.length} in corso`} azioni={nuovo} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Kpi etichetta="Prossimo Matrimonio" valore={gg == null ? "—" : gg === 0 ? "Oggi" : `tra ${gg} gg`} nota={prossimo ? `${nomiBrevi(prossimo.sposi)} · ${data(prossimo.data_inizio)}` : undefined} />
        <Kpi etichetta="Preventivi aperti" valore={preventivi.length} nota={daMandare ? `${daMandare} da inviare` : "tutti inviati"} tono={daMandare ? "avviso" : "ok"} />
        <Kpi etichetta={`Confermati ${anno}`} valore={inAnno(anno)} nota={`${inAnno(String(+anno + 1))} nel ${+anno + 1}`} />
        <Kpi etichetta="In lavorazione" valore={confermati.length - futuri.length} nota="foto, saldo, album" />
      </div>
      {preventivi.length > 0 && <Elenco titolo="Preventivi" righe={preventivi} />}
      {confermati.length > 0 && <Elenco titolo="Confermati" righe={confermati} />}
    </>
  );
}

function Elenco({ titolo, righe }: { titolo: string; righe: Riga[] }) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold mb-3">{titolo} <span className="text-tenue font-normal">· {righe.length}</span></h2>
      <div className="f-carta overflow-x-auto">
        <table className="f-tabella">
          <thead><tr><th>Sposi</th><th>Data</th><th className="hidden md:table-cell">Codice</th><th>Stato</th><th className="text-right">Pagina</th></tr></thead>
          <tbody>
            {righe.map((m) => {
              const link = m.link.find((l) => !l.revocato_il);
              const gg = giorniDa(m.data_inizio);
              const href = `/admin/matrimoni/${m.id}`;
              return (
                <tr key={m.id} className="f-riga">
                  <td className="font-medium"><Link href={href} className="hover:underline underline-offset-4">{nomiBrevi(m.sposi) || "Senza nomi"}</Link></td>
                  <td className="whitespace-nowrap">
                    <span className="tabular-nums">{data(m.data_inizio) || "—"}</span>
                    {m.data_inizio && <span className="block text-xs text-tenue">{dataEstesa(m.data_inizio).split(" ")[0]}{gg != null && gg >= 0 && gg <= 60 ? ` · tra ${gg} gg` : ""}</span>}
                  </td>
                  <td className="hidden md:table-cell tabular-nums text-tenue">{m.codice_id}</td>
                  <td>
                    <PillStato stato={m.stato} />
                    {m.stato.startsWith("qte") && !m.preventivo.length && <span className="ml-2 text-xs text-errore">senza preventivo</span>}
                  </td>
                  <td className="text-right">{link ? <a href={`/${link.token}`} target="_blank" rel="noopener noreferrer" className="f-link text-sm">Apri ↗</a> : <span className="text-tenue">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

import Link from "next/link";
import { supabaseSessione } from "@/lib/supabase/sessione";
import { data } from "@/lib/formato";
import { nomiBrevi, nomiCompleti } from "@/lib/admin/stati";
import { Kpi, Testata, giorniDa } from "../ui";
import { ElencoMatrimoni } from "./elenco";
import type { VoceElenco } from "@/lib/admin/ricerca";

type Riga = {
  id: string; codice_id: string; stato: string; data_inizio: string | null; fonte: string | null; esempio: boolean;
  location: { nome: string; comune: string | null } | null;
  link: { token: string; revocato_il: string | null }[]; sposi: { ordine: number; nome: string | null }[];
  preventivo: { id: string; inviato_il: string | null }[];
};

export default async function Matrimoni() {
  const supabase = await supabaseSessione();
  const { data: righe, error } = await supabase.from("matrimonio")
    .select("id, codice_id, stato, data_inizio, fonte, esempio, location ( nome, comune ), link:link_sposi ( token, revocato_il ), sposi:sposo ( ordine, nome ), preventivo ( id, inviato_il )")
    .order("data_inizio", { ascending: true, nullsFirst: false });

  if (error) return <p className="text-errore">Il database non risponde: {error.message}</p>;
  const tutti = (righe ?? []) as unknown as Riga[];
  const matrimoni = tutti.filter((m) => !m.stato.startsWith("clo") && !m.esempio);
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

  const oggi = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
  const voci: VoceElenco[] = tutti.map((m) => ({
    id: m.id, codice: m.codice_id, stato: m.stato, data: m.data_inizio, nomi: nomiCompleti(m.sposi), fonte: m.fonte ?? "",
    location: m.location ? [m.location.nome, m.location.comune].filter(Boolean).join(" - ") : "",
    token: m.link.find((l) => !l.revocato_il)?.token ?? null,
    senzaPreventivo: m.stato.startsWith("qte") && !m.preventivo.length && !m.esempio, esempio: m.esempio,
  }));
  return (
    <>
      <Testata titolo="Matrimoni" sotto={`${matrimoni.length} in corso`} azioni={nuovo} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Kpi etichetta="Prossimo Matrimonio" valore={gg == null ? "—" : gg === 0 ? "Oggi" : `tra ${gg} gg`} nota={prossimo ? `${nomiBrevi(prossimo.sposi)} · ${data(prossimo.data_inizio)}` : undefined} />
        <Kpi etichetta="Preventivi aperti" valore={preventivi.length} nota={daMandare ? `${daMandare} da inviare` : "tutti inviati"} tono={daMandare ? "avviso" : "ok"} />
        <Kpi etichetta={`Confermati ${anno}`} valore={inAnno(anno)} nota={`${inAnno(String(+anno + 1))} nel ${+anno + 1}`} />
        <Kpi etichetta="In lavorazione" valore={confermati.length - futuri.length} nota="foto, saldo, album" />
      </div>
      <ElencoMatrimoni elenco={voci} oggi={oggi} />
    </>
  );
}

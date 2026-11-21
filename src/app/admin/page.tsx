import Link from "next/link";
import { supabaseSessione } from "@/lib/supabase/sessione";
import { data } from "@/lib/formato";

const STATI: Record<string, string> = {
  qte_to_contact: "Da contattare", qte_quote: "Preventivo", wdg_confermato: "Confermato", wdg_lightroom: "Lightroom",
  wdg_invoice: "Saldo", wdg_album_todo: "Album da fare", wdg_album: "Album", clo_completed: "Chiuso",
  clo_lost: "Perso", clo_no_answer: "Nessuna risposta",
};

export default async function Oggi() {
  const supabase = await supabaseSessione();
  const { data: matrimoni, error } = await supabase.from("matrimonio")
    .select("id, codice_id, stato, data_inizio, link:link_sposi ( token, revocato_il ), sposi:sposo ( ordine, nome )")
    .in("stato", ["qte_to_contact", "qte_quote", "wdg_confermato", "wdg_lightroom", "wdg_invoice", "wdg_album_todo", "wdg_album"])
    .order("data_inizio", { ascending: true, nullsFirst: false });

  if (error) return <p className="text-red-700">Il database non risponde: {error.message}</p>;
  if (!matrimoni?.length) {
    return (
      <section>
        <h1 className="font-serif text-2xl mb-4">Oggi</h1>
        <p>Nessun Matrimonio in corso nel database.</p>
        <p className="mt-4"><Link href="/admin/importa" className="underline text-salvia-scuro">Importa i dati dal foglio Matrimoni</Link></p>
      </section>
    );
  }

  return (
    <section>
      <h1 className="font-serif text-2xl mb-4">Matrimoni in corso</h1>
      <table className="text-sm w-full max-w-3xl">
        <thead><tr className="text-left border-b"><th className="py-1">Codice</th><th>Data</th><th>Sposi</th><th>Stato</th><th>Pagina Sposi</th></tr></thead>
        <tbody>
          {matrimoni.map((m) => {
            const link = (m.link as { token: string; revocato_il: string | null }[]).find((l) => !l.revocato_il);
            const nomi = (m.sposi as { ordine: number; nome: string | null }[])
              .sort((a, b) => a.ordine - b.ordine).map((s) => (s.nome ?? "").split(" ")[0]).join(" e ");
            return (
              <tr key={m.id} className="border-b">
                <td className="py-1 tabular-nums">{m.codice_id}</td>
                <td className="tabular-nums">{data(m.data_inizio)}</td>
                <td>{nomi}</td>
                <td>{STATI[m.stato] ?? m.stato}</td>
                <td>{link ? <a href={`/${link.token}`} target="_blank" rel="noopener noreferrer" className="underline text-salvia-scuro">Apri</a> : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

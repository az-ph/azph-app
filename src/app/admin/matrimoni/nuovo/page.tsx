import { supabaseSessione } from "@/lib/supabase/sessione";
import { STATI, unisciFonti } from "@/lib/admin/stati";
import { creaMatrimonio } from "../azioni";
import { Modulo } from "../modulo";
import { Campo, Riquadro, Spunta, inp } from "../campi";
import { Testata } from "../../ui";
import Link from "next/link";

export default async function NuovoMatrimonio() {
  const supabase = await supabaseSessione();
  const [{ data: location }, { data: formule }, { data: usate }] = await Promise.all([
    supabase.from("location").select("id, nome, comune").order("nome"),
    supabase.from("voce_listino").select("id, codice, voce").eq("categoria", "formula").eq("attiva", true).order("codice"),
    supabase.from("matrimonio").select("fonte").not("fonte", "is", null),
  ]);
  const fonti = unisciFonti((usate ?? []).map((x) => x.fonte));
  return (
    <div className="max-w-4xl">
      <Testata sopra={<Link href="/admin" className="hover:text-testo">Matrimoni</Link>} titolo="Nuovo Matrimonio"
        sotto="Il codice prende l'anno della richiesta (oggi). Dopo il salvataggio si apre il preventivo." />
      <Modulo azione={creaMatrimonio} etichetta="Crea e vai al preventivo" className="flex flex-col gap-4">
        <Riquadro titolo="Il Matrimonio">
          <div className="grid sm:grid-cols-2 gap-4">
            <Campo etichetta="Data del Matrimonio"><input type="date" name="data_inizio" className={inp} /></Campo>
            <Campo etichetta="Ora della cerimonia"><input type="time" name="ora_inizio" className={inp} /></Campo>
            <Campo etichetta="Location">
              <select name="location_id" className={inp} defaultValue="">
                <option value="">—</option>
                {(location ?? []).map((l) => <option key={l.id} value={l.id}>{l.nome}{l.comune ? ` - ${l.comune}` : ""}</option>)}
              </select>
            </Campo>
            <Campo etichetta="Formula">
              <select name="formula_id" className={inp} defaultValue="">
                <option value="">—</option>
                {(formule ?? []).map((f) => <option key={f.id} value={f.id}>{f.codice} · {f.voce}</option>)}
              </select>
            </Campo>
            <Campo etichetta="Fonte">
              <select name="fonte" className={inp} defaultValue=""><option value="">—</option>{fonti.map((f) => <option key={f}>{f}</option>)}</select>
            </Campo>
            <Campo etichetta="Stato">
              <select name="stato" className={inp} defaultValue="qte_to_contact">
                {STATI.filter((s) => s.valore.startsWith("qte")).map((s) => <option key={s.valore} value={s.valore}>{s.etichetta}</option>)}
              </select>
            </Campo>
            <div className="sm:col-span-2"><Spunta nome="preparativi" etichetta="Preparativi richiesti" /></div>
          </div>
        </Riquadro>
        <div className="grid lg:grid-cols-2 gap-4">
          {[1, 2].map((o) => (
            <Riquadro key={o} titolo={`Sposa/o ${o}`}>
              <div className="grid gap-4">
                <Campo etichetta="Nome e cognome"><input name={`nome${o}`} className={inp} autoComplete="off" /></Campo>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Campo etichetta="Telefono"><input name={`telefono${o}`} type="tel" className={inp} autoComplete="off" /></Campo>
                  <Campo etichetta="Email"><input name={`email${o}`} type="email" className={inp} autoComplete="off" /></Campo>
                </div>
              </div>
            </Riquadro>
          ))}
        </div>
        <Riquadro titolo="Note private" azione={<span className="text-xs text-tenue">mai visibili agli Sposi</span>}>
          <textarea name="note_private" rows={3} className={inp} aria-label="Note private" />
        </Riquadro>
      </Modulo>
    </div>
  );
}

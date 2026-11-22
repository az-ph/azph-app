import { supabaseSessione } from "@/lib/supabase/sessione";
import { STATI, unisciFonti } from "@/lib/admin/stati";
import { creaMatrimonio } from "../azioni";
import { Modulo } from "../modulo";
import { Campo, Spunta, inp } from "../campi";

export default async function NuovoMatrimonio() {
  const supabase = await supabaseSessione();
  const [{ data: location }, { data: formule }, { data: usate }] = await Promise.all([
    supabase.from("location").select("id, nome, comune").order("nome"),
    supabase.from("voce_listino").select("id, codice, voce").eq("categoria", "formula").eq("attiva", true).order("codice"),
    supabase.from("matrimonio").select("fonte").not("fonte", "is", null),
  ]);
  const fonti = unisciFonti((usate ?? []).map((x) => x.fonte));
  return (
    <section className="max-w-3xl">
      <h1 className="font-serif text-2xl mb-1">Nuovo Matrimonio</h1>
      <p className="text-sm text-antracite/75 mb-6">Il codice si assegna in automatico dall&apos;anno della data. Dopo il salvataggio si apre il preventivo.</p>
      <Modulo azione={creaMatrimonio} etichetta="Crea e vai al preventivo">
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
        {[1, 2].map((o) => (
          <fieldset key={o} className="mt-6 grid sm:grid-cols-3 gap-4">
            <legend className="font-serif text-lg mb-2">Sposa/o {o}</legend>
            <Campo etichetta="Nome e cognome"><input name={`nome${o}`} className={inp} autoComplete="off" /></Campo>
            <Campo etichetta="Telefono"><input name={`telefono${o}`} type="tel" className={inp} autoComplete="off" /></Campo>
            <Campo etichetta="Email"><input name={`email${o}`} type="email" className={inp} autoComplete="off" /></Campo>
          </fieldset>
        ))}
        <div className="mt-6"><Campo etichetta="Note private (mai visibili agli Sposi)"><textarea name="note_private" rows={3} className={inp} /></Campo></div>
      </Modulo>
    </section>
  );
}

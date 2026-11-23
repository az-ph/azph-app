import { FormImporta } from "./form";
import { AggiornaTesti } from "./aggiorna-testi";
import { SincronizzaCalendario } from "./sincronizza";
import { Testata } from "../ui";

export default function PaginaImporta() {
  return (
    <div className="max-w-3xl flex flex-col gap-4">
      <Testata titolo="Importa e testi" sotto="Dati dal foglio Matrimoni e testi della pagina Sposi." />
      <ol className="text-sm list-decimal pl-5 space-y-1 text-tenue">
        <li>Nel foglio Google &quot;Matrimoni&quot;: File → Scarica → Microsoft Excel (.xlsx).</li>
        <li>Caricalo qui e premi <b className="text-testo">Prova</b>: vedi cosa entrerebbe, senza scrivere niente.</li>
        <li>Se i numeri tornano, ricarica lo stesso file e premi <b className="text-testo">Importa</b>. Si può fare una sola volta, a database vuoto.</li>
      </ol>
      <FormImporta />
      <AggiornaTesti />
      <SincronizzaCalendario />
    </div>
  );
}

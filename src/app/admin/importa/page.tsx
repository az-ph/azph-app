import { FormImporta } from "./form";

export default function PaginaImporta() {
  return (
    <section className="max-w-2xl">
      <h1 className="font-serif text-2xl mb-2">Importa dal foglio Matrimoni</h1>
      <ol className="text-sm list-decimal pl-5 mb-6 space-y-1">
        <li>Nel foglio Google &quot;Matrimoni&quot;: File → Scarica → Microsoft Excel (.xlsx).</li>
        <li>Caricalo qui e premi <b>Prova</b>: vedi cosa entrerebbe, senza scrivere niente.</li>
        <li>Se i numeri tornano, ricarica lo stesso file e premi <b>Importa</b>. Si può fare una sola volta, a database vuoto.</li>
      </ol>
      <FormImporta />
    </section>
  );
}

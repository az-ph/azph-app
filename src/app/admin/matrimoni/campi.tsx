/** Campi dei moduli admin (stile uniforme). */
export function Campo({ etichetta, children, largo }: { etichetta: string; children: React.ReactNode; largo?: boolean }) {
  return (
    <label className={`flex flex-col gap-1.5 text-sm ${largo ? "sm:col-span-2" : ""}`}>
      <span className="text-tenue font-medium text-[0.8125rem]">{etichetta}</span>
      {children}
    </label>
  );
}
export const inp = "f-inp";
export function Spunta({ nome, etichetta, attiva }: { nome: string; etichetta: string; attiva?: boolean | null }) {
  return (
    <label className="flex items-center gap-2.5 text-sm cursor-pointer">
      <input type="checkbox" name={nome} defaultChecked={!!attiva} className="size-4" />
      {etichetta}
    </label>
  );
}
/** Riquadro con titolo, per raggruppare i campi. */
export function Riquadro({ titolo, children, className = "", azione }: { titolo?: React.ReactNode; children: React.ReactNode; className?: string; azione?: React.ReactNode }) {
  return (
    <section className={`f-carta p-5 sm:p-6 ${className}`}>
      {(titolo || azione) && (
        <div className="flex items-center justify-between gap-3 mb-4">
          {titolo && <h2 className="text-[0.9375rem] font-semibold">{titolo}</h2>}
          {azione}
        </div>
      )}
      {children}
    </section>
  );
}

/** Campi dei moduli admin (stile uniforme). */
export function Campo({ etichetta, children, largo }: { etichetta: string; children: React.ReactNode; largo?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${largo ? "sm:col-span-2" : ""}`}>
      <span className="text-antracite/75">{etichetta}</span>
      {children}
    </label>
  );
}
export const inp = "border border-gray-300 rounded px-2 py-1.5 bg-white text-base";
export function Spunta({ nome, etichetta, attiva }: { nome: string; etichetta: string; attiva?: boolean | null }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={nome} defaultChecked={!!attiva} className="size-4 accent-salvia-scuro" />
      {etichetta}
    </label>
  );
}

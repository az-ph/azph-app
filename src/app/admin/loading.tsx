/** Mentre il server prepara la pagina: sagoma della pagina, così il clic risponde subito. */
export default function Caricamento() {
  const blocco = "rounded-[14px] bg-morbido animate-pulse";
  return (
    <div aria-busy="true" aria-label="Caricamento">
      <div className={`${blocco} h-10 w-72 mb-3`} />
      <div className={`${blocco} h-4 w-96 max-w-full mb-8`} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">{[0, 1, 2, 3].map((i) => <div key={i} className={`${blocco} h-20`} />)}</div>
      <div className={`${blocco} h-72`} />
    </div>
  );
}

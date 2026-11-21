/**
 * Testo dei blocchi: paragrafi separati da riga vuota, **parole evidenziate**.
 * Niente HTML dal database: solo testo e grassetto, quindi nessun rischio di iniezione.
 */
export function Evidenzia({ testo }: { testo: string }) {
  const parti = testo.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parti.map((p, i) => p.startsWith("**") && p.endsWith("**")
        ? <span key={i} className="hl">{p.slice(2, -2)}</span>
        : <span key={i}>{p}</span>)}
    </>
  );
}

export function Paragrafi({ testo, className = "" }: { testo?: string; className?: string }) {
  if (!testo) return null;
  return (
    <>
      {testo.split(/\n{2,}/).map((p, i) => (
        <p key={i} className={"mb-4 text-justify " + className}><Evidenzia testo={p} /></p>
      ))}
    </>
  );
}

/** Contratto in markdown semplice: # titolo, ## sezioni, - elenchi, paragrafi. */
export function Contratto({ testo }: { testo: string }) {
  const righe = testo.split("\n");
  const out: React.ReactNode[] = [];
  let lista: string[] = [];
  const chiudiLista = () => {
    if (lista.length) out.push(<ul key={out.length} className="list-disc pl-5 mb-3 space-y-1">{lista.map((l, i) => <li key={i}>{l}</li>)}</ul>);
    lista = [];
  };
  for (const r of righe) {
    if (r.startsWith("- ")) { lista.push(r.slice(2)); continue; }
    chiudiLista();
    if (r.startsWith("## ")) out.push(<h4 key={out.length} className="font-medium mt-4 mb-1">{r.slice(3)}</h4>);
    else if (r.startsWith("# ")) out.push(<h3 key={out.length} className="font-serif text-lg mb-2">{r.slice(2)}</h3>);
    else if (r.trim()) out.push(<p key={out.length} className="mb-2">{r}</p>);
  }
  chiudiLista();
  return <div className="text-sm leading-relaxed">{out}</div>;
}

/**
 * Testo dei blocchi: paragrafi separati da riga vuota, **parole evidenziate** (classe hl, come nella pagina attuale).
 * Niente HTML dal database: solo testo e evidenziazioni, quindi nessun rischio di iniezione.
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

export function Paragrafi({ testo }: { testo?: string }) {
  if (!testo) return null;
  return <>{testo.split(/\n{2,}/).map((p, i) => <p key={i}><Evidenzia testo={p} /></p>)}</>;
}

/** Contratto in markdown semplice: # titolo, ## sezioni, - elenchi, paragrafi. */
export function Contratto({ testo }: { testo: string }) {
  const out: React.ReactNode[] = [];
  let lista: string[] = [];
  const chiudiLista = () => {
    if (lista.length) out.push(<ul key={out.length}>{lista.map((l, i) => <li key={i}>{l}</li>)}</ul>);
    lista = [];
  };
  for (const r of testo.split("\n")) {
    if (r.startsWith("- ")) { lista.push(r.slice(2)); continue; }
    chiudiLista();
    if (r.startsWith("## ")) out.push(<h5 key={out.length}>{r.slice(3)}</h5>);
    else if (r.startsWith("# ")) out.push(<h4 key={out.length}>{r.slice(2)}</h4>);
    else if (r.trim()) out.push(<p key={out.length}>{r}</p>);
  }
  chiudiLista();
  return <div className="contratto">{out}</div>;
}

/** "1.100,00" con il punto anche sulle migliaia (Intl in italiano non lo mette sotto 10.000). */
export function formatoEuro(centesimi: number): string {
  const [i, d] = (Math.abs(centesimi) / 100).toFixed(2).split(".");
  return (centesimi < 0 ? "-" : "") + i.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + d;
}

/** Importo come nella pagina attuale: 1.100<small>,00€</small> */
export function Euro({ centesimi }: { centesimi: number }) {
  const [intero, dec] = formatoEuro(centesimi).split(",");
  return <>{intero}<small>,{dec}€</small></>;
}

export function euroTesto(centesimi: number) {
  return formatoEuro(centesimi) + " €";
}

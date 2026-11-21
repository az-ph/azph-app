import type { Marchio } from "@/lib/sposi/componi";

/** Footer come nel PDF del preventivo: contatti in colonna, fascia bianca con le icone, zone su una riga. */
export function Piede({ marchio, zone }: { marchio: Marchio; zone: string[] }) {
  const m = marchio as Record<string, string | undefined>;
  const tel = m.telefono, email = m.email, sito = m.sito?.replace(/^https?:\/\//, "");
  const principali = zone.filter((z) => !/ovunque/i.test(z)), ovunque = zone.find((z) => /ovunque/i.test(z));
  return (
    <footer>
      <div className="wrap piede">
        {tel && (
          <a className="contatto" href={`tel:${tel.replace(/\s/g, "")}`}><span>{tel}</span>
            <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true"><rect x="9" y="17" width="17" height="27" rx="3" /><path d="M14 39h7" /><path className="pieno" d="M24 5h14a4 4 0 0 1 4 4v7a4 4 0 0 1-4 4h-9l-5 4v-4a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4z" /><path d="M27 12.5h.01M31 12.5h.01M35 12.5h.01" /></svg>
          </a>
        )}
        {email && (
          <a className="contatto" href={`mailto:${email}`}><span>{email}</span>
            <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true"><rect x="6" y="11" width="36" height="26" rx="2.5" /><path d="M7 13l17 14 17-14" /></svg>
          </a>
        )}
        {sito && (
          <a className="contatto" href={m.sito} target="_blank" rel="noopener noreferrer"><span>{sito}</span>
            <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true"><circle cx="24" cy="24" r="18" /><ellipse cx="24" cy="24" rx="8" ry="18" /><path d="M6 24h36M9 15h30M9 33h30M24 6v36" /></svg>
          </a>
        )}
        {m.indirizzo && (
          <div className="contatto"><span>{m.indirizzo.split("\n").map((r, i) => <span key={i}>{i > 0 && <br />}{r}</span>)}</span>
            <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true"><rect x="6" y="16" width="36" height="24" rx="2.5" /><path d="M18 16v-4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4M6 27h15M27 27h15" /><rect x="21" y="24" width="6" height="6" rx="1" /></svg>
          </div>
        )}
        {zone.length > 0 && (
          <div className="zone">
            <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true"><path d="M24 44S11 29 11 19a13 13 0 0 1 26 0c0 10-13 25-13 25z" /><circle cx="24" cy="19" r="4.5" /></svg>
            <span><b>{principali.join(" | ")}</b>{ovunque && <><i> | </i><b>{ovunque}</b></>}</span>
          </div>
        )}
        {(m.codice_fiscale || m.partita_iva) && (
          <div className="legale">{[m.codice_fiscale && `C.F. ${m.codice_fiscale}`, m.partita_iva && `P.Iva ${m.partita_iva}`].filter(Boolean).join(" | ")}</div>
        )}
      </div>
    </footer>
  );
}

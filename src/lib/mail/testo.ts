/**
 * Testi delle mail dai modelli: segnaposto {CHIAVE}, **grassetto**, [!Pulsante](url).
 * Funzioni pure: producono la versione HTML e quella in testo semplice.
 */

export type Blocco = { html: string; testo: string };

/** Colori delle mail: dalle impostazioni dell'istanza (qui solo valori neutri di riserva). */
export type Stile = { testo: string; pulsante: string; testoPulsante: string; linea: string };
const NEUTRO: Stile = { testo: "#333333", pulsante: "#555555", testoPulsante: "#ffffff", linea: "#dddddd" };

export function stileDaColori(c: Record<string, string> | null | undefined): Stile {
  return {
    testo: c?.antracite ?? NEUTRO.testo,
    pulsante: c?.salvia ?? NEUTRO.pulsante,
    testoPulsante: c?.salvia ? (c?.antracite ?? "#000000") : NEUTRO.testoPulsante,
    linea: NEUTRO.linea,
  };
}

/** {FIRMA}: nel testo semplice la firma breve; nell'HTML la firma completa (se c'è) in coda alla mail. */
export type Firma = { testo: string; html?: string };

export function escH(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Sostituisce i segnaposto {CHIAVE}; quelli senza valore restano vuoti. */
export function riempi(t: string, valori: Record<string, string>): string {
  return t.replace(/\{([A-Z_]+)\}/g, (m, k: string) => (k in valori ? valori[k] : m)).replace(/\n{3,}/g, "\n\n");
}

/** Testo del modello (già riempito) + blocchi (es. RIEPILOGO) → html e testo. */
export function componi(t: string, blocchi: Record<string, Blocco> = {}, stile: Stile = NEUTRO, firma: Firma = { testo: "" }): Blocco {
  const COLORE = stile;
  const segnaposto = (k: string) => `\u0000${k}\u0000`;
  const conBlocchi = (x: string) => Object.keys(blocchi).reduce((a, k) => a.split(`{${k}}`).join(segnaposto(k)), x);
  const testoFirma = t.split("{FIRMA}").join(firma.testo);
  // con la firma HTML, nel corpo HTML {FIRMA} sparisce e la firma va in coda
  const base = conBlocchi(firma.html ? t.replace(/\n?\{FIRMA\}/g, "") : testoFirma);

  // testo semplice
  let testo = conBlocchi(testoFirma).replace(/\*\*(.+?)\*\*/g, "$1").replace(/\[!([^\]]+)\]\(([^)]+)\)/g, "$1: $2");
  for (const [k, b] of Object.entries(blocchi)) testo = testo.split(segnaposto(k)).join(b.testo);

  // html: paragrafi separati da righe vuote, a capo singoli come <br>
  const paragrafi = base.trim().split(/\n{2,}/).map((p) => {
    const righe = p.split("\n").map((r) => {
      const k = Object.keys(blocchi).find((x) => r.trim() === segnaposto(x));
      if (k) return { blocco: blocchi[k].html };
      return {
        html: escH(r)
          .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
          .replace(/\[!([^\]]+)\]\(([^)]+)\)/g, (_m, et: string, url: string) => pulsante(et, url, COLORE)),
      };
    });
    let html = "", aperto: string[] = [];
    const chiudi = () => { if (aperto.length) html += `<p style="margin:0 0 14px">${aperto.join("<br>")}</p>`; aperto = []; };
    for (const r of righe) {
      if ("blocco" in r) { chiudi(); html += r.blocco; } else aperto.push(r.html);
    }
    chiudi();
    return html;
  });
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:${COLORE.testo};max-width:560px">${paragrafi.join("")}</div>` +
    (firma.html ? `<div style="margin-top:4px">${firma.html}</div>` : "");
  return { html, testo: testo.trim() + "\n" };
}

function pulsante(etichetta: string, url: string, c: Stile): string {
  // solo link https: un modello non deve poter inserire altro
  const sicuro = /^https:\/\/[^\s"<>]+$/.test(url.replace(/&amp;/g, "&")) ? url : "#";
  return `<a href="${sicuro}" style="display:inline-block;margin:8px 0;padding:12px 22px;background:${c.pulsante};color:${c.testoPulsante};text-decoration:none;font-weight:bold">${etichetta}</a>`;
}

/** Tabella del riepilogo: solo linee orizzontali, importi a destra, totale in grassetto. */
export function tabella(righe: [string, string][], totale?: [string, string], COLORE: Stile = NEUTRO): Blocco {
  const td = `padding:7px 0;border-bottom:1px solid ${COLORE.linea};vertical-align:top;`;
  const tot = `padding:9px 0;border-top:2px solid ${COLORE.testo};font-weight:bold;`;
  const html = `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:520px;margin:6px 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px">` +
    righe.map(([a, b]) => `<tr><td style="${td}padding-right:16px">${escH(a)}</td><td style="${td}text-align:right;white-space:nowrap">${escH(b)}</td></tr>`).join("") +
    (totale ? `<tr><td style="${tot}">${escH(totale[0])}</td><td style="${tot}text-align:right;white-space:nowrap">${escH(totale[1])}</td></tr>` : "") +
    `</table>`;
  const testo = righe.map(([a, b]) => `• ${a}: ${b}`).join("\n") + (totale ? `\n${totale[0]}: ${totale[1]}` : "") + "\n";
  return { html, testo };
}

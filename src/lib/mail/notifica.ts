import "server-only";
import { supabaseServizio } from "@/lib/supabase/server";
import { escH, tabella } from "./testo";
import { inviaMail } from "./resend";

/**
 * Notifica al titolare (indirizzo delle notifiche nelle impostazioni). Mai agli Sposi.
 * Se manca l'indirizzo o Resend non risponde, la notifica si perde: ciò che conta è già nel database.
 */
export async function notificaTitolare(n: { oggetto: string; titolo: string; righe: [string, string][]; testo?: string; link?: string; idempotenza?: string }) {
  const { data: imp } = await supabaseServizio().from("impostazioni").select("marchio").single();
  const marchio = (imp?.marchio ?? {}) as Record<string, string | undefined>;
  const mittente = marchio.email;
  const dest = marchio.email_notifiche || mittente;
  if (!mittente || !dest) return;
  const da = `${marchio.titolare || marchio.nome || ""} <${mittente}>`;
  const t = tabella(n.righe.filter(([, v]) => v));
  const p = (html: string, stile = "") => `<p style="margin:14px 0 6px;${stile}">${html}</p>`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#383838">` +
    p(`<b style="font-size:16px">${escH(n.titolo)}</b>`, "margin-top:0") + t.html +
    (n.testo ? p(escH(n.testo).replace(/\n/g, "<br>"), "padding:8px 10px;background:#f3f3f3") : "") +
    (n.link ? p(`<a href="${escH(n.link)}">Apri la scheda</a>`, "color:#777") : "") + `</div>`;
  const testo = [n.titolo, "", t.testo, n.testo ? `\n${n.testo}` : "", n.link ? `\nScheda: ${n.link}` : ""].join("\n");
  await inviaMail({ da, a: [dest], oggetto: n.oggetto, html, testo, idempotenza: n.idempotenza });
}

import "server-only";

export type Mail = {
  da: string;            // "Nome <indirizzo@dominio>"
  a: string[];
  cc?: string[];
  rispondiA?: string;
  oggetto: string;
  html: string;
  testo: string;
  /** Evita doppioni se la stessa mail viene ritentata. */
  idempotenza?: string;
};

/** Invio con Resend. Non registra mai destinatari o contenuti nei log. */
export async function inviaMail(m: Mail): Promise<{ ok: true } | { ok: false; errore: string }> {
  const chiave = process.env.RESEND_API_KEY;
  if (!chiave) return { ok: false, errore: "RESEND_API_KEY mancante" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chiave}`,
        "Content-Type": "application/json",
        ...(m.idempotenza ? { "Idempotency-Key": m.idempotenza } : {}),
      },
      body: JSON.stringify({
        from: m.da, to: m.a, cc: m.cc?.length ? m.cc : undefined, reply_to: m.rispondiA,
        subject: m.oggetto, html: m.html, text: m.testo,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) return { ok: true };
    const corpo = (await r.json().catch(() => ({}))) as { name?: string };
    return { ok: false, errore: `Resend ${r.status}${corpo.name ? " " + corpo.name : ""}` };
  } catch {
    return { ok: false, errore: "Resend non raggiungibile" };
  }
}

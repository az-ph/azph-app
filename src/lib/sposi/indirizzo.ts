export type Indirizzo = { via: string; cap: string; loc: string; prov: string };

export const PROVINCE = "AG AL AN AO AP AQ AR AT AV BA BG BI BL BN BO BR BS BT BZ CA CB CE CH CL CN CO CR CS CT CZ EN FC FE FG FI FM FR GE GO GR IM IS KR LC LE LI LO LT LU MB MC ME MI MN MO MS MT NA NO NU OR PA PC PD PE PG PI PN PO PR PT PU PV PZ RA RC RE RG RI RM RN RO SA SI SO SP SR SS SU SV TA TE TN TO TP TR TS TV UD VA VB VC VE VI VR VT VV".split(" ");

/** "Via Roma 1 - 46100 Mantova MN" ⇄ quattro caselle, come nella pagina attuale. */
export function dividiIndirizzo(s: string): Indirizzo {
  const m = s.match(/^(.*) - (\d{5}) (.*) ([A-Z]{2})$/);
  return m ? { via: m[1], cap: m[2], loc: m[3], prov: m[4] } : { via: s, cap: "", loc: "", prov: "" };
}
export function unisciIndirizzo(i: Indirizzo): string {
  if (!i.via.trim() && !i.cap.trim() && !i.loc.trim()) return "";
  return `${i.via.trim()} - ${i.cap.trim()} ${i.loc.trim()} ${i.prov}`.trim();
}
/** Vuoto oppure completo (via, CAP di 5 cifre, località, provincia). */
export function indirizzoValido(i: Indirizzo): boolean {
  const vuoto = !i.via.trim() && !i.cap.trim() && !i.loc.trim() && !i.prov;
  return vuoto || (i.via.trim().length >= 3 && /^\d{5}$/.test(i.cap.trim()) && i.loc.trim().length >= 2 && !!i.prov);
}

/** Campi obbligatori della conferma: restituisce le etichette di quelli mancanti o non validi. */
export type SposoForm = { nome: string; telefono: string; email: string; codice_fiscale: string };
export function campiMancanti(sposi: SposoForm[], accetto: boolean): { chiave: string; etichetta: string }[] {
  const out: { chiave: string; etichetta: string }[] = [];
  sposi.forEach((s, i) => {
    const chi = `Sposa/o ${i + 1}`;
    if (s.nome.trim().length < 2) out.push({ chiave: `${i}.nome`, etichetta: `nome e cognome (${chi})` });
    if (s.telefono.replace(/\D/g, "").length < 6) out.push({ chiave: `${i}.telefono`, etichetta: `telefono (${chi})` });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email.trim())) out.push({ chiave: `${i}.email`, etichetta: `email (${chi})` });
    if (!/^[A-Z0-9]{16}$/.test(s.codice_fiscale.replace(/\s/g, "").toUpperCase())) out.push({ chiave: `${i}.codice_fiscale`, etichetta: `codice fiscale di 16 caratteri (${chi})` });
  });
  if (!accetto) out.push({ chiave: "accetto", etichetta: "la spunta di conferma delle condizioni" });
  return out;
}

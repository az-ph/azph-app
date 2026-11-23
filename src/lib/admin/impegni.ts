/** Impegni di un giorno da un calendario iCal (testo .ics). Funzione pura, senza rete. */
import ICAL from "ical.js";

export type Impegno = { titolo: string; intera: boolean; ora?: string };

const FUSO = "Europe/Rome";

/** Mezzanotte di Roma del giorno iso (aaaa-mm-gg), come istante. */
export function mezzanotteRoma(iso: string): number {
  const [a, m, g] = iso.split("-").map(Number);
  const utc = Date.UTC(a, m - 1, g);
  for (const ore of [1, 2]) {
    const t = utc - ore * 3600_000;
    const h = new Intl.DateTimeFormat("en-GB", { timeZone: FUSO, hour: "2-digit", hourCycle: "h23" }).format(new Date(t));
    if (h === "00") return t;
  }
  return utc - 3600_000;
}

const oraRoma = (t: number) => new Intl.DateTimeFormat("it-IT", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" }).format(new Date(t)).replace(":", ".");
const giornoSuccessivo = (iso: string) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + 1)).toISOString().slice(0, 10);

export function impegniNelGiorno(ics: string, iso: string): Impegno[] {
  const radice = new ICAL.Component(ICAL.parse(ics));
  for (const tz of radice.getAllSubcomponents("vtimezone")) {
    const t = new ICAL.Timezone(tz);
    if (!ICAL.TimezoneService.has(t.tzid)) ICAL.TimezoneService.register(t);
  }
  const inizioG = mezzanotteRoma(iso);
  const fineG = mezzanotteRoma(giornoSuccessivo(iso));
  const fineIso = giornoSuccessivo(iso);
  const out: (Impegno & { ordine: number })[] = [];
  const vista = new Set<string>();

  for (const c of radice.getAllSubcomponents("vevent")) {
    if (String(c.getFirstPropertyValue("status") ?? "").toUpperCase() === "CANCELLED") continue;
    const ev = new ICAL.Event(c);
    if (ev.isRecurrenceException()) continue; // le eccezioni arrivano dall'evento principale
    const titolo = (ev.summary || "Impegno").trim();
    const durata = ev.duration;
    const prova = (inizio: ICAL.Time, fine: ICAL.Time | null) => {
      const f = fine ?? (() => { const x = inizio.clone(); if (durata) x.addDuration(durata); else if (inizio.isDate) x.day += 1; return x; })();
      if (inizio.isDate) {
        const da = inizio.toString().slice(0, 10), a = f.toString().slice(0, 10);
        if (da <= iso && (a > iso || (a === da && da === iso))) add({ titolo, intera: true }, 0);
        return;
      }
      const s = inizio.toJSDate().getTime(), e = Math.max(f.toJSDate().getTime(), s + 1);
      if (s < fineG && e > inizioG) {
        const intera = s <= inizioG && e >= fineG;
        const ora = intera ? undefined : s < inizioG ? `fino alle ${oraRoma(e)}` : e > fineG ? `dalle ${oraRoma(s)}` : `${oraRoma(s)}–${oraRoma(e)}`;
        add({ titolo, intera, ora }, Math.max(s, inizioG));
      }
    };
    const add = (x: Impegno, ordine: number) => { const k = `${x.titolo}|${x.ora ?? ""}`; if (!vista.has(k)) { vista.add(k); out.push({ ...x, ordine }); } };

    if (!ev.isRecurring()) { prova(ev.startDate, ev.endDate); continue; }
    const it = ev.iterator();
    for (let n = 0, t = it.next(); t && n < 2000; n++, t = it.next()) {
      if (t.toString().slice(0, 10) > fineIso) break;
      const o = ev.getOccurrenceDetails(t);
      prova(o.startDate, o.endDate);
    }
  }
  return out.sort((a, b) => Number(b.intera) - Number(a.intera) || a.ordine - b.ordine).map(({ titolo, intera, ora }) => (ora ? { titolo, intera, ora } : { titolo, intera }));
}

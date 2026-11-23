/** "aaaa-mm-ggThh:mm" letto come ora di Roma → istante ISO (UTC). Gestisce ora legale e solare. */
export function istanteDaRoma(locale: string): string {
  const base = Date.parse(`${locale}:00Z`);
  for (const ore of [1, 2]) {
    const t = base - ore * 3600_000;
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    if (`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}` === locale) return new Date(t).toISOString();
  }
  return new Date(base - 3600_000).toISOString();
}

/** Istante → "gg.mm.aaaa hh.mm" in ora di Roma. */
export function dataOraRoma(iso: string | null | undefined): string {
  if (!iso) return "";
  const p = Object.fromEntries(new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    .formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}.${p.month}.${p.year} ${p.hour}.${p.minute}`;
}

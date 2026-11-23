import { describe, expect, it } from "vitest";
import { impegniNelGiorno, mezzanotteRoma } from "./impegni";

const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//test//IT
BEGIN:VEVENT
UID:1
DTSTART;VALUE=DATE:20270918
DTEND;VALUE=DATE:20270920
SUMMARY:Ferie
END:VEVENT
BEGIN:VEVENT
UID:2
DTSTART:20270918T080000Z
DTEND:20270918T100000Z
SUMMARY:Shooting aziendale
END:VEVENT
BEGIN:VEVENT
UID:3
DTSTART:20270917T080000Z
DTEND:20270917T100000Z
SUMMARY:Altro giorno
END:VEVENT
BEGIN:VEVENT
UID:4
DTSTART:20270918T120000Z
DTEND:20270918T130000Z
STATUS:CANCELLED
SUMMARY:Annullato
END:VEVENT
BEGIN:VEVENT
UID:5
DTSTART:20260905T150000Z
DTEND:20260905T160000Z
RRULE:FREQ=WEEKLY;BYDAY=SA
SUMMARY:Allenamento
END:VEVENT
BEGIN:VEVENT
UID:6
DTSTART:20270917T200000Z
DTEND:20270918T010000Z
SUMMARY:Notte
END:VEVENT
END:VCALENDAR`;

describe("impegni del giorno", () => {
  it("giornata intera, orari in ora di Roma, ricorrenze, niente annullati", () => {
    const x = impegniNelGiorno(ics, "2027-09-18");
    expect(x).toEqual([
      { titolo: "Ferie", intera: true },
      { titolo: "Notte", intera: false, ora: "fino alle 03.00" },
      { titolo: "Shooting aziendale", intera: false, ora: "10.00–12.00" },
      { titolo: "Allenamento", intera: false, ora: "17.00–18.00" },
    ]);
    expect(impegniNelGiorno(ics, "2027-09-20")).toEqual([]);
  });
  it("mezzanotte di Roma con ora legale e solare", () => {
    expect(new Date(mezzanotteRoma("2027-09-18")).toISOString()).toBe("2027-09-17T22:00:00.000Z");
    expect(new Date(mezzanotteRoma("2027-01-10")).toISOString()).toBe("2027-01-09T23:00:00.000Z");
  });
});

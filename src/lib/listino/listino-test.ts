import type { VoceListino } from "./motore";

/** Listino AZ-ph al 21.11.2026 (dal foglio "Listino"), usato solo nei test di parità. */
export const LISTINO_TEST: VoceListino[] = [
  { codice: "W-REL-1F", categoria: "formula", voce: "[REL][WIDE]", prezzo: 120000, prezzoBarrato: 140000, riepilogo: "servizio" },
  { codice: "N-REL-1F", categoria: "formula", voce: "[REL][NARROW]", prezzo: 100000, prezzoBarrato: 120000, riepilogo: "servizio" },
  { codice: "W-CIV-1F", categoria: "formula", voce: "[CIV][WIDE]", prezzo: 120000, prezzoBarrato: 130000, riepilogo: "servizio" },
  { codice: "N-CIV-1F", categoria: "formula", voce: "[CIV][NARROW]", prezzo: 110000, prezzoBarrato: 120000, riepilogo: "servizio" },
  { codice: "W-SIM-1F", categoria: "formula", voce: "[SIM][WIDE]", prezzo: 120000, prezzoBarrato: 130000, riepilogo: "servizio" },
  { codice: "N-SIM-1F", categoria: "formula", voce: "[SIM][NARROW]", prezzo: 110000, prezzoBarrato: 120000, riepilogo: "servizio" },
  { codice: "share", categoria: "omaggio", voce: "Photo sharing esteso", prezzo: 0, prezzoBarrato: 5000 },
  { codice: "invitati", categoria: "omaggio", voce: "Galleria degli invitati", prezzo: 0, prezzoBarrato: 5000 },
  { codice: "box", categoria: "extra", voce: "Memory box", prezzo: 5000, riepilogo: "memory_box" },
  { codice: "op2-prep", categoria: "extra", voce: "Solo preparativi", prezzo: 15000, gruppo: "Secondo operatore", riepilogo: "secondo_operatore" },
  { codice: "op2-full", categoria: "extra", voce: "Preparativi, cerimonia e aperitivo", prezzo: 50000, gruppo: "Secondo operatore", riepilogo: "secondo_operatore" },
  { codice: "op2-hyb", categoria: "extra", voce: "Foto e video: cerimonia, aperitivo e ricevimento", prezzo: 50000, gruppo: "Secondo operatore", riepilogo: "secondo_operatore", soloSe: "proponi_op2_ibrido,!proponi_video" },
  { codice: "prewdg", categoria: "prewedding", voce: "Servizio prematrimoniale", prezzo: 15000, riepilogo: "prewedding" },
  { codice: "alb-prm", categoria: "album", voce: "Album Premium", prezzo: 55000, riepilogo: "album" },
  { codice: "rep-prm", categoria: "replica", voce: "Album genitori", prezzo: 10000, prezzoBarrato: 12000, collegataA: "alb-prm", riepilogo: "album_genitori" },
  { codice: "alb-std", categoria: "album", voce: "Album Standard", prezzo: 45000, riepilogo: "album" },
  { codice: "video-sguardo", categoria: "video-base", voce: "Pacchetto Sguardo", prezzo: 128757, prezzoBarrato: 135512 },
  { codice: "video", categoria: "video-base", voce: "Pacchetto Emozione", prezzo: 148517, prezzoBarrato: 156312 },
  { codice: "v-trailer", categoria: "video", voce: "Trailer", prezzo: 19661, prezzoBarrato: 20696, collegataA: "video" },
  { codice: "v-pre", categoria: "video", voce: "Prematrimoniale", prezzo: 51896, prezzoBarrato: 51896, collegataA: "video" },
  { codice: "v-express", categoria: "video", voce: "Express editing", prezzo: 39421, prezzoBarrato: 41496, collegataA: "video" },
  { codice: "savedate", categoria: "video", voce: "Save the date", prezzo: 0, collegataA: "video", attiva: false },
  { codice: "v-2op", categoria: "video", voce: "Secondo operatore video", prezzo: 0, collegataA: "video", attiva: false },
  // Pagina congiunta (oggi in AZP.DUO di Code.gs)
  { codice: "duo-photo", categoria: "duo", voce: "Foto + Video · fotografia", prezzo: 119000, prezzoBarrato: 140000 },
  { codice: "duo-video", categoria: "duo", voce: "Pacchetto Emozione", prezzo: 146000, prezzoBarrato: 156312, collegataA: "video" },
  { codice: "duo-box", categoria: "duo", voce: "Memory box condivisa", prezzo: 7000, descrizione: "Chiavetta USB in scatola personalizzata con nomi e data: contiene sia le foto sia il video." },
];

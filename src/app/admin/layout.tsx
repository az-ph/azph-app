import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "./admin.css";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { statoAccesso, supabaseSessione } from "@/lib/supabase/sessione";
import { esci } from "@/app/login/azioni";
import { Rail } from "./rail";

export const dynamic = "force-dynamic";

const HEX = /^#[0-9a-f]{6}$/i;

// Tutta l'area /admin richiede: utente admin + secondo fattore verificato.
export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const s = await statoAccesso();
  if (s.stato === "anonimo") redirect("/login");
  if (s.stato !== "admin") redirect("/accesso");

  const tema = (await cookies()).get("fede_tema")?.value === "scuro" ? "scuro" : "chiaro";
  // Accento dalle impostazioni dell'istanza (colori.accento / accento_scuro, altrimenti i colori del marchio)
  const { data: imp } = await (await supabaseSessione()).from("impostazioni").select("marchio, colori").maybeSingle();
  const colori = (imp?.colori ?? {}) as Record<string, string>;
  const marchio = String(((imp?.marchio ?? {}) as Record<string, unknown>).nome ?? "");
  const chiaro = [colori.accento, colori.verde_scuro].find((c) => c && HEX.test(c));
  const scuro = [colori.accento_scuro, colori.salvia].find((c) => c && HEX.test(c));
  const stile = { ...(chiaro && { "--accento-chiaro": chiaro }), ...(scuro && { "--accento-scuro": scuro }) } as React.CSSProperties;

  return (
    <div className="fede" data-tema={tema} style={stile}>
      <Rail iniziale="F" marchio={marchio} temaIniziale={tema} esci={esci} />
      <div className="pt-14 sm:pt-0 sm:pl-16">
        <main className="px-4 py-6 sm:px-10 sm:py-8 max-w-[1240px]">{children}</main>
      </div>
    </div>
  );
}

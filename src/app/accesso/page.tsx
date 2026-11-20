import { redirect } from "next/navigation";
import { statoAccesso } from "@/lib/supabase/sessione";
import { supabaseSessione } from "@/lib/supabase/sessione";
import { esci } from "@/app/login/azioni";
import { FormCodice } from "./form";

// Secondo passo dell'accesso: attivazione o verifica del codice a due fattori.
export const dynamic = "force-dynamic";

export default async function PaginaAccesso() {
  const s = await statoAccesso();
  if (s.stato === "anonimo") redirect("/login");
  if (s.stato === "admin") redirect("/admin");

  let contenuto: React.ReactNode;
  if (s.stato === "non_admin") {
    contenuto = <p>Questo account non ha accesso all&apos;area di gestione.</p>;
  } else if (s.stato === "serve_codice_2fa") {
    contenuto = (
      <>
        <p className="mb-4 text-sm">Inserisci il codice a 6 cifre dell&apos;app di autenticazione.</p>
        <FormCodice fattoreId={s.fattoreId} />
      </>
    );
  } else {
    // Prima volta: si registra un nuovo fattore TOTP e si mostra il QR.
    const supabase = await supabaseSessione();
    const { data: fattori } = await supabase.auth.mfa.listFactors();
    for (const f of fattori?.all ?? []) {
      if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "App di autenticazione" });
    if (error || !data) {
      contenuto = <p className="text-red-700">Non è stato possibile attivare la verifica in due passaggi. Riprova.</p>;
    } else {
      contenuto = (
        <>
          <p className="mb-4 text-sm">
            Attiva la verifica in due passaggi: inquadra il codice con un&apos;app di autenticazione
            (es. Google Authenticator, 1Password, Authy) e inserisci il codice a 6 cifre.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.totp.qr_code} alt="Codice QR per l'app di autenticazione" className="mx-auto w-48 h-48 mb-4" />
          <details className="mb-4 text-xs text-neutral-600">
            <summary>Non riesci a inquadrarlo?</summary>
            <p className="mt-2 break-all font-mono">{data.totp.secret}</p>
          </details>
          <FormCodice fattoreId={data.id} />
        </>
      );
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-salvia-chiaro">
      <div className="w-full max-w-sm bg-white rounded-lg p-8 shadow-sm">
        <h1 className="font-serif text-2xl mb-6 text-center">Verifica</h1>
        {contenuto}
        <form action={esci} className="mt-6 text-center">
          <button className="text-sm underline text-neutral-600">Esci</button>
        </form>
      </div>
    </main>
  );
}

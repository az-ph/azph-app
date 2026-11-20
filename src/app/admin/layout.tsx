import { redirect } from "next/navigation";
import { statoAccesso } from "@/lib/supabase/sessione";
import { esci } from "@/app/login/azioni";

export const dynamic = "force-dynamic";

// Tutta l'area /admin richiede: utente admin + secondo fattore verificato.
export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const s = await statoAccesso();
  if (s.stato === "anonimo") redirect("/login");
  if (s.stato !== "admin") redirect("/accesso");

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-3 bg-salvia-scuro text-white">
        <span className="font-serif text-lg">AZ-ph · Gestione</span>
        <form action={esci}>
          <button className="text-sm underline">Esci</button>
        </form>
      </header>
      <div className="p-6">{children}</div>
    </div>
  );
}

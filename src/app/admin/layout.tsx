import Link from "next/link";
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
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/admin" className="font-serif text-lg">AZ-ph · Gestione</Link>
          <Link href="/admin" className="underline-offset-4 hover:underline">Matrimoni</Link>
          <Link href="/admin/matrimoni/nuovo" className="underline-offset-4 hover:underline">+ Nuovo</Link>
          <Link href="/admin/importa" className="underline-offset-4 hover:underline opacity-80">Importa</Link>
        </nav>
        <form action={esci}>
          <button className="text-sm underline">Esci</button>
        </form>
      </header>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}

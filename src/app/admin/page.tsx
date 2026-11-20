import { supabaseSessione } from "@/lib/supabase/sessione";

export default async function Oggi() {
  // Prova che il database risponde all'admin con 2FA (RLS + aal2).
  const supabase = await supabaseSessione();
  const { count, error } = await supabase.from("matrimonio").select("id", { count: "exact", head: true });

  return (
    <section>
      <h1 className="font-serif text-2xl mb-4">Oggi</h1>
      {error ? (
        <p className="text-red-700">Il database non risponde: {error.message}</p>
      ) : (
        <p>Accesso completo. Matrimoni nel database: {count ?? 0}.</p>
      )}
    </section>
  );
}

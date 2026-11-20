import { FormLogin } from "./form";

export default function PaginaLogin() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-salvia-chiaro">
      <div className="w-full max-w-sm bg-white rounded-lg p-8 shadow-sm">
        <h1 className="font-serif text-2xl mb-6 text-center">Accesso</h1>
        <FormLogin />
      </div>
    </main>
  );
}

"use client";

import { useActionState } from "react";
import { entra, type EsitoForm } from "./azioni";

export function FormLogin() {
  const [esito, azione, inCorso] = useActionState<EsitoForm, FormData>(entra, {});
  return (
    <form action={azione} className="space-y-4">
      <label className="block">
        <span className="text-sm">Mail</span>
        <input name="email" type="email" autoComplete="username" required
          className="mt-1 w-full border border-neutral-300 rounded px-3 py-2" />
      </label>
      <label className="block">
        <span className="text-sm">Password</span>
        <input name="password" type="password" autoComplete="current-password" required
          className="mt-1 w-full border border-neutral-300 rounded px-3 py-2" />
      </label>
      {esito.errore && <p className="text-sm text-red-700">{esito.errore}</p>}
      <button disabled={inCorso}
        className="w-full bg-salvia-scuro text-white rounded py-2 disabled:opacity-60">
        {inCorso ? "Accesso…" : "Entra"}
      </button>
    </form>
  );
}

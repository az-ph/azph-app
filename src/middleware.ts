import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Rinnova la sessione a ogni richiesta dell'area admin e manda al login chi non è entrato.
// I controlli completi (ruolo, 2FA) sono nel layout di /admin e nel database (RLS).
export async function middleware(request: NextRequest) {
  let risposta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (lista) => {
          lista.forEach(({ name, value }) => request.cookies.set(name, value));
          risposta = NextResponse.next({ request });
          lista.forEach(({ name, value, options }) => risposta.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  if (!data.user && request.nextUrl.pathname.startsWith("/admin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return risposta;
}

export const config = {
  matcher: ["/admin/:path*", "/login", "/accesso/:path*"],
};

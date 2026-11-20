import type { Metadata } from "next";
import "@fontsource/jost/400.css";
import "@fontsource/jost/500.css";
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/600.css";
import "./globals.css";

// Font serviti dall'app stessa: nessuna richiesta a Google Fonts dal browser degli Sposi.

export const metadata: Metadata = {
  title: "AZ-ph",
  description: "AZ-ph · Matrimoni",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body className="antialiased">{children}</body>
    </html>
  );
}

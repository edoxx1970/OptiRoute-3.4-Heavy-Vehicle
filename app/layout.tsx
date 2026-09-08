import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OptiRoute 3.0",
  description: "Gestionale per pianificazione e ottimizzazione dei giri di consegna"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="it"><body>{children}</body></html>;
}
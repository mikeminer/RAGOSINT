import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://ragosint.vercel.app"),
  title: "RAGOSINT",
  description:
    "Radar OSINT/RAG per sviluppatori tech: monitora normative digitali, bandi, gare d'appalto e PNRR, trasformando fonti pubbliche italiane ed europee in segnali operativi, requisiti tecnici e opportunita di progetto.",
  openGraph: {
    title: "RAGOSINT",
    description:
      "Radar OSINT/RAG per sviluppatori tech: normative digitali, bandi, gare d'appalto, PNRR, requisiti tecnici e opportunita di progetto.",
    url: "https://ragosint.vercel.app",
    siteName: "RAGOSINT",
    locale: "it_IT",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

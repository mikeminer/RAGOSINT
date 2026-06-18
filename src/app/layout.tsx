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
  description: "Pipeline OSINT/RAG-ready per normativa italiana, bandi, gare d'appalto e opportunita PNRR.",
  openGraph: {
    title: "RAGOSINT",
    description: "Due feed RSS e una knowledge base Obsidian da fonti pubbliche italiane.",
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

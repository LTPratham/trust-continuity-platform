import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "../lib/WalletContext";
import { Header } from "../components/Header";
import { AppTour } from "../components/AppTour";

export const metadata: Metadata = {
  title: "Trust Continuity Platform — SIH26125 (BEL)",
  description:
    "Blockchain-Based Secure Platform for Identity, Access Control, and Digital Asset Management developed for Bharat Electronics Limited (BEL)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 min-h-screen antialiased flex flex-col font-sans">
        <WalletProvider>
          <Header />
          <AppTour />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </main>
          <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-600">
            Smart India Hackathon 2026 — Problem Statement SIH26125 | Bharat Electronics Limited (BEL) | Trust Continuity Protocol
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}

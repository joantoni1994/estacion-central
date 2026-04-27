import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Home, Settings } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Control Promos B2B",
  description: "Panel financiero de reclamaciones",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.className} flex h-screen bg-gray-50 overflow-hidden`}>
        <aside className="w-64 bg-slate-900 text-white flex flex-col hidden md:flex">
          <div className="p-6 border-b border-slate-800">
            <h1 className="text-xl font-bold tracking-tight text-white">Control Promos</h1>
            <p className="text-xs text-slate-400 mt-1">B2B Financial Panel</p>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            <Link href="/" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 transition text-slate-300 hover:text-white">
              <Home size={20} />
              <span>Dashboard</span>
            </Link>
            <Link href="/configuracion" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 transition text-slate-300 hover:text-white">
              <Settings size={20} />
              <span>Configuración</span>
            </Link>
          </nav>
        </aside>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
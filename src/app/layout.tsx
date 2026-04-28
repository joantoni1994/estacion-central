import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LayoutDashboard, FileSpreadsheet, FolderOpen } from 'lucide-react';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Estación Central",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.className} flex h-screen bg-gray-50 overflow-hidden`}>
        
        {/* MENÚ LATERAL IZQUIERDO */}
        <aside className="w-16 md:w-64 bg-slate-900 text-slate-300 flex flex-col transition-all shrink-0">
          <div className="h-16 flex items-center justify-center md:justify-start md:px-6 font-black text-white border-b border-slate-800 tracking-wider">
            <span className="md:hidden">EC</span>
            <span className="hidden md:inline">ESTACIÓN CENTRAL</span>
          </div>
          <nav className="flex-1 py-4 flex flex-col gap-2 px-2 md:px-4">
            <a href="/" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 hover:text-white transition-colors">
              <LayoutDashboard size={20} className="shrink-0" />
              <span className="hidden md:inline font-medium">Dashboard</span>
            </a>
            <a href="/analizador" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 hover:text-white transition-colors">
              <FileSpreadsheet size={20} className="shrink-0 text-green-400" />
              <span className="hidden md:inline font-medium text-green-400">Analizador Promos</span>
            </a>
            <a href="/archivos" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 hover:text-white transition-colors">
              <FolderOpen size={20} className="shrink-0" />
              <span className="hidden md:inline font-medium">Archivos Guardados</span>
            </a>
          </nav>
        </aside>

        {/* CONTENIDO PRINCIPAL */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

      </body>
    </html>
  );
}
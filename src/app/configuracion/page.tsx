"use client";

import { FormEvent, useState } from "react";
import { Database, FileSpreadsheet, RefreshCcw } from "lucide-react";

export default function ConfiguracionPage() {
  const [excelBodegas, setExcelBodegas] = useState<File | null>(null);
  const [excelArticulos, setExcelArticulos] = useState<File | null>(null);
  const [estado, setEstado] = useState<string>("");
  const [sincronizando, setSincronizando] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!excelBodegas || !excelArticulos) {
      setEstado("Debes seleccionar ambos archivos Excel antes de sincronizar.");
      return;
    }

    try {
      setSincronizando(true);
      setEstado("Sincronizando...");

      const formData = new FormData();
      formData.append("excelBodegas", excelBodegas);
      formData.append("excelArticulos", excelArticulos);

      const response = await fetch("/api/sincronizar-excels", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        setEstado(data.error ?? "No se pudo completar la sincronizacion.");
        return;
      }

      setEstado(data.message ?? "Base de datos actualizada.");
    } catch {
      setEstado("Error inesperado al sincronizar los datos maestros.");
    } finally {
      setSincronizando(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-100 px-6 py-10 text-zinc-900 lg:px-10">
      <section className="mx-auto w-full max-w-4xl space-y-6">
        <header className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                Configuracion
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
                Sincronizacion de datos maestros
              </h1>
              <p className="mt-2 text-zinc-600">
                Carga los Excels de bodegas y articulos para actualizar la base de datos.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-zinc-500">
              <Database className="h-5 w-5" />
            </div>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-950">Archivos Excel</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                  <FileSpreadsheet className="h-4 w-4 text-zinc-500" />
                  Excel de Bodegas
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(event) => setExcelBodegas(event.target.files?.[0] ?? null)}
                  className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-zinc-800"
                  required
                />
              </label>

              <label className="space-y-2">
                <span className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                  <FileSpreadsheet className="h-4 w-4 text-zinc-500" />
                  Excel de Articulos
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(event) => setExcelArticulos(event.target.files?.[0] ?? null)}
                  className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-zinc-800"
                  required
                />
              </label>
            </div>
          </article>

          <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <button
              type="submit"
              disabled={sincronizando}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-500"
            >
              <RefreshCcw className={`h-4 w-4 ${sincronizando ? "animate-spin" : ""}`} />
              {sincronizando ? "Sincronizando Datos Maestros..." : "Sincronizar Datos Maestros"}
            </button>

            {estado && (
              <p className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                {estado}
              </p>
            )}
          </article>
        </form>
      </section>
    </main>
  );
}

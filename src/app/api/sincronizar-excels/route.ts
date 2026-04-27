import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const excelBodegas = formData.get("excelBodegas");
    const excelArticulos = formData.get("excelArticulos");

    if (!(excelBodegas instanceof File) || !(excelArticulos instanceof File)) {
      return NextResponse.json(
        { error: "Debes enviar los dos archivos Excel para sincronizar." },
        { status: 400 },
      );
    }

    const bodegasBuffer = Buffer.from(await excelBodegas.arrayBuffer());
    const articulosBuffer = Buffer.from(await excelArticulos.arrayBuffer());

    const workbookBodegas = XLSX.read(bodegasBuffer, { type: "buffer" });
    const workbookArticulos = XLSX.read(articulosBuffer, { type: "buffer" });

    const nombreHojaBodegas = workbookBodegas.SheetNames[0];
    const nombreHojaArticulos = workbookArticulos.SheetNames[0];

    if (!nombreHojaBodegas || !nombreHojaArticulos) {
      return NextResponse.json(
        { error: "No se pudo encontrar una hoja valida en uno de los Excels." },
        { status: 400 },
      );
    }

    const sheetBodegas = workbookBodegas.Sheets[nombreHojaBodegas];
    const sheetArticulos = workbookArticulos.Sheets[nombreHojaArticulos];

    const filasBodegas = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(sheetBodegas, {
      header: 1,
      defval: "",
    });
    const filasArticulos = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(sheetArticulos, {
      header: 1,
      defval: "",
    });

    let bodegasProcesadas = 0;
    let bodegasFallidas = 0;
    let productosProcesados = 0;
    let productosFallidos = 0;

    await prisma.producto.deleteMany({});
    await prisma.bodega.deleteMany({});

    for (const [index, fila] of filasBodegas.entries()) {
      if (index === 0) {
        continue;
      }
      if (!Array.isArray(fila) || fila.length === 0) {
        continue;
      }

      const codigoBodega = String(fila[0] ?? "").trim();

      if (!codigoBodega) {
        continue;
      }

      console.log("Procesando fila:", fila);

      const id = String(fila[0]).trim();
      const nombre = fila[1] ? String(fila[1]).trim() : "Sin Nombre";

      try {
        await prisma.bodega.upsert({
          where: { id },
          update: {
            nombre,
          },
          create: {
            id,
            nombre,
          },
        });
        bodegasProcesadas += 1;
      } catch (error) {
        console.error("Error en fila:", fila, error);
        bodegasFallidas += 1;
        continue;
      }
    }

    for (const [index, fila] of filasArticulos.entries()) {
      if (index === 0) {
        continue;
      }
      if (!Array.isArray(fila) || fila.length === 0) {
        continue;
      }

      const codigoBodega = String(fila[0] ?? "").trim();
      const codigoArticulo = String(fila[1] ?? "").trim();
      const nombreArticulo = String(fila[2] ?? "").trim();
      const costeLimpio = String(fila[3] || "0").replace(",", ".");
      const precioCoste = parseFloat(costeLimpio);
      const idBodega = String(fila[0]).trim();

      if (!codigoArticulo || !codigoBodega || !idBodega || Number.isNaN(precioCoste)) {
        continue;
      }

      console.log("Procesando fila:", fila);

      try {
        await prisma.bodega.upsert({
          where: { id: idBodega },
          update: {},
          create: {
            id: idBodega,
            nombre: "Sin Nombre",
          },
        });

        await prisma.producto.upsert({
          where: { id: codigoArticulo },
          update: {
            sku: codigoArticulo,
            nombre: nombreArticulo || codigoArticulo,
            costeBase: precioCoste,
            bodegaId: idBodega,
          },
          create: {
            id: codigoArticulo,
            sku: codigoArticulo,
            nombre: nombreArticulo || codigoArticulo,
            costeBase: precioCoste,
            bodegaId: idBodega,
          },
        });
        productosProcesados += 1;
      } catch (error) {
        console.error("Error en fila:", fila, error);
        productosFallidos += 1;
        continue;
      }
    }

    return NextResponse.json({
      success: true,
      bodegas: {
        exitosas: bodegasProcesadas,
        fallidas: bodegasFallidas,
      },
      articulos: {
        exitosas: productosProcesados,
        fallidas: productosFallidos,
      },
    });
  } catch (error) {
    console.error("Error sincronizando excels:", error);
    return NextResponse.json(
      { error: "Error al procesar los archivos Excel y sincronizar la base de datos." },
      { status: 500 },
    );
  }
}

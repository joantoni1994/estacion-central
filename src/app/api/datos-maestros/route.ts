export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const bodegas = await prisma.bodega.findMany({
      include: { productos: true },
      orderBy: { id: "asc" },
    });

    return NextResponse.json(bodegas);
  } catch (error) {
    console.error("Error obteniendo datos maestros:", error);
    return NextResponse.json({ error: "No se pudieron cargar los datos maestros." }, { status: 500 });
  }
}

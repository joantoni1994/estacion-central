import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });

const prisma = new PrismaClient({ adapter });

async function main() {
  const bodegaId = "200";
  const bodegaNombre = "Bodega X";
  const bodega = await prisma.bodega.upsert({
    where: { id: bodegaId },
    update: { nombre: bodegaNombre },
    create: { id: bodegaId, nombre: bodegaNombre },
  });

  await prisma.producto.upsert({
    where: { sku: "VT-RES-001" },
    update: {
      id: "VT-RES-001",
      nombre: "Vino Tinto Reserva",
      costeBase: 10,
      bodegaId: bodega.id,
    },
    create: {
      id: "VT-RES-001",
      sku: "VT-RES-001",
      nombre: "Vino Tinto Reserva",
      costeBase: 10,
      bodegaId: bodega.id,
    },
  });

  await prisma.acuerdo.deleteMany({
    where: {
      bodegaId: bodega.id,
      tipo: { in: ["PORCENTAJE", "SIN_CARGO"] },
    },
  });

  await prisma.acuerdo.createMany({
    data: [
      {
        bodegaId: bodega.id,
        tipo: "PORCENTAJE",
        valor: 10,
        activo: true,
      },
      {
        bodegaId: bodega.id,
        tipo: "SIN_CARGO",
        valor: 1,
        activo: true,
      },
    ],
  });

  console.log("Seed completado: Bodega, Producto y Acuerdos de ejemplo creados.");
}

main()
  .catch((error) => {
    console.error("Error en seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

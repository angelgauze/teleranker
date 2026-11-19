import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

/**
 * Prisma 7 requires a driver adapter. The client is cached on globalThis in
 * development so hot reloads do not open a new pool per request.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set; see .env.example");
    }

    const adapter = new PrismaPg({ connectionString });
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }

  return globalForPrisma.prisma;
}

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

import { runSeed } from "./run-seed.ts";

try {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Seed: DATABASE_URL is required.");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await runSeed(prisma);
  } finally {
    await prisma.$disconnect();
  }
} catch (error: unknown) {
  process.stderr.write(`${error instanceof Error ? error.message : "Seed failed."}\n`);
  process.exitCode = 1;
}

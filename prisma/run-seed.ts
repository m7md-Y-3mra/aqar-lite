import { hash } from "@node-rs/argon2";
import type { PrismaClient } from "../src/generated/prisma/client.ts";

import { SEED_DATA, SEED_PASSWORD } from "./seed-data.ts";

export async function runSeed(db: PrismaClient, data = SEED_DATA): Promise<void> {
  const firstCompany = data.companies[0];
  if (!firstCompany) throw new Error("Seed: expected at least one company.");

  if (await db.company.findUnique({ where: { id: firstCompany.id } })) {
    process.stdout.write("Seed: seed data already present, skipping.\n");
    return;
  }

  const users = await Promise.all(
    data.users.map(async (user) => ({ ...user, passwordHash: await hash(SEED_PASSWORD) })),
  );

  await db.$transaction(async (tx) => {
    await tx.company.createMany({ data: [...data.companies] });
    await tx.user.createMany({ data: users });
    await tx.unit.createMany({ data: [...data.units] });
    await tx.client.createMany({ data: [...data.clients] });
  });

  process.stdout.write(
    `Seed: created ${data.companies.length} companies, ${users.length} users, ${data.units.length} units, ${data.clients.length} clients.\n`,
  );
}

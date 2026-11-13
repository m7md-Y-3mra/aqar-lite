import { expect, it } from "vitest";

import {
  dbNow,
  releaseExpired,
  reserveUnitIfAvailable,
} from "@/features/units/server/units.repository";
import { getDb, withTransaction } from "@/server/db";
import {
  makeClient,
  makeCompany,
  makeReservation,
  makeUnit,
  makeUser,
} from "../../../support/db-fixtures";
import { waitForLockWait } from "../../../support/pg-locks";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function fixture() {
  const company = await makeCompany();
  const rep = await makeUser(company.id);
  const client = await makeClient(company.id, rep.id);
  const unit = await makeUnit(company.id, { status: "RESERVED" });
  const input = { companyId: company.id, unitId: unit.id, clientId: client.id, salesRepId: rep.id };
  const reservation = await makeReservation(input);
  await getDb().reservation.update({
    where: { id: reservation.id },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });
  return { company, unit, input, reservation };
}

it("release during an open reserve never frees the unit", async () => {
  const { company, unit, input } = await fixture();
  const ready = deferred();
  const commit = deferred();
  const a = withTransaction(async (tx) => {
    expect(await releaseExpired(company.id, tx)).toBe(1);
    expect(await reserveUnitIfAvailable(company.id, unit.id, tx)).toBe(1);
    const now = await dbNow(tx);
    await tx.reservation.create({
      data: { ...input, expiresAt: new Date(now.getTime() + 72 * 60 * 60 * 1000) },
    });
    ready.resolve();
    await commit.promise;
  });
  // Propagate setup failures instead of waiting indefinitely for readiness.
  await Promise.race([ready.promise, a]);
  const b = Promise.resolve(releaseExpired(company.id));
  try {
    await waitForLockWait("%FOR UPDATE%");
  } finally {
    commit.resolve();
    await a;
    await b;
  }
  expect(await getDb().unit.findUnique({ where: { id: unit.id } })).toMatchObject({
    status: "RESERVED",
  });
  expect(await b).toBe(0);
  expect(
    await getDb().reservation.count({
      where: { unitId: unit.id, expiresAt: { gt: await dbNow() } },
    }),
  ).toBe(1);
});

it("releaseExpired frees a unit whose expiresAt equals the transaction now", async () => {
  const { company, unit, reservation } = await fixture();
  await withTransaction(async (tx) => {
    const now = await dbNow(tx);
    await tx.reservation.update({ where: { id: reservation.id }, data: { expiresAt: now } });
    expect(await releaseExpired(company.id, tx)).toBe(1);
    expect(await tx.unit.findUnique({ where: { id: unit.id } })).toMatchObject({
      status: "AVAILABLE",
    });
  });
});

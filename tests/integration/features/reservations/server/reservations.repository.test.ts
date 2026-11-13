import { expect, it } from "vitest";

import {
  findActiveReservations,
  countActiveReservations,
} from "@/features/reservations/server/reservations.repository";
import { withTransaction } from "@/server/db";
import { makeClient, makeReservation, makeUnit } from "../../../support/db-fixtures";
import { makeTwoCompanies } from "../../../support/session-users";

it("findActiveReservations excludes a row whose expiresAt equals now", async () => {
  const { a } = await makeTwoCompanies();
  const unit = await makeUnit(a.companyId);
  const client = await makeClient(a.companyId, a.sales1.userId);
  const reservation = await makeReservation({
    companyId: a.companyId,
    unitId: unit.id,
    clientId: client.id,
    salesRepId: a.sales1.userId,
  });
  await withTransaction(async (tx) => {
    const filter = { salesRepId: a.sales1.userId, now: reservation.expiresAt };
    expect(await findActiveReservations(a.companyId, filter, { skip: 0, take: 20 }, tx)).toEqual(
      [],
    );
    expect(await countActiveReservations(a.companyId, filter, tx)).toBe(0);
  });
});

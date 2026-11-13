import { beforeEach, describe, expect, it } from "vitest";

import {
  countContracts,
  dbClock,
  dbNow,
  findContract,
  findContracts,
  findOwnReservation,
  insertContract,
  insertInstallments,
  lockContract,
  markApproved,
  sumPaidByContract,
  updateDraftTerms,
} from "@/features/contracts/server/contracts.repository";
import { lockUnit, markUnitSold } from "@/features/units/server/units.repository";
import { getDb, withTransaction } from "@/server/db";
import {
  expectDbError,
  makeClient,
  makeContract,
  makeInstallment,
  makeReservation,
  makeUnit,
} from "../../../support/db-fixtures";
import { makeTwoCompanies } from "../../../support/session-users";

let companies: Awaited<ReturnType<typeof makeTwoCompanies>>;
const terms = { finalPrice: 30_000, downPayment: 0, installmentCount: 3 };

beforeEach(async () => {
  companies = await makeTwoCompanies();
});

async function fixture(owner = companies.a.sales1) {
  const unit = await makeUnit(owner.companyId, { status: "RESERVED" });
  const client = await makeClient(owner.companyId, owner.userId);
  const reservation = await makeReservation({
    companyId: owner.companyId,
    unitId: unit.id,
    clientId: client.id,
    salesRepId: owner.userId,
  });
  return { unit, reservation };
}

describe("contracts repository", () => {
  it("every query filters by companyId", async () => {
    const own = await fixture();
    const foreign = await fixture(companies.b.sales1);
    const ownContract = await makeContract(companies.a.companyId, own.reservation.id);
    const foreignContract = await makeContract(companies.b.companyId, foreign.reservation.id);
    await makeInstallment(ownContract.id, { paidAmount: 100n });
    await makeInstallment(foreignContract.id, { paidAmount: 200n });
    const companyId = companies.a.companyId;

    expect(await findOwnReservation(companyId, companies.b.sales1.userId, foreign.reservation.id))
      .toBeNull();
    expect(await findOwnReservation(companyId, companies.a.sales2.userId, own.reservation.id))
      .toBeNull();
    expect(await findContract(companyId, foreignContract.id)).toBeNull();
    expect(await findContract(companyId, ownContract.id, { salesRepId: companies.a.sales2.userId }))
      .toBeNull();
    expect((await findContracts(companyId, { skip: 0, take: 20 })).map(({ id }) => id))
      .toEqual([ownContract.id]);
    expect(await findContracts(companyId, {
      salesRepId: companies.b.sales1.userId, skip: 0, take: 20,
    })).toEqual([]);
    expect(await countContracts(companyId)).toBe(1);
    expect(await countContracts(companyId, { salesRepId: companies.b.sales1.userId })).toBe(0);
    expect(await sumPaidByContract(companyId, [ownContract.id, foreignContract.id])).toEqual([
      { contractId: ownContract.id, _sum: { paidAmount: 100n } },
    ]);

    await withTransaction(async (tx) => {
      expect(await lockContract(companyId, foreignContract.id, tx)).toBeNull();
      expect(await updateDraftTerms(companyId, foreignContract.id, terms, tx)).toBe(0);
      expect(await markApproved(companyId, foreignContract.id, await dbNow(tx), tx)).toBe(0);
      expect(await lockUnit(companyId, foreign.unit.id, tx)).toBeNull();
      expect(await markUnitSold(companyId, foreign.unit.id, tx)).toBe(0);
    });
    expect(await getDb().contract.findUnique({ where: { id: foreignContract.id } }))
      .toEqual(foreignContract);
    expect(await getDb().unit.findUnique({ where: { id: foreign.unit.id } })).toEqual(foreign.unit);

    const foreignWithoutContract = await fixture(companies.b.sales1);
    await expectDbError(withTransaction((tx) => insertContract(companyId, {
      ...terms, reservationId: foreignWithoutContract.reservation.id,
    }, tx)), { code: "23503" });
    expect(await getDb().contract.count({
      where: { reservationId: foreignWithoutContract.reservation.id },
    })).toBe(0);
  });

  it("insertInstallments with company A's id for company B's contract → NOT_FOUND, no rows", async () => {
    const foreign = await fixture(companies.b.sales1);
    const contract = await makeContract(companies.b.companyId, foreign.reservation.id);
    await expect(withTransaction((tx) => insertInstallments(companies.a.companyId, contract.id, [
      { seq: 1, dueDate: "2027-02-28", amount: 100 },
    ], tx))).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await getDb().installment.count({ where: { contractId: contract.id } })).toBe(0);
  });

  it("stored due date reads back as the same YYYY-MM-DD", async () => {
    const own = await fixture();
    const contract = await withTransaction((tx) => insertContract(companies.a.companyId, {
      ...terms, reservationId: own.reservation.id,
    }, tx));
    const lines = [
      { seq: 1, dueDate: "2028-02-29", amount: 10_000 },
      { seq: 2, dueDate: "2028-03-31", amount: 10_000 },
      { seq: 3, dueDate: "2028-04-30", amount: 10_000 },
    ];
    await withTransaction((tx) => insertInstallments(companies.a.companyId, contract.id, lines, tx));
    const row = await findContract(companies.a.companyId, contract.id);
    expect(row!.installments.map((line) => ({
      seq: line.seq,
      dueDate: line.dueDate.toISOString().slice(0, 10),
      amount: Number(line.amount),
    }))).toEqual(lines);
  });

  it("own draft queries and conditional writes use the supplied transaction", async () => {
    const companyId = companies.a.companyId;
    const own = await fixture();
    await withTransaction(async (tx) => {
      const contract = await insertContract(companyId, { ...terms, reservationId: own.reservation.id }, tx);
      const reservation = await findOwnReservation(companyId, companies.a.sales1.userId, own.reservation.id, tx);
      expect(reservation).toMatchObject({
        id: own.reservation.id, contract: { id: contract.id },
        unit: { id: own.unit.id, price: own.unit.price },
      });
      expect(await updateDraftTerms(companyId, contract.id, { ...terms, finalPrice: 40_000 }, tx)).toBe(1);
      expect(await lockContract(companyId, contract.id, tx)).toMatchObject({
        id: contract.id, finalPrice: 40_000n, unitId: own.unit.id, unitPrice: own.unit.price,
        expiresAt: own.reservation.expiresAt, approvedAt: null,
      });
      expect(await countContracts(companyId, {}, tx)).toBe(1);
      expect(await findContracts(companyId, { skip: 0, take: 20 }, tx)).toHaveLength(1);
      expect(await findContract(companyId, contract.id, {}, tx)).toMatchObject({ finalPrice: 40_000n });
      expect(await sumPaidByContract(companyId, [contract.id], tx)).toEqual([]);
      expect(await lockUnit(companyId, own.unit.id, tx)).toBe("RESERVED");
      const now = await dbNow(tx);
      expect((await dbClock(tx)).getTime()).toBeGreaterThanOrEqual(now.getTime());
      expect(await markApproved(companyId, contract.id, now, tx)).toBe(1);
      expect(await markApproved(companyId, contract.id, now, tx)).toBe(0);
      expect(await updateDraftTerms(companyId, contract.id, terms, tx)).toBe(0);
      expect(await markUnitSold(companyId, own.unit.id, tx)).toBe(1);
      expect(await markUnitSold(companyId, own.unit.id, tx)).toBe(0);
    });
  });
});

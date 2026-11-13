import { beforeEach, expect, it } from "vitest";

import { getDb } from "@/server/db";
import { expectDbError, makeContractChain, makeInstallment } from "../support/db-fixtures";

let chain: Awaited<ReturnType<typeof makeContractChain>>;

beforeEach(async () => {
  chain = await makeContractChain();
});

it("final_price above 1e11 fails (23514)", async () => {
  await expectDbError(
    getDb()
      .$executeRaw`UPDATE contracts SET final_price = 100000000001 WHERE id = ${chain.contractId}::uuid`,
    { code: "23514", constraint: "contracts_final_price_max_check" },
  );
});

async function approve() {
  await getDb().contract.update({
    where: { id: chain.contractId },
    data: { approvedAt: new Date() },
  });
}

it("UPDATE of an approved contract fails", async () => {
  await approve();
  await expectDbError(
    getDb()
      .$executeRaw`UPDATE contracts SET installment_count = 2 WHERE id = ${chain.contractId}::uuid`,
    { code: "P0001" },
  );
  expect(
    (await getDb().contract.findUniqueOrThrow({ where: { id: chain.contractId } }))
      .installmentCount,
  ).toBe(10);
});

it("DELETE of an approved contract fails", async () => {
  await approve();
  await expectDbError(
    getDb().$executeRaw`DELETE FROM contracts WHERE id = ${chain.contractId}::uuid`,
    { code: "P0001" },
  );
  expect(await getDb().contract.count({ where: { id: chain.contractId } })).toBe(1);
});

it("UPDATE of a draft succeeds", async () => {
  expect(
    await getDb()
      .$executeRaw`UPDATE contracts SET installment_count = 2 WHERE id = ${chain.contractId}::uuid`,
  ).toBe(1);
});

it("UPDATE installments SET amount fails", async () => {
  const line = await makeInstallment(chain.contractId);
  await expectDbError(
    getDb().$executeRaw`UPDATE installments SET amount = amount + 100 WHERE id = ${line.id}::uuid`,
    { code: "P0001" },
  );
  expect((await getDb().installment.findUniqueOrThrow({ where: { id: line.id } })).amount).toBe(
    line.amount,
  );
});

it("UPDATE installments SET paid_amount succeeds", async () => {
  const line = await makeInstallment(chain.contractId);
  expect(
    await getDb()
      .$executeRaw`UPDATE installments SET paid_amount = 100 WHERE id = ${line.id}::uuid`,
  ).toBe(1);
});

it("DELETE installment fails", async () => {
  const line = await makeInstallment(chain.contractId);
  await expectDbError(getDb().$executeRaw`DELETE FROM installments WHERE id = ${line.id}::uuid`, {
    code: "P0001",
  });
  expect(await getDb().installment.count({ where: { id: line.id } })).toBe(1);
});

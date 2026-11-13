import { beforeEach, describe, expect, it } from "vitest";

import * as paymentsRoute from "@/app/api/contracts/[id]/payments/route";
import { SESSION_COOKIE } from "@/server/auth/session-token";
import { makeSession } from "../../../support/db-fixtures";
import { apiRequest, readJson } from "../../../support/http";
import { makeTwoCompanies } from "../../../support/session-users";
import { makeApprovedContract, newKey, paymentCount } from "./payments-fixtures";

const { GET, POST } = paymentsRoute;

let companies: Awaited<ReturnType<typeof makeTwoCompanies>>;

beforeEach(async () => {
  companies = await makeTwoCompanies();
});

async function sessionCookie(userId: string) {
  const token = await makeSession(userId, new Date(Date.now() + 86_400_000));
  return `${SESSION_COOKIE}=${token}`;
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

function postPayment(
  contractId: string,
  cookie: string,
  body: unknown,
  key: string | null = newKey(),
) {
  const request = apiRequest(`/api/contracts/${contractId}/payments`, {
    method: "POST",
    cookie,
    body,
  });
  if (key !== null) request.headers.set("Idempotency-Key", key);
  return POST(request, ctx(contractId));
}

function getPayments(contractId: string, cookie: string) {
  return GET(
    apiRequest(`/api/contracts/${contractId}/payments`, { method: "GET", cookie }),
    ctx(contractId),
  );
}

type ErrorBody = {
  error: { code: string; message: string; fieldErrors?: Record<string, string[]> };
};

describe("POST /api/contracts/{id}/payments", () => {
  it("accountant records → 201; the same request again → 200 with the same body", async () => {
    const contract = await makeApprovedContract(companies.a.sales1);
    const cookie = await sessionCookie(companies.a.accountant.userId);
    const key = newKey();

    const first = await postPayment(contract.id, cookie, { amount: 250_000 }, key);
    const second = await postPayment(contract.id, cookie, { amount: 250_000 }, key);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(await readJson(second)).toEqual(await readJson(first));
    expect(await paymentCount(contract.id)).toBe(1);
  });

  it("same key with a different amount → 409 IDEMPOTENCY_KEY_REUSED naming the saved amount", async () => {
    const contract = await makeApprovedContract(companies.a.sales1);
    const cookie = await sessionCookie(companies.a.accountant.userId);
    const key = newKey();
    await postPayment(contract.id, cookie, { amount: 250_000 }, key);

    const res = await postPayment(contract.id, cookie, { amount: 300_000 }, key);
    const body = (await readJson(res)) as ErrorBody;
    expect(res.status).toBe(409);
    expect(body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
    expect(body.error.message).toContain("2,500.00");
    expect(await paymentCount(contract.id)).toBe(1);
  });

  it("overpayment → 409 PAYMENT_EXCEEDS_REMAINING naming the remaining amount", async () => {
    const contract = await makeApprovedContract(companies.a.sales1);
    const cookie = await sessionCookie(companies.a.accountant.userId);

    const res = await postPayment(contract.id, cookie, { amount: contract.finalPrice + 1 });
    const body = (await readJson(res)) as ErrorBody;
    expect(res.status).toBe(409);
    expect(body.error.code).toBe("PAYMENT_EXCEEDS_REMAINING");
    expect(body.error.message).toContain("80,000.00");
    expect(await paymentCount(contract.id)).toBe(0);
  });

  it("sales rep and manager → 403, nothing saved", async () => {
    const contract = await makeApprovedContract(companies.a.sales1);
    for (const user of [companies.a.sales1, companies.a.manager]) {
      const res = await postPayment(contract.id, await sessionCookie(user.userId), {
        amount: 100,
      });
      expect(res.status).toBe(403);
    }
    expect(await paymentCount(contract.id)).toBe(0);
  });

  it("another company's contract → 404", async () => {
    const contract = await makeApprovedContract(companies.a.sales1);
    const res = await postPayment(contract.id, await sessionCookie(companies.b.accountant.userId), {
      amount: 100,
    });
    expect(res.status).toBe(404);
  });

  it("amount 0 → 400 with fieldErrors.amount", async () => {
    const contract = await makeApprovedContract(companies.a.sales1);
    const res = await postPayment(contract.id, await sessionCookie(companies.a.accountant.userId), {
      amount: 0,
    });
    const body = (await readJson(res)) as ErrorBody;
    expect(res.status).toBe(400);
    expect(body.error.fieldErrors?.amount).toEqual(["المبلغ يجب أن يكون أكبر من صفر"]);
  });

  it.each([null, "", "k".repeat(101)])("Idempotency-Key %j → 400, nothing saved", async (key) => {
    const contract = await makeApprovedContract(companies.a.sales1);
    const res = await postPayment(
      contract.id,
      await sessionCookie(companies.a.accountant.userId),
      { amount: 100 },
      key,
    );
    const body = (await readJson(res)) as ErrorBody;
    expect(res.status).toBe(400);
    expect(body.error.fieldErrors?.idempotencyKey).toBeDefined();
    expect(await paymentCount(contract.id)).toBe(0);
  });
});

describe("GET /api/contracts/{id}/payments", () => {
  it("manager gets the list; sales rep gets 403", async () => {
    const contract = await makeApprovedContract(companies.a.sales1);
    const manager = await getPayments(contract.id, await sessionCookie(companies.a.manager.userId));
    expect(manager.status).toBe(200);
    expect(await readJson(manager)).toEqual({
      data: { approved: true, remaining: contract.finalPrice, payments: [] },
    });

    const rep = await getPayments(contract.id, await sessionCookie(companies.a.sales1.userId));
    expect(rep.status).toBe(403);
  });

  it("another company's contract → 404", async () => {
    const contract = await makeApprovedContract(companies.a.sales1);
    const res = await getPayments(contract.id, await sessionCookie(companies.b.manager.userId));
    expect(res.status).toBe(404);
  });
});

describe("route module", () => {
  it("exports only GET and POST (no edit or delete)", () => {
    expect(Object.keys(paymentsRoute).sort()).toEqual(["GET", "POST"]);
  });
});

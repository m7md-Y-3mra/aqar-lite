import { randomUUID } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { expect } from "vitest";

import { generateSessionToken, hashSessionToken } from "@/server/auth/session-token";
import { getDb } from "@/server/db";

type Db = ReturnType<typeof getDb>;
type User = Awaited<ReturnType<Db["user"]["create"]>>;
type Unit = Awaited<ReturnType<Db["unit"]["create"]>>;
type Client = Awaited<ReturnType<Db["client"]["create"]>>;
type Contract = Awaited<ReturnType<Db["contract"]["create"]>>;
type Installment = Awaited<ReturnType<Db["installment"]["create"]>>;
type Payment = Awaited<ReturnType<Db["payment"]["create"]>>;

type UnitOverrides = Partial<
  Pick<Unit, "id" | "projectName" | "number" | "type" | "area" | "rooms" | "price" | "status">
>;
type ClientOverrides = Partial<Pick<Client, "id" | "name" | "phone" | "notes">>;
type ContractOverrides = Partial<
  Pick<Contract, "id" | "finalPrice" | "downPayment" | "installmentCount" | "approvedAt">
>;
type InstallmentOverrides = Partial<
  Pick<Installment, "id" | "seq" | "dueDate" | "amount" | "paidAmount">
>;
type PaymentOverrides = Partial<Pick<Payment, "id" | "amount" | "idempotencyKey" | "createdAt">>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function expectDbError(
  promise: PromiseLike<unknown>,
  expected: { code: string; constraint?: string },
): Promise<void> {
  let failure: unknown;
  try {
    await promise;
  } catch (error: unknown) {
    failure = error;
  }

  expect(failure, "Expected the database operation to reject").toBeDefined();
  if (!isRecord(failure) || !isRecord(failure.meta)) {
    throw new Error("Expected a database error with metadata");
  }
  const adapterError = failure.meta.driverAdapterError;
  if (!isRecord(adapterError) || !isRecord(adapterError.cause)) {
    throw new Error("Expected a database driver error cause");
  }

  expect(adapterError.cause.originalCode).toBe(expected.code);
  if (expected.constraint !== undefined) {
    expect(adapterError.cause.originalMessage).toBeTypeOf("string");
    expect(adapterError.cause.originalMessage).toContain(expected.constraint);
  }
}

export function makeCompany() {
  return getDb().company.create({
    data: { id: randomUUID(), name: "شركة اختبار" },
  });
}

export function makeUser(companyId: string, role: User["role"] = "SALES") {
  const id = randomUUID();
  return getDb().user.create({
    data: {
      id,
      companyId,
      name: "مستخدم اختبار",
      email: `${id}@fixtures.test`,
      passwordHash: "fixture-password-hash",
      role,
    },
  });
}

export async function makeUserWithPassword(
  companyId: string,
  password: string,
  role: User["role"] = "SALES",
) {
  const id = randomUUID();
  const email = `${id}@fixtures.test`;
  const user = await getDb().user.create({
    data: {
      id,
      companyId,
      name: "مستخدم اختبار",
      email,
      passwordHash: await hash(password),
      role,
    },
  });

  return { user, email };
}

export function makeLoginFailure({
  email,
  reason,
  createdAt,
  userId,
  companyId,
}: {
  email: string;
  reason: "invalid_credentials" | "locked";
  createdAt: Date;
  userId?: string;
  companyId?: string;
}) {
  expect(email).toBe(email.trim().toLowerCase());
  return getDb().auditLog.create({
    data: {
      action: "LOGIN_FAILED",
      companyId,
      userId,
      meta: { email, reason },
      createdAt,
    },
  });
}

export async function makeSession(userId: string, expiresAt: Date): Promise<string> {
  const token = generateSessionToken();
  await getDb().session.create({
    data: { id: hashSessionToken(token), userId, expiresAt },
  });
  return token;
}

export function makeUnit(companyId: string, overrides: UnitOverrides = {}) {
  const id = randomUUID();
  return getDb().unit.create({
    data: {
      id,
      companyId,
      projectName: "مشروع اختبار",
      number: id,
      type: "APARTMENT",
      area: 120,
      rooms: 3,
      price: 100_000_00n,
      status: "AVAILABLE",
      ...overrides,
    },
  });
}

export function makeClient(companyId: string, salesRepId: string, overrides: ClientOverrides = {}) {
  return getDb().client.create({
    data: {
      id: randomUUID(),
      companyId,
      salesRepId,
      name: "عميل اختبار",
      phone: "0500000000",
      notes: null,
      ...overrides,
    },
  });
}

export function makeReservation(input: {
  companyId: string;
  unitId: string;
  clientId: string;
  salesRepId: string;
}) {
  return getDb().reservation.create({
    data: {
      id: randomUUID(),
      ...input,
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
    },
  });
}

export function makeContract(
  companyId: string,
  reservationId: string,
  overrides: ContractOverrides = {},
) {
  return getDb().contract.create({
    data: {
      id: randomUUID(),
      companyId,
      reservationId,
      finalPrice: 100_000_00n,
      downPayment: 0n,
      installmentCount: 10,
      approvedAt: null,
      ...overrides,
    },
  });
}

export function makeInstallment(contractId: string, overrides: InstallmentOverrides = {}) {
  return getDb().installment.create({
    data: {
      id: randomUUID(),
      contractId,
      seq: 1,
      dueDate: new Date(Date.UTC(2026, 0, 31)),
      amount: 1_000_000n,
      paidAmount: 0n,
      ...overrides,
    },
  });
}

export function makePayment(contractId: string, overrides: PaymentOverrides = {}) {
  return getDb().payment.create({
    data: {
      id: randomUUID(),
      contractId,
      amount: 100_000n,
      idempotencyKey: randomUUID(),
      ...overrides,
    },
  });
}

export async function makeContractChain() {
  const company = await makeCompany();
  const salesRep = await makeUser(company.id);
  const unit = await makeUnit(company.id);
  const client = await makeClient(company.id, salesRep.id);
  const reservation = await makeReservation({
    companyId: company.id,
    unitId: unit.id,
    clientId: client.id,
    salesRepId: salesRep.id,
  });
  const contract = await makeContract(company.id, reservation.id);

  return {
    companyId: company.id,
    salesRepId: salesRep.id,
    unitId: unit.id,
    clientId: client.id,
    reservationId: reservation.id,
    contractId: contract.id,
  };
}

import { beforeEach, describe, expect, it } from "vitest";

import {
  createClient,
  getClient,
  listClients,
  updateClient,
} from "@/features/clients/server/clients.service";
import { clientInputSchema, clientListQuerySchema } from "@/features/clients/clients.schemas";
import { getDb } from "@/server/db";
import { AppError } from "@/server/http/app-error";
import { makeClient } from "../../../support/db-fixtures";
import { makeTwoCompanies } from "../../../support/session-users";

let companies: Awaited<ReturnType<typeof makeTwoCompanies>>;
const input = clientInputSchema.parse({ name: "عميل جديد", phone: "0500000000", notes: "ملاحظات" });
const query = clientListQuerySchema.parse({});

beforeEach(async () => {
  companies = await makeTwoCompanies();
});

describe("create", () => {
  it("owner and company come from the session", async () => {
    const parsed = clientInputSchema.parse({
      ...input,
      companyId: companies.b.companyId,
      salesRepId: companies.b.sales1.userId,
    });
    const result = await createClient(companies.a.sales1, parsed);
    expect(result).toEqual({
      id: expect.any(String),
      ...input,
      salesRep: { id: companies.a.sales1.userId, name: companies.a.sales1.name },
    });
    expect(await getDb().client.findUnique({ where: { id: result.id } })).toMatchObject({
      companyId: companies.a.companyId,
      salesRepId: companies.a.sales1.userId,
    });
  });
  it("duplicate phone across reps is accepted", async () => {
    await createClient(companies.a.sales1, input);
    const result = await createClient(companies.a.sales2, input);
    expect(result.phone).toBe(input.phone);
    expect(await getDb().client.count({ where: { companyId: companies.a.companyId } })).toBe(2);
  });
});

describe("ownership", () => {
  it("rep list shows only own clients", async () => {
    const own = await makeClient(companies.a.companyId, companies.a.sales1.userId);
    await makeClient(companies.a.companyId, companies.a.sales2.userId);
    const page = await listClients(companies.a.sales1, query);
    expect(page.total).toBe(1);
    expect(page.items.map((item) => item.id)).toEqual([own.id]);
  });
  it("rep reading another rep's client → NOT_FOUND", async () => {
    const other = await makeClient(companies.a.companyId, companies.a.sales2.userId);
    await expect(getClient(companies.a.sales1, other.id)).rejects.toEqual(
      new AppError("NOT_FOUND"),
    );
  });
  it("rep edits own client", async () => {
    const own = await makeClient(companies.a.companyId, companies.a.sales1.userId);
    const result = await updateClient(companies.a.sales1, own.id, input);
    expect(result).toMatchObject({
      id: own.id,
      ...input,
      salesRep: { id: companies.a.sales1.userId },
    });
    expect(await getDb().client.findUnique({ where: { id: own.id } })).toMatchObject(input);
  });
  it("rep editing another rep's client → NOT_FOUND, unchanged", async () => {
    const other = await makeClient(companies.a.companyId, companies.a.sales2.userId);
    await expect(updateClient(companies.a.sales1, other.id, input)).rejects.toEqual(
      new AppError("NOT_FOUND"),
    );
    expect(await getDb().client.findUnique({ where: { id: other.id } })).toEqual(other);
  });
});

describe("list", () => {
  it("ordered by name then id, pageSize respected", async () => {
    const rows = await Promise.all(
      ["B", "A", "A"].map((name) =>
        makeClient(companies.a.companyId, companies.a.sales1.userId, { name }),
      ),
    );
    const expected = rows.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    for (let page = 1; page <= 3; page++) {
      const result = await listClients(companies.a.sales1, { page, pageSize: 1 });
      expect(result).toMatchObject({ total: 3, page, pageSize: 1 });
      expect(result.items.map((item) => item.id)).toEqual([expected[page - 1]?.id]);
    }
  });
});

describe("notes", () => {
  it("HTML-like notes returned exactly as typed", async () => {
    const notes = "<b>مهم</b>\n<script>alert(1)</script>";
    const created = await createClient(companies.a.sales1, { ...input, notes });
    expect(created.notes).toBe(notes);
    expect((await getClient(companies.a.sales1, created.id)).notes).toBe(notes);
  });
});

describe("read-only roles", () => {
  it.each(["manager", "accountant"] as const)(
    "%s lists all company clients with salesRep",
    async (role) => {
      const own = await makeClient(companies.a.companyId, companies.a.sales1.userId, { name: "A" });
      const other = await makeClient(companies.a.companyId, companies.a.sales2.userId, {
        name: "B",
      });
      const result = await listClients(companies.a[role], query);
      expect(result.total).toBe(2);
      expect(result.items.map((item) => ({ id: item.id, salesRep: item.salesRep }))).toEqual([
        { id: own.id, salesRep: { id: companies.a.sales1.userId, name: companies.a.sales1.name } },
        {
          id: other.id,
          salesRep: { id: companies.a.sales2.userId, name: companies.a.sales2.name },
        },
      ]);
    },
  );
  it.each(["manager", "accountant"] as const)("%s reads any company client", async (role) => {
    for (const owner of [companies.a.sales1, companies.a.sales2]) {
      const client = await makeClient(companies.a.companyId, owner.userId);
      expect(await getClient(companies.a[role], client.id)).toMatchObject({
        id: client.id,
        salesRep: { id: owner.userId, name: owner.name },
      });
    }
  });
});

describe("role checks", () => {
  it.each(["manager", "accountant"] as const)("%s cannot create/update", async (role) => {
    const client = await makeClient(companies.a.companyId, companies.a.sales1.userId);
    await expect(createClient(companies.a[role], input)).rejects.toEqual(new AppError("FORBIDDEN"));
    await expect(updateClient(companies.a[role], client.id, input)).rejects.toEqual(
      new AppError("FORBIDDEN"),
    );
    expect(await getDb().client.findUnique({ where: { id: client.id } })).toEqual(client);
    expect(await getDb().client.count({ where: { companyId: companies.a.companyId } })).toBe(1);
  });
});

describe("tenant isolation", () => {
  it.each(["manager", "sales1", "accountant"] as const)(
    "getClient of company B → NOT_FOUND for %s",
    async (role) => {
      const foreign = await makeClient(companies.b.companyId, companies.b.sales1.userId);
      await expect(getClient(companies.a[role], foreign.id)).rejects.toEqual(
        new AppError("NOT_FOUND"),
      );
    },
  );

  it.each(["manager", "sales1", "accountant"] as const)(
    "updateClient of company B → NOT_FOUND for %s, unchanged",
    async (role) => {
      const foreign = await makeClient(companies.b.companyId, companies.b.sales1.userId);
      await expect(updateClient(companies.a[role], foreign.id, input)).rejects.toEqual(
        new AppError("NOT_FOUND"),
      );
      expect(await getDb().client.findUnique({ where: { id: foreign.id } })).toEqual(foreign);
    },
  );

  it.each(["manager", "sales1", "accountant"] as const)(
    "client list excludes company B for %s",
    async (role) => {
      const own = await makeClient(companies.a.companyId, companies.a.sales1.userId);
      await makeClient(companies.b.companyId, companies.b.sales1.userId);
      const result = await listClients(companies.a[role], query);
      expect(result.total).toBe(1);
      expect(result.items.map((client) => client.id)).toEqual([own.id]);
    },
  );
});

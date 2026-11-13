import { afterAll, describe, expect, it } from "vitest";

import {
  countClients,
  findClient,
  findClients,
  insertClient,
  updateOwnClient,
} from "@/features/clients/server/clients.repository";
import { getDb } from "@/server/db";
import { makeClient, makeCompany, makeUser } from "../../../support/db-fixtures";

const updatedInput = { name: "اسم جديد", phone: "0555555555", notes: "ملاحظات جديدة" };

afterAll(async () => {
  await getDb().$disconnect();
});

describe("clients repository", () => {
  it("findClients with salesRepId returns only that rep's clients", async () => {
    const company = await makeCompany();
    const salesRep = await makeUser(company.id);
    const otherRep = await makeUser(company.id);
    const ownClient = await makeClient(company.id, salesRep.id);
    await makeClient(company.id, otherRep.id);

    const clients = await findClients(company.id, { salesRepId: salesRep.id }, 1, 20);

    expect(clients.map(({ id }) => id)).toEqual([ownClient.id]);
    expect(clients[0]?.salesRep).toEqual({ id: salesRep.id, name: salesRep.name });
    expect(await countClients(company.id, { salesRepId: salesRep.id })).toBe(1);
  });

  it("findClients without salesRepId returns all company clients", async () => {
    const company = await makeCompany();
    const salesRep = await makeUser(company.id);
    const otherRep = await makeUser(company.id);
    const first = await makeClient(company.id, salesRep.id, { name: "A" });
    const second = await makeClient(company.id, otherRep.id, { name: "B" });

    const clients = await findClients(company.id, {}, 1, 20);

    expect(clients.map(({ id }) => id)).toEqual([first.id, second.id]);
    expect(clients.map(({ salesRep: owner }) => owner)).toEqual([
      { id: salesRep.id, name: salesRep.name },
      { id: otherRep.id, name: otherRep.name },
    ]);
    expect(await countClients(company.id, {})).toBe(2);
  });

  it("never returns another company's clients", async () => {
    const company = await makeCompany();
    const otherCompany = await makeCompany();
    const salesRep = await makeUser(company.id);
    const otherRep = await makeUser(otherCompany.id);
    const ownClient = await makeClient(company.id, salesRep.id);
    await makeClient(otherCompany.id, otherRep.id);

    expect((await findClients(company.id, {}, 1, 20)).map(({ id }) => id)).toEqual([ownClient.id]);
    expect(await countClients(company.id, {})).toBe(1);
    expect(await findClients(company.id, { salesRepId: otherRep.id }, 1, 20)).toEqual([]);
    expect(await countClients(company.id, { salesRepId: otherRep.id })).toBe(0);
  });

  it("ordered by name then id", async () => {
    const company = await makeCompany();
    const salesRep = await makeUser(company.id);
    const last = await makeClient(company.id, salesRep.id, { name: "B" });
    const second = await makeClient(company.id, salesRep.id, {
      id: "00000000-0000-4000-8000-000000000002",
      name: "A",
    });
    const first = await makeClient(company.id, salesRep.id, {
      id: "00000000-0000-4000-8000-000000000001",
      name: "A",
    });

    expect((await findClients(company.id, {}, 1, 20)).map(({ id }) => id)).toEqual([
      first.id,
      second.id,
      last.id,
    ]);
    expect((await findClients(company.id, {}, 2, 2)).map(({ id }) => id)).toEqual([last.id]);
    expect(await findClients(company.id, {}, 3, 2)).toEqual([]);
    expect(await countClients(company.id, {})).toBe(3);
  });

  it("findClient with another rep's salesRepId → null", async () => {
    const company = await makeCompany();
    const salesRep = await makeUser(company.id);
    const otherRep = await makeUser(company.id);
    const client = await makeClient(company.id, salesRep.id);

    expect(await findClient(company.id, client.id, otherRep.id)).toBeNull();
    expect(await findClient(company.id, client.id, salesRep.id)).toMatchObject({
      id: client.id,
      salesRep: { id: salesRep.id, name: salesRep.name },
    });
    expect(await findClient(company.id, client.id)).toMatchObject({
      id: client.id,
      salesRep: { id: salesRep.id, name: salesRep.name },
    });
  });

  it("findClient for another company → null", async () => {
    const company = await makeCompany();
    const otherCompany = await makeCompany();
    const otherRep = await makeUser(otherCompany.id);
    const client = await makeClient(otherCompany.id, otherRep.id);

    expect(await findClient(company.id, client.id)).toBeNull();
  });

  it("updateOwnClient for another rep → 0 and unchanged", async () => {
    const company = await makeCompany();
    const salesRep = await makeUser(company.id);
    const otherRep = await makeUser(company.id);
    const client = await makeClient(company.id, salesRep.id);

    expect(await updateOwnClient(company.id, client.id, otherRep.id, updatedInput)).toBe(0);
    expect(await getDb().client.findUnique({ where: { id: client.id } })).toEqual(client);
  });

  it("updateOwnClient for another company → 0", async () => {
    const company = await makeCompany();
    const otherCompany = await makeCompany();
    const otherRep = await makeUser(otherCompany.id);
    const client = await makeClient(otherCompany.id, otherRep.id);

    expect(await updateOwnClient(company.id, client.id, otherRep.id, updatedInput)).toBe(0);
    expect(await getDb().client.findUnique({ where: { id: client.id } })).toEqual(client);
  });

  it("insertClient keeps notes exactly as given (HTML-like text, line breaks)", async () => {
    const company = await makeCompany();
    const salesRep = await makeUser(company.id);
    const notes = "<b>مهم</b>\n<script>alert(1)</script>";

    const client = await insertClient(company.id, salesRep.id, { ...updatedInput, notes });

    expect(client).toMatchObject({
      companyId: company.id,
      salesRepId: salesRep.id,
      name: updatedInput.name,
      phone: updatedInput.phone,
      notes,
    });
    expect(client.salesRep).toEqual({ id: salesRep.id, name: salesRep.name });
    expect((await getDb().client.findUniqueOrThrow({ where: { id: client.id } })).notes).toBe(
      notes,
    );
  });

  it("updateOwnClient updates only the owner's client", async () => {
    const company = await makeCompany();
    const salesRep = await makeUser(company.id);
    const client = await makeClient(company.id, salesRep.id);

    expect(await updateOwnClient(company.id, client.id, salesRep.id, updatedInput)).toBe(1);
    expect(await findClient(company.id, client.id, salesRep.id)).toMatchObject({
      ...updatedInput,
      companyId: company.id,
      salesRepId: salesRep.id,
      salesRep: { id: salesRep.id, name: salesRep.name },
    });
  });
});

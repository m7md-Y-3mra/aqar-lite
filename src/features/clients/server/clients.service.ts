import "server-only";

import type { SessionUser } from "@/server/auth/session.service";
import { withTransaction } from "@/server/db";
import { AppError } from "@/server/http/app-error";
import type { ClientDto, ClientInput, ClientListQuery, ClientPage } from "../clients.types";
import {
  countClients,
  findClient,
  findClients,
  insertClient,
  updateOwnClient,
} from "./clients.repository";

function toClientDto(row: Awaited<ReturnType<typeof findClients>>[number]): ClientDto {
  return { id: row.id, name: row.name, phone: row.phone, notes: row.notes, salesRep: row.salesRep };
}

function scopeFor(user: SessionUser) {
  return user.role === "SALES" ? user.userId : undefined;
}

export async function listClients(user: SessionUser, query: ClientListQuery): Promise<ClientPage> {
  const scope = { salesRepId: scopeFor(user) };
  const [rows, total] = await Promise.all([
    findClients(user.companyId, scope, query.page, query.pageSize),
    countClients(user.companyId, scope),
  ]);
  return { items: rows.map(toClientDto), total, page: query.page, pageSize: query.pageSize };
}

export async function getClient(user: SessionUser, id: string): Promise<ClientDto> {
  const row = await findClient(user.companyId, id, scopeFor(user));
  if (row === null) throw new AppError("NOT_FOUND");
  return toClientDto(row);
}

export async function createClient(user: SessionUser, input: ClientInput): Promise<ClientDto> {
  if (user.role !== "SALES") throw new AppError("FORBIDDEN");
  return toClientDto(await insertClient(user.companyId, user.userId, input));
}

export async function updateClient(
  user: SessionUser,
  id: string,
  input: ClientInput,
): Promise<ClientDto> {
  return withTransaction(async (tx) => {
    const row = await findClient(user.companyId, id, scopeFor(user), tx);
    if (row === null) throw new AppError("NOT_FOUND");
    if (user.role !== "SALES") throw new AppError("FORBIDDEN");
    const count = await updateOwnClient(user.companyId, id, user.userId, input, tx);
    if (count === 0) throw new AppError("NOT_FOUND");
    const updated = await findClient(user.companyId, id, scopeFor(user), tx);
    if (updated === null) throw new AppError("NOT_FOUND");
    return toClientDto(updated);
  });
}

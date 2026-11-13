import "server-only";

import { insertAuditLog } from "@/server/audit/audit.repository";
import type { SessionUser } from "@/server/auth/session.service";
import { isUniqueViolation, withTransaction } from "@/server/db";
import { AppError } from "@/server/http/app-error";
import { UNIT_NUMBER_TAKEN } from "../units.schemas";
import type { UnitDto, UnitInput, UnitListQuery, UnitPage } from "../units.types";
import {
  countUnits,
  dbNow,
  findActiveExpiries,
  findUnit,
  findUnits,
  insertUnit,
  releaseExpired,
  updateUnitDetails,
  updateUnitPriceIfAvailable,
} from "./units.repository";

function toUnitDto(
  row: Awaited<ReturnType<typeof findUnits>>[number],
  reservedUntil: string | null = null,
): UnitDto {
  return {
    id: row.id,
    projectName: row.projectName,
    number: row.number,
    type: row.type,
    area: row.area,
    rooms: row.rooms,
    price: Number(row.price),
    status: row.status,
    reservedUntil: row.status === "RESERVED" ? reservedUntil : null,
  };
}

export async function listUnits(user: SessionUser, query: UnitListQuery): Promise<UnitPage> {
  await releaseExpired(user.companyId);
  const now = await dbNow();
  const [rows, total] = await Promise.all([
    findUnits(user.companyId, query),
    countUnits(user.companyId, query),
  ]);
  const expiries = await findActiveExpiries(
    user.companyId,
    rows.filter((row) => row.status === "RESERVED").map((row) => row.id),
    now,
  );
  const expiryByUnit = new Map(expiries.map((row) => [row.unitId, row.expiresAt.toISOString()]));
  return {
    items: rows.map((row) => toUnitDto(row, expiryByUnit.get(row.id) ?? null)),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getUnit(user: SessionUser, id: string): Promise<UnitDto> {
  await releaseExpired(user.companyId);
  const now = await dbNow();
  const row = await findUnit(user.companyId, id);
  if (row === null) throw new AppError("NOT_FOUND");
  const expiries = await findActiveExpiries(
    user.companyId,
    row.status === "RESERVED" ? [row.id] : [],
    now,
  );
  return toUnitDto(row, expiries[0]?.expiresAt.toISOString() ?? null);
}

export async function createUnit(user: SessionUser, input: UnitInput): Promise<UnitDto> {
  if (user.role !== "MANAGER") throw new AppError("FORBIDDEN");
  try {
    return toUnitDto(await insertUnit(user.companyId, input));
  } catch (err) {
    if (isUniqueViolation(err, "units_company_id_project_name_number_key")) {
      throw new AppError("VALIDATION_ERROR", { number: [UNIT_NUMBER_TAKEN] });
    }
    throw err;
  }
}

export async function updateUnit(
  user: SessionUser,
  id: string,
  input: UnitInput,
): Promise<UnitDto> {
  try {
    return await withTransaction(async (tx) => {
      await releaseExpired(user.companyId, tx);
      const now = await dbNow(tx);
      const unit = await findUnit(user.companyId, id, tx);
      if (unit === null) throw new AppError("NOT_FOUND");
      if (user.role !== "MANAGER") throw new AppError("FORBIDDEN");

      if (BigInt(input.price) === unit.price) {
        await updateUnitDetails(user.companyId, id, input, tx);
      } else {
        const count = await updateUnitPriceIfAvailable(user.companyId, id, input, unit.price, tx);
        if (count === 0) {
          const current = await findUnit(user.companyId, id, tx);
          if (current === null) throw new AppError("NOT_FOUND");
          if (current.status !== "AVAILABLE") throw new AppError("UNIT_PRICE_LOCKED");
          throw new AppError("UNIT_CHANGED");
        }
        await insertAuditLog(
          {
            action: "PRICE_CHANGED",
            companyId: user.companyId,
            userId: user.userId,
            entityId: id,
            meta: { oldPrice: Number(unit.price), newPrice: input.price },
            createdAt: new Date(),
          },
          tx,
        );
      }

      const updated = await findUnit(user.companyId, id, tx);
      if (updated === null) throw new AppError("NOT_FOUND");
      const expiries = await findActiveExpiries(
        user.companyId,
        updated.status === "RESERVED" ? [updated.id] : [],
        now,
        tx,
      );
      return toUnitDto(updated, expiries[0]?.expiresAt.toISOString() ?? null);
    });
  } catch (err) {
    if (isUniqueViolation(err, "units_company_id_project_name_number_key")) {
      throw new AppError("VALIDATION_ERROR", { number: [UNIT_NUMBER_TAKEN] });
    }
    throw err;
  }
}

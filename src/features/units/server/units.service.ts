import "server-only";

import type { SessionUser } from "@/server/auth/session.service";
import { AppError } from "@/server/http/app-error";
import type { UnitDto, UnitListQuery, UnitPage } from "../units.types";
import { countUnits, findUnit, findUnits, releaseExpired } from "./units.repository";

function toUnitDto(row: Awaited<ReturnType<typeof findUnits>>[number]): UnitDto {
  return {
    id: row.id,
    projectName: row.projectName,
    number: row.number,
    type: row.type,
    area: row.area,
    rooms: row.rooms,
    price: Number(row.price),
    status: row.status,
  };
}

export async function listUnits(user: SessionUser, query: UnitListQuery): Promise<UnitPage> {
  await releaseExpired(user.companyId);
  const [rows, total] = await Promise.all([
    findUnits(user.companyId, query),
    countUnits(user.companyId, query),
  ]);
  return { items: rows.map(toUnitDto), total, page: query.page, pageSize: query.pageSize };
}

export async function getUnit(user: SessionUser, id: string): Promise<UnitDto> {
  await releaseExpired(user.companyId);
  const row = await findUnit(user.companyId, id);
  if (row === null) throw new AppError("NOT_FOUND");
  return toUnitDto(row);
}

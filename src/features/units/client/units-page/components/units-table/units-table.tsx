import Link from "next/link";

import { Button, buttonVariants } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { formatRiyadhDateTime } from "@/shared/lib/dates";
import { formatRiyals } from "@/shared/lib/money";
import { UNIT_TYPE_LABELS } from "../../../unit-labels";
import { UnitStatusBadge } from "../unit-status-badge";
import type { UnitsTableProps } from "./types";

export function UnitsTable({ units, canEdit, canReserve, dimmed, onReserve }: UnitsTableProps) {
  return (
    <div className="min-w-0 overflow-x-auto">
      <Table aria-label="الوحدات" aria-busy={dimmed} className={dimmed ? "opacity-50" : undefined}>
        <TableHeader>
          <TableRow>
            <TableHead>المشروع</TableHead>
            <TableHead>رقم الوحدة</TableHead>
            <TableHead>النوع</TableHead>
            <TableHead>المساحة (م²)</TableHead>
            <TableHead>الغرف</TableHead>
            <TableHead>السعر (ريال)</TableHead>
            <TableHead>الحالة</TableHead>
            {(canEdit || canReserve) && <TableHead>الإجراءات</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {units.map((unit) => (
            <TableRow key={unit.id}>
              <TableCell>{unit.projectName}</TableCell>
              <TableCell>
                <span dir="ltr">{unit.number}</span>
              </TableCell>
              <TableCell>{UNIT_TYPE_LABELS[unit.type]}</TableCell>
              <TableCell>
                <span dir="ltr">{unit.area}</span>
              </TableCell>
              <TableCell>
                <span dir="ltr">{unit.rooms}</span>
              </TableCell>
              <TableCell>
                <span dir="ltr">{formatRiyals(unit.price)}</span>
              </TableCell>
              <TableCell>
                <UnitStatusBadge status={unit.status} />
                {unit.status === "RESERVED" && unit.reservedUntil && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    حتى <span dir="ltr">{formatRiyadhDateTime(unit.reservedUntil)}</span>
                  </p>
                )}
              </TableCell>
              {(canEdit || canReserve) && (
                <TableCell>
                  {canEdit && (
                    <Link
                      href={`/units/${unit.id}/edit`}
                      className={buttonVariants({ variant: "link", size: "sm" })}
                      aria-label={`تعديل الوحدة ${unit.number}`}
                    >
                      تعديل
                    </Link>
                  )}
                  {canReserve && unit.status === "AVAILABLE" && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => onReserve(unit.id)}
                      aria-label={`حجز الوحدة ${unit.number}`}
                    >
                      حجز
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

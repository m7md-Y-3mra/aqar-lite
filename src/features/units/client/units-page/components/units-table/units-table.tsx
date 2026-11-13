import Link from "next/link";

import { buttonVariants } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { formatRiyals } from "@/shared/lib/money";
import { UNIT_TYPE_LABELS } from "../../../unit-labels";
import { UnitStatusBadge } from "../unit-status-badge";
import type { UnitsTableProps } from "./types";

export function UnitsTable({ units, canEdit, dimmed }: UnitsTableProps) {
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
            {canEdit && <TableHead>الإجراءات</TableHead>}
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
              </TableCell>
              {canEdit && (
                <TableCell>
                  <Link
                    href={`/units/${unit.id}/edit`}
                    className={buttonVariants({ variant: "link", size: "sm" })}
                    aria-label={`تعديل الوحدة ${unit.number}`}
                  >
                    تعديل
                  </Link>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

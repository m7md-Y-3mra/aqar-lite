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
import { formatRiyadhDateTime, formatTimeLeft } from "@/shared/lib/dates";
import type { ReservationsTableProps } from "./types";

export function ReservationsTable({
  reservations,
  asOf,
  showRep,
  showContractLink,
  dimmed,
}: ReservationsTableProps) {
  return (
    <div className="min-w-0 overflow-x-auto">
      <Table
        aria-label="الحجوزات النشطة"
        aria-busy={dimmed}
        className={dimmed ? "opacity-50" : undefined}
      >
        <TableHeader>
          <TableRow>
            <TableHead>الوحدة</TableHead>
            <TableHead>العميل</TableHead>
            {showRep && <TableHead>مندوب المبيعات</TableHead>}
            <TableHead>ينتهي في</TableHead>
            <TableHead>المتبقي</TableHead>
            {showContractLink && <TableHead>العقد</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {reservations.map((reservation) => (
            <TableRow key={reservation.id}>
              <TableCell>
                {reservation.unit.projectName} – {reservation.unit.number}
              </TableCell>
              <TableCell>{reservation.client.name}</TableCell>
              {showRep && <TableCell>{reservation.salesRep.name}</TableCell>}
              <TableCell>
                <span dir="ltr">{formatRiyadhDateTime(reservation.expiresAt)}</span>
              </TableCell>
              <TableCell>{formatTimeLeft(reservation.expiresAt, asOf)}</TableCell>
              {showContractLink && (
                <TableCell>
                  <Link
                    href={
                      reservation.contractId === null
                        ? `/contracts/new?reservationId=${reservation.id}`
                        : `/contracts/${reservation.contractId}`
                    }
                    className={buttonVariants({ variant: "link" })}
                  >
                    {reservation.contractId === null ? "إنشاء عقد" : "عرض العقد"}
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

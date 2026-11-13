import Link from "next/link";

import { Badge } from "@/shared/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { formatRiyals } from "@/shared/lib/money";
import { contractStatusLabels } from "../../../contract-labels";
import type { ContractsTableProps } from "./types";

export function ContractsTable({ contracts, dimmed }: ContractsTableProps) {
  return (
    <div className="min-w-0 overflow-x-auto">
      <Table aria-label="العقود" aria-busy={dimmed} className={dimmed ? "opacity-50" : undefined}>
        <TableHeader><TableRow>
          <TableHead>الوحدة</TableHead><TableHead>المشروع</TableHead><TableHead>العميل</TableHead>
          <TableHead>المندوب</TableHead><TableHead>السعر النهائي (ريال)</TableHead>
          <TableHead>المتبقي (ريال)</TableHead><TableHead>الحالة</TableHead>
        </TableRow></TableHeader>
        <TableBody>{contracts.map((contract) => (
          <TableRow key={contract.id}>
            <TableCell><Link className="underline underline-offset-4" href={`/contracts/${contract.id}`}>{contract.unit.number}</Link></TableCell>
            <TableCell>{contract.unit.projectName}</TableCell><TableCell>{contract.client.name}</TableCell>
            <TableCell>{contract.salesRep.name}</TableCell><TableCell>{formatRiyals(contract.finalPrice)}</TableCell>
            <TableCell>{formatRiyals(contract.remaining)}</TableCell>
            <TableCell><Badge variant={contract.reservationExpired ? "destructive" : "secondary"}>
              {contract.reservationExpired ? "انتهى الحجز" : contractStatusLabels[contract.status]}
            </Badge></TableCell>
          </TableRow>
        ))}</TableBody>
      </Table>
    </div>
  );
}

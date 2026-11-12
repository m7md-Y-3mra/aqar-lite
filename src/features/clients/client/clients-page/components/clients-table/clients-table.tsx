import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import type { ClientsTableProps } from "./types";

export function ClientsTable({ clients, showOwner, dimmed }: ClientsTableProps) {
  return (
    <div className="min-w-0 overflow-x-auto">
      <Table aria-label="العملاء" aria-busy={dimmed} className={dimmed ? "opacity-50" : undefined}>
        <TableHeader>
          <TableRow>
            <TableHead>الاسم</TableHead>
            <TableHead>الهاتف</TableHead>
            {showOwner && <TableHead>المندوب</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.id}>
              <TableCell>
                <Link href={`/clients/${client.id}`} className="underline underline-offset-4">
                  {client.name}
                </Link>
              </TableCell>
              <TableCell>
                <span dir="ltr">{client.phone}</span>
              </TableCell>
              {showOwner && <TableCell>{client.salesRep.name}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

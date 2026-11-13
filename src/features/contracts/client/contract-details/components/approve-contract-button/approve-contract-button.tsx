"use client";

import { Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { formatRiyals } from "@/shared/lib/money";
import type { ApproveContractButtonProps } from "./types";
import { useApproveContractButton } from "./use-approve-contract-button";

export function ApproveContractButton(props: ApproveContractButtonProps) {
  const { open, setOpen, confirm, isPending, errorMessage } = useApproveContractButton(props);

  return (
    <div className="space-y-3">
      {errorMessage && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      {props.canApprove && (
        <>
          <Button type="button" onClick={() => setOpen(true)} disabled={isPending}>
            اعتماد
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent dir="rtl" showCloseButton={!isPending}>
              <DialogHeader>
                <DialogTitle>اعتماد العقد</DialogTitle>
                <DialogDescription>
                  سيُثبّت جدول الأقساط وتصبح الوحدة مباعة. لا يمكن تعديل العقد بعد اعتماده.
                </DialogDescription>
              </DialogHeader>
              <dl className="space-y-2">
                <div>
                  <dt>السعر النهائي</dt>
                  <dd>{formatRiyals(props.terms.finalPrice)} ريال</dd>
                </div>
                <div>
                  <dt>الدفعة المقدمة</dt>
                  <dd>{formatRiyals(props.terms.downPayment)} ريال</dd>
                </div>
                <div>
                  <dt>عدد الأقساط</dt>
                  <dd>{props.terms.installmentCount}</dd>
                </div>
              </dl>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => setOpen(false)}
                >
                  تراجع
                </Button>
                <Button type="button" disabled={isPending} onClick={confirm}>
                  {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                  {isPending ? "جارٍ الاعتماد…" : "تأكيد الاعتماد"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

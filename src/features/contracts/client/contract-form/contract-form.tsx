"use client";

import { Controller } from "react-hook-form";

import { MoneyInput } from "@/shared/components/money-input";
import { ScheduleTable } from "@/shared/components/schedule-table";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { formatRiyals } from "@/shared/lib/money";
import { ESTIMATED_DATES_LABEL } from "../contract-labels";
import type { ContractFormProps } from "./types";
import { useContractForm } from "./use-contract-form";

export function ContractForm(props: ContractFormProps) {
  const { form, errors, isPending, onSubmit, lines, minimum } = useContractForm(props);
  return (
    <form noValidate onSubmit={onSubmit} className="space-y-6">
      {errors.root?.message && <Alert variant="destructive"><AlertDescription>{errors.root.message}</AlertDescription></Alert>}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="finalPrice">السعر النهائي (ريال)</Label>
          <Controller control={form.control} name="finalPrice" render={({ field }) => (
            <MoneyInput id="finalPrice" name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur}
              disabled={isPending} aria-invalid={!!errors.finalPrice} aria-describedby="finalPrice-hint finalPrice-error" />
          )} />
          <p id="finalPrice-hint" className="text-sm text-muted-foreground">أقل سعر مسموح هو {formatRiyals(minimum)} ريال</p>
          {errors.finalPrice?.message && <p id="finalPrice-error" className="text-sm text-destructive">{errors.finalPrice.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="downPayment">الدفعة المقدمة (ريال)</Label>
          <Controller control={form.control} name="downPayment" render={({ field }) => (
            <MoneyInput id="downPayment" name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur}
              disabled={isPending} aria-invalid={!!errors.downPayment} aria-describedby="downPayment-error" />
          )} />
          {errors.downPayment?.message && <p id="downPayment-error" className="text-sm text-destructive">{errors.downPayment.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="installmentCount">عدد الأقساط</Label>
          <Input id="installmentCount" type="number" inputMode="numeric" dir="ltr" disabled={isPending}
            aria-invalid={!!errors.installmentCount} aria-describedby="installmentCount-error"
            {...form.register("installmentCount", { valueAsNumber: true })} />
          {errors.installmentCount?.message && <p id="installmentCount-error" className="text-sm text-destructive">{errors.installmentCount.message}</p>}
        </div>
      </div>
      {lines && <ScheduleTable lines={lines} estimatedLabel={ESTIMATED_DATES_LABEL} />}
      <Button type="submit" disabled={isPending}>
        {isPending ? "جارٍ الحفظ…" : props.mode === "edit" ? "حفظ التعديلات" : "إنشاء العقد"}
      </Button>
    </form>
  );
}

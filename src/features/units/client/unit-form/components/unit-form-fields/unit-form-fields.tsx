"use client";

import { Controller } from "react-hook-form";

import { MoneyInput } from "@/shared/components/money-input";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/shared/components/ui/native-select";
import { UNIT_TYPE_LABELS } from "../../../unit-labels";
import type { UnitFormFieldsProps } from "./types";
import { useUnitFormFields } from "./use-unit-form-fields";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  );
}

export function UnitFormFields(props: UnitFormFieldsProps) {
  const { form, errors, isPending, priceLocked, onSubmit } = useUnitFormFields(props);
  const { register } = form;

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
      {errors.root?.message && (
        <Alert variant="destructive" className="sm:col-span-2">
          <AlertDescription>{errors.root.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="projectName">اسم المشروع</Label>
        <Input
          id="projectName"
          aria-invalid={!!errors.projectName}
          aria-describedby="projectName-error"
          {...register("projectName")}
        />
        <FieldError id="projectName-error" message={errors.projectName?.message} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="number">رقم الوحدة</Label>
        <Input
          id="number"
          dir="ltr"
          aria-invalid={!!errors.number}
          aria-describedby="number-error"
          {...register("number")}
        />
        <FieldError id="number-error" message={errors.number?.message} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="type">النوع</Label>
        <NativeSelect id="type" aria-invalid={!!errors.type} {...register("type")}>
          {Object.entries(UNIT_TYPE_LABELS).map(([value, label]) => (
            <NativeSelectOption key={value} value={value}>
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <FieldError id="type-error" message={errors.type?.message} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="area">المساحة (م²)</Label>
        <Input
          id="area"
          type="number"
          inputMode="numeric"
          dir="ltr"
          aria-invalid={!!errors.area}
          aria-describedby="area-error"
          {...register("area", { valueAsNumber: true })}
        />
        <FieldError id="area-error" message={errors.area?.message} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="rooms">عدد الغرف</Label>
        <Input
          id="rooms"
          type="number"
          inputMode="numeric"
          dir="ltr"
          aria-invalid={!!errors.rooms}
          aria-describedby="rooms-error"
          {...register("rooms", { valueAsNumber: true })}
        />
        <FieldError id="rooms-error" message={errors.rooms?.message} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="price">السعر (ريال)</Label>
        <Controller
          control={form.control}
          name="price"
          render={({ field }) => (
            <MoneyInput
              id="price"
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              disabled={priceLocked}
              aria-invalid={!!errors.price}
              aria-describedby={priceLocked ? "price-hint" : "price-error"}
            />
          )}
        />
        {priceLocked && (
          <p id="price-hint" className="text-sm text-muted-foreground">
            لا يمكن تغيير السعر لأن الوحدة محجوزة أو مباعة
          </p>
        )}
        <FieldError id="price-error" message={errors.price?.message} />
      </div>

      <div className="sm:col-span-2">
        <Button type="submit" disabled={isPending}>
          {props.mode === "edit" ? "حفظ التعديلات" : "إضافة الوحدة"}
        </Button>
      </div>
    </form>
  );
}

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MANAGER', 'SALES', 'ACCOUNTANT');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('APARTMENT', 'VILLA', 'TOWNHOUSE', 'DUPLEX');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN_FAILED', 'PRICE_CHANGED', 'CONTRACT_APPROVED', 'PAYMENT_RECORDED');

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "project_name" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "UnitType" NOT NULL,
    "area" INTEGER NOT NULL,
    "rooms" INTEGER NOT NULL,
    "price" BIGINT NOT NULL,
    "status" "UnitStatus" NOT NULL DEFAULT 'AVAILABLE',

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "sales_rep_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "sales_rep_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "final_price" BIGINT NOT NULL,
    "down_payment" BIGINT NOT NULL,
    "installment_count" INTEGER NOT NULL,
    "approved_at" TIMESTAMPTZ(3),

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contract_id" UUID NOT NULL,
    "seq" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "amount" BIGINT NOT NULL,
    "paid_amount" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contract_id" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID,
    "user_id" UUID,
    "action" "AuditAction" NOT NULL,
    "entity_id" UUID,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_company_id_id_key" ON "users"("company_id", "id");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "units_company_id_status_idx" ON "units"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "units_company_id_id_key" ON "units"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "units_company_id_project_name_number_key" ON "units"("company_id", "project_name", "number");

-- CreateIndex
CREATE INDEX "clients_company_id_sales_rep_id_idx" ON "clients"("company_id", "sales_rep_id");

-- CreateIndex
CREATE UNIQUE INDEX "clients_company_id_id_key" ON "clients"("company_id", "id");

-- CreateIndex
CREATE INDEX "reservations_unit_id_expires_at_idx" ON "reservations"("unit_id", "expires_at");

-- CreateIndex
CREATE INDEX "reservations_company_id_sales_rep_id_idx" ON "reservations"("company_id", "sales_rep_id");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_company_id_id_key" ON "reservations"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_reservation_id_key" ON "contracts"("reservation_id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_company_id_reservation_id_key" ON "contracts"("company_id", "reservation_id");

-- CreateIndex
CREATE UNIQUE INDEX "installments_contract_id_seq_key" ON "installments"("contract_id", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "payments_contract_id_idempotency_key_key" ON "payments"("contract_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_created_at_idx" ON "audit_logs"("company_id", "created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_company_id_sales_rep_id_fkey" FOREIGN KEY ("company_id", "sales_rep_id") REFERENCES "users"("company_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_company_id_unit_id_fkey" FOREIGN KEY ("company_id", "unit_id") REFERENCES "units"("company_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_company_id_client_id_fkey" FOREIGN KEY ("company_id", "client_id") REFERENCES "clients"("company_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_company_id_sales_rep_id_fkey" FOREIGN KEY ("company_id", "sales_rep_id") REFERENCES "users"("company_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_company_id_reservation_id_fkey" FOREIGN KEY ("company_id", "reservation_id") REFERENCES "reservations"("company_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Integrity checks (raw SQL: Prisma cannot express CHECK constraints)
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_id_hash_check" CHECK ("id" ~ '^[0-9a-f]{64}$');
ALTER TABLE "users" ADD CONSTRAINT "users_email_normalized_check" CHECK ("email" = lower(btrim("email")) AND "email" <> '');
ALTER TABLE "units" ADD CONSTRAINT "units_price_check" CHECK ("price" > 0);
ALTER TABLE "units" ADD CONSTRAINT "units_area_check" CHECK ("area" > 0);
ALTER TABLE "units" ADD CONSTRAINT "units_rooms_check" CHECK ("rooms" >= 0);
ALTER TABLE "units" ADD CONSTRAINT "units_project_name_check" CHECK ("project_name" = btrim("project_name") AND "project_name" <> '');
ALTER TABLE "units" ADD CONSTRAINT "units_number_check" CHECK ("number" = btrim("number") AND "number" <> '');
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_final_price_check" CHECK ("final_price" > 0);
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_down_payment_check" CHECK ("down_payment" >= 0 AND "down_payment" < "final_price");
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_installment_count_check" CHECK ("installment_count" >= 1);
ALTER TABLE "installments" ADD CONSTRAINT "installments_seq_check" CHECK ("seq" >= 0);
ALTER TABLE "installments" ADD CONSTRAINT "installments_amount_check" CHECK ("amount" > 0);
ALTER TABLE "installments" ADD CONSTRAINT "installments_paid_amount_check" CHECK ("paid_amount" >= 0 AND "paid_amount" <= "amount");
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_check" CHECK ("amount" > 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_idempotency_key_check" CHECK ("idempotency_key" <> '');
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_login_failed_email_check" CHECK ("action" <> 'LOGIN_FAILED' OR (coalesce("meta" ->> 'email', '') <> '' AND "meta" ->> 'email' = lower(btrim("meta" ->> 'email'))));

CREATE INDEX "audit_logs_login_failed_email_idx" ON "audit_logs" (("meta" ->> 'email'), "created_at") WHERE "action" = 'LOGIN_FAILED';

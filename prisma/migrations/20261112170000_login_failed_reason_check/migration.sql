-- Raw SQL: Prisma cannot express CHECK constraints
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_login_failed_reason_check"
  CHECK ("action" <> 'LOGIN_FAILED' OR coalesce("meta" ->> 'reason', '') IN ('invalid_credentials', 'locked'));

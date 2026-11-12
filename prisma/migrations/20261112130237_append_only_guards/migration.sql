CREATE FUNCTION reject_append_only_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'append-only table %: % is not allowed', TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'AQ001';
END;
$$;

CREATE TRIGGER payments_no_update_delete
BEFORE UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();

CREATE TRIGGER payments_no_truncate
BEFORE TRUNCATE ON payments
FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_change();

CREATE TRIGGER audit_logs_no_update_delete
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();

CREATE TRIGGER audit_logs_no_truncate
BEFORE TRUNCATE ON audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_change();

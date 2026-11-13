ALTER TABLE contracts ADD CONSTRAINT contracts_final_price_max_check
  CHECK (final_price <= 100000000000);

CREATE FUNCTION contracts_approved_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.approved_at IS NOT NULL THEN
    RAISE EXCEPTION 'Approved contracts are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER contracts_approved_immutable
BEFORE UPDATE OR DELETE ON contracts
FOR EACH ROW EXECUTE FUNCTION contracts_approved_immutable();

CREATE FUNCTION installments_terms_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Installments cannot be deleted';
  END IF;
  IF NEW.contract_id IS DISTINCT FROM OLD.contract_id
    OR NEW.seq IS DISTINCT FROM OLD.seq
    OR NEW.due_date IS DISTINCT FROM OLD.due_date
    OR NEW.amount IS DISTINCT FROM OLD.amount THEN
    RAISE EXCEPTION 'Installment terms are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER installments_terms_immutable
BEFORE UPDATE OR DELETE ON installments
FOR EACH ROW EXECUTE FUNCTION installments_terms_immutable();

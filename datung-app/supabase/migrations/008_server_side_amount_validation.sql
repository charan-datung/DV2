-- ============================================================
-- Migration 008: Server-side transaction amount validation
--
-- Adds a BEFORE INSERT trigger on the transactions table that
-- rejects any transaction whose amount_centavos exceeds the
-- customer's level limit or whose due_date is in the past.
--
-- This closes the gap where a modified client app could submit
-- an amount that bypasses the client-side level-limit check.
-- ============================================================

CREATE OR REPLACE FUNCTION trg_validate_transaction_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_level      customer_level;
  v_max        integer;
BEGIN
  -- Look up the customer's current level
  SELECT level INTO v_level
    FROM customers
   WHERE id = NEW.customer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer % not found', NEW.customer_id;
  END IF;

  v_max := get_customer_max_transaction(v_level);

  -- Reject if amount exceeds the level cap
  IF NEW.amount_centavos > v_max THEN
    RAISE EXCEPTION
      'Transaction amount (%) exceeds Level % limit (%) for customer %',
      NEW.amount_centavos, v_level, v_max, NEW.customer_id;
  END IF;

  -- Reject if amount is zero or negative (belt-and-suspenders alongside CHECK)
  IF NEW.amount_centavos <= 0 THEN
    RAISE EXCEPTION 'Transaction amount must be positive';
  END IF;

  -- Reject if due_date is in the past
  IF NEW.due_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'due_date (%) cannot be in the past', NEW.due_date;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_transactions_validate_insert
  BEFORE INSERT
  ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION trg_validate_transaction_insert();

COMMENT ON FUNCTION trg_validate_transaction_insert() IS
  'Rejects transactions that exceed the customer''s level cap or have a past due_date.
   Enforces server-side what the client scan screen checks client-side.';

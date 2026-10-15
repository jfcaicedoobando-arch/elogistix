-- LOCAL / UNAPPLIED. Additive protection applies only to server-proven simulated payments.
BEGIN;
-- Deferred barrier, NOT an unconditional commit hook. SET CONSTRAINTS IMMEDIATE can drain it early.
-- Supported controller holds an exclusive connection, leaves defaults deferred and commits immediately.
CREATE FUNCTION demo_flow_writer.authorize_deferred() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog AS $$ BEGIN
 PERFORM demo_flow_writer.authorize(NEW.execution_run_id); RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER demo_authorize_deferred AFTER INSERT ON demo_flow_writer.receipts
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION demo_flow_writer.authorize_deferred();
CREATE CONSTRAINT TRIGGER demo_checkpoint_authorize_deferred AFTER INSERT ON demo_flow_writer.seed_checkpoints
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION demo_flow_writer.authorize_deferred();
CREATE TRIGGER immutable_simulated_payments BEFORE UPDATE OR DELETE ON demo_flow_writer.simulated_payments
 FOR EACH ROW EXECUTE FUNCTION demo_flow_writer.immutable();
CREATE FUNCTION demo_flow_writer.protect_simulated_payment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM demo_flow_writer.simulated_payments WHERE payment_id=OLD.id) THEN
  RAISE EXCEPTION 'DEMO_SIMULATED_PAYMENT_IMMUTABLE' USING ERRCODE='42501';
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE FUNCTION demo_flow_writer.prevent_simulated_bank_link() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM demo_flow_writer.simulated_payments WHERE payment_id=NEW.pago_proveedor_id) THEN
  RAISE EXCEPTION 'DEMO_SIMULATED_PAYMENT_NO_BANK_LINK' USING ERRCODE='42501';
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER demo_guard_simulated_payment BEFORE UPDATE OR DELETE ON public.pagos_proveedor
 FOR EACH ROW EXECUTE FUNCTION demo_flow_writer.protect_simulated_payment();
CREATE TRIGGER demo_guard_simulated_bank_link BEFORE INSERT OR UPDATE ON public.bbva_movimientos
 FOR EACH ROW EXECUTE FUNCTION demo_flow_writer.prevent_simulated_bank_link();
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA demo_flow_writer FROM PUBLIC, anon, authenticated, service_role;
COMMIT;

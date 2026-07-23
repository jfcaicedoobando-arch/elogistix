-- FIX-R2-04 (v13.309.36): cumplir H6 audit para guard_pago_proveedor.
-- La función es SECURITY DEFINER y se invoca sólo vía trigger, pero el
-- guardrail `audit:migrations` exige GRANT EXECUTE explícito a
-- service_role/postgres además del REVOKE ya existente.
GRANT EXECUTE ON FUNCTION public.guard_pago_proveedor() TO service_role, postgres;
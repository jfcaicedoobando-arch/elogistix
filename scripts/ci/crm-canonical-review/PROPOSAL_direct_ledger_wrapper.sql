-- DESIGN FENCE ONLY. Not a runnable migration and not a ledger entry.
-- See docs/audits/crm-canonical-owner-only.md for the required transaction protocol.
-- This file deliberately contains no private identities, histories or target metadata.
-- A separate fully rendered/reviewed wrapper must implement every listed gate.
DO $crm_direct_wrapper_proposal$
BEGIN
  RAISE EXCEPTION 'CRM_DIRECT_WRAPPER_NOT_ADMITTED: fresh private envelope, transport, ledger sequence convention and integration review required';
END
$crm_direct_wrapper_proposal$;

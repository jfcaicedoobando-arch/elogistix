# Withdrawn, unapplied migration candidates

This directory is provenance, not an executable migration queue. Never pass it to db push, replay it recursively, or use it to invent an applied ledger row.

The exact release35 source 20261006230000_proforma_operativa_consistencia.sql was committed but its only coordinated application on the inspected backend failed with42501. Transaction rollback was independently verified for all nine definitions, privileges, table/trigger changes and both target ledger rows. Release35 had not been published. Its historical manifest and original SQL bytes remain unchanged.

The source uses custom function SET attributes requiring administrative parameter permission that the managed owner does not hold. The replacement20261006233000_proforma_operativa_compatibilidad.sql reissues all nine definitions, changes only two runtime scope implementations and preserves owners, ACL and domain conditions. It grants no parameter privilege. It is a new executable migration, not a rewritten record of2300.

supabase/releases/withdrawn-unapplied.json and focused integrity tests pin exact old/replacement hashes and the historical35 list. This is a closed, explicit retirement, not a generic skip rule. Only SQL actually executed belongs in an applied ledger. The unchanged2250 table-contract migration still applies before the full replacement.

Before rollout, enumerate persistent targets and confirm actual state. Absence evidence covers only the project/backend recorded in the registry, not unidentified installations. If another real target applied2300, automated deployment must stop for a target-specific plan preserving its real ledger. A local fixture verifies that a forward from the old applied schema can reach the same final state, but does not authorize that deployment. No history deletion, include-all replay or automatic repair is permitted.

## Validation boundary

The replacement installed locally as postgres NOSUPERUSER without ACL_SET. The exact old source failed under that role. Ordinary proforma/no_objeto suites and ten concurrent scenarios passed. Thirty-six comparisons with the original cover unset/off/on/empty, NULL/missing references, no-op, nested triggers, update failure, lock/statement timeouts, live-concept soft-delete and invoice propagation.

The original function SET creates an empty custom placeholder after an unset entry. The replacement preserves this observable result, including early returns and lock errors, by reasserting the previous value at entry; it enables technical scope only around the intended update. This does not claim NULL and empty are universally equivalent or change unrelated consumers. Post-commit rollback requires a separately reviewed forward; valid new no_objeto NULL rates must never be forcibly rewritten.

## Durable provenance and enforcement boundary

Original source: [PR173](https://github.com/jfcaicedoobando-arch/elogistix/pull/173), merge0b0f5603b31f0de6cdc925e2a307babacc28fb9a, blobaf09fd76e75f9c51af85cff9c6355dd414bee096. The full historical manifest is preserved byte for byte at supabase/releases/history/13.824.35-migration-manifest.json, including its33/34/35 entries, independently of the current rolling window.

The registry pins a minimal catalog-only incident record at evidence/proforma2300-rollback-20261007.json and the failed envelope hash. It contains no business records or credentials. Its exact target/time bounds the absence claim.

The JSON record and integrity tests establish provenance; they do not implement a deployment executor or automatically skip a source. A reviewed application envelope must explicitly reject any target where2300 is already registered before executing DDL. Ordinary db push must not be forced with repair/include-all to overcome a historical mismatch. The successful local forward fixture proves schema convergence and preserved old ledger, not permission for an automatic deployment to an old-applied real target.

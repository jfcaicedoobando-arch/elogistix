# Exact integrated-main revalidation

Parent requested integration of reviewed main
`326d981b9d98cae405c42158b66a3960cfe75bd3` (PR355 + PR358), after acceptance of
PR354 head `3d912148da1fd9b04dceb46b2eb948d99475ebe6` against main
`b66d2c2caa00d7a8d522ed7140b6a15877a0b2aa`. Local merge commit
`55e926484e3ba431ed207530c658d866494e032d` preserves that history without rebase.
Prior artifacts and failures remain evidence for their original exact bases.

This separate adapter has a new explicit gate: owned draft PR354 branch, exact
main326 base and exact checked-out head. It checks main326, merge55 and prior3d
are ancestors, all92 historical inputs, all12 main changes and the two reviewed
scanner files. It never changes historical source/pins, module globals or gates,
and never fabricates an old-base event. The historical entry points correctly
retain their original b66 gate. After its own gate, this adapter directly reuses
their low-level run_case functions and existing cleanup/acceptance oracles.

All three lanes must produce new native evidence for the integrated head:

| Lane | New synthetic PostgreSQL17.6 probes |
| --- | --- |
| author | Seven original materialization/retry, rollback fault and authority suites |
| review-v2 | All nine version2 independent negatives, preserving original seven renders and both corrected probes |
| supplement | Three independent concept/payment/tenant-authority denials and separate TEMP sequence calibration |

Each case owns a fresh disposable network-none cluster with unchanged golden
infrastructure, pinned image, no ports/mounts/DSN, candidate NOSUPERUSER and
verified shutdown/client closure/container removal. The same exact catalog,
canonical function revalidation, explicit laboratory manifest variant and proposed
same-context retry correction are verified before fixture execution.

The12 reviewed main changes add a pure authority-bridge review contract/tests/CI,
test-catalog entries and unavailable-video copy/regression. They do not change
financial SQL, the canonical baseline, golden infrastructure, issuer sources or
activation. General CI and Gitleaks must pass for the integrated head as separate
checks. No prior PASS automatically accepts main326.

Results cover synthetic row rollback and separate sequence observations only.
Business COMMIT, sequence rollback, real identity/issuer/ACL, physical HTTP driver
continuity and crash/WAL durability remain NOT_RUN or NOT_ESTABLISHED. Wire
UNBOUND, configuration EMPTY, demo DISABLED; no merge/deploy/real privileges.
PR359 stays separate: its accepted head99/base616 evidence is preserved and its
future integrated-main revalidation is not asserted here.

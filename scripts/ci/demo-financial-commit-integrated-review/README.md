# Exact integrated-main COMMIT revalidation

Parent merged PR354 and requested PR359 retarget to main
`ecc53750c5d920d898ca2b00a2f717371dc19cf5`, preserving prior acceptance at
head `99cd0f6ee9db3a83fa1eb90e2828db4eb4713021` / event base
`616bff8d454f9de35b6590913d08b7ad0d69b049` as historical evidence only.
Merge `1c8e5437ede1279b490318fac9814fde65cfd504` integrates mainECC without
rewriting those commits. Its sole add/add conflict in the author behavior workflow
was resolved using the exact mainECC blob; this front does not replace that lane.

This separate adapter requires an owned draft PR359 branch, exact mainECC base,
exact checkout and ECC/merge1c8/prior99 ancestry. It pins all73 historical files:
15 COMMIT package, 30 author, 26 compiler, golden Runner and baseline. Six main
CI/scanner surfaces and the new COMMIT workflow are pinned separately. The entire
Git diff against mainECC must contain only21 exact owned additions; modifying,
deleting, renaming or adding any inherited main file rejects the run.

The historical head99 package, SQL, tests, source pins and base616 gate remain
byte-identical. The adapter never mutates historical globals/gates or fabricates
an old-base event. After its new gate and inventories pass, it calls the exact
head99 low-level run_case API for three fresh disposable PostgreSQL17.6 clusters:

| Case | Required native evidence |
| --- | --- |
| original_invoker | Real COMMIT fails42501 calling closed assert_issued; fresh observer sees exact controlled rollback and canonical unresolved classification |
| proposed_definer | Only authorize_issuance_deferred.prosecdef changes false to true; real business COMMIT, independent observer, fresh retry COMMIT and second independent observer all pass with five different PIDs and equal full/foreign/global hashes |
| proposed_revoked | Bound run legally revoked in disposable owner fixture, service_role restored, real COMMIT rejects42501 DEMO_RUN_UNAUTHORIZED; fresh observer proves controlled rollback |

The inherited runner checks complete function metadata/body hash/owner/ACL/config,
three enabled deferred trigger bindings and final guard invariance. Its genuine
COMMIT order, no early constraint drain, exact source probes, stage matrices
28/32/30 and owned cleanup oracles are unchanged. This wrapper additionally exports
the native shutdown/no-PID/client-closure flags from each owned private result.

The same golden digest, image, socket-only network-none cluster, no ports/mounts/
DSN and NOSUPERUSER fixture candidate are retained. Every role and privilege is
ephemeral laboratory setup. Current acceptance requires fresh artifacts plus
current CI/Gitleaks; it is never inferred from head99/base616 or PR354's rollback.

Wire UNBOUND, config EMPTY, demo DISABLED. Synthetic committed-row visibility with
the descriptor proposal does not establish real identity, issuer, runtime ACL/RLS,
HTTP socket continuity or crash/WAL durability (tmpfs/fsync-off). No production
privileges, merge, deployment or demo activation are performed.

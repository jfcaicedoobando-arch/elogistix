# KAM company conversion concurrency

This harness runs only in the verified PostgreSQL 17.9 GitHub Actions service,
after migrations and before `_ci_post_migrate.sql` broad grants or FK relaxation.
It accepts no connection URL, arbitrary database, SQL input or production secret.
The ambient host must be loopback; actual `psql` transport uses the private Unix
socket inside the exact inspected service container, with an empty environment.

Run the offline checks and the adapter in one workflow step:

```yaml
env:
  ISOLATED_QA_DB: '1'
  CRM_PROSPECTO_KAM_DISPOSABLE: '1'
  CRM_PROSPECTO_KAM_POSTGRES_SERVICE_ID: ${{ job.services.postgres.id }}
run: |
  python3 scripts/ci/crm-prospecto-kam/test_static.py -v
  python3 scripts/ci/crm-prospecto-kam/run-actions.py
```

The workflow's existing `POSTGRES_IMAGE` must equal the digest pinned in the
adapter. Upload `reports/crm-prospecto-kam-concurrency/` with `if: always()`.

The adapter creates two independent random `crm_prospecto_kam_<uuid>` clones
from idle source `postgres`, through a control connection to `template1`.
In each clone it replays the entire forward migration, checks unchanged function
metadata/data/security, and commits a synthetic company-only KAM fixture with
all real triggers and RLS active. Session A authenticates as that KAM, converts
the company and retains its transaction. Session B authenticates as the same KAM
and invokes the same RPC. The monitor must observe B waiting on A's actual lock
using `pg_blocking_pids`, the database and application name before committing A.
B must return the same opportunity with `sin_cambios=true`; B then commits.

Required results are exactly one lead, one opportunity and one company link,
unchanged ownership and tenant, and no changes from the idempotent waiter.
Snapshots include complete business rows plus `ctid` and `xmin`, detecting
unnecessary identical updates. Another tenant, memberships, global roles and
auth identities remain unchanged. Application tables/sequences and security
catalogs of source `postgres` are fingerprinted before/after as read-only hashes.

Cleanup validates the generated name's prior absence, exact numeric OID and
owner before `DROP DATABASE`. It never uses `FORCE`, container discovery, remote
Docker, image pulls, source DML, or database-wide session termination. Only the
harness's exact backend PID/database/application identity can be cancelled on
failure; remaining processes are closed before clone removal. An ambiguous
CREATE is reconciled by its prechecked generated name, never blindly retried.

`test_static.py` simulates transport, input rejection, ownership-sensitive cleanup
and assertion sensitivity without Docker or database execution. It is not
runtime concurrency evidence; that evidence is the Actions adapter result.

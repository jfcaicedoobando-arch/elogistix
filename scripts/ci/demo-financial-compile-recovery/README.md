# Canonical financial installation recovery — compile only

This lane obtains the first real PostgreSQL 17.6 installation/compilation result.
It is separate from PR348's complete financial-behavior gate. It never marks that
catalog complete, runs a financial fixture, issues a context, enables control or
calls the business engine. A green job means **PASS_COMPILE_ONLY** after mandatory
verification and owned cleanup. Finance, real identity/authentication, deployed
ACL/RLS, transport and durability remain **NOT_RUN**; demo **DISABLED**.

Source base and branch start are main
`025270cadcee0cedef64aab31be93eb0ff3f0288`. The explicitly reviewed event base is
`d778b7f5a19ec61e6dccaeab32f06d990e880ef8`, the parent's merge of PR352. Its diff
contains only authority tests/design, their catalog and CI; baseline and golden
infrastructure are unchanged. These are distinct pins, not an automatic refresh.
Any later event-base change stops the lane for review.

`upstream-sources.json` records sixteen immutable public Git inputs from PR348
HEAD `e8d45165216403478f144f75437fa8c4c6116b5b`: its unchanged extractor and fifteen
SQL sources. Neither the original worker's workspace, processes nor branch is
used or modified. This is not a Library ZIP transfer or equivalence claim.
`inputs.json` freezes the entire new package; raw canonical baseline bytes are
read from the checked-out HEAD's Git object, then exact length, SHA256 and blob
SHA1 must match the original baseline pin. No SQL source is rewritten to fit.

## Catalog and validation

The recovery adds explicit fixture write roots `organizations`,
`organization_members` and `user_roles` to PR348's existing roots. Their canonical
triggers pull provisioning/role dependencies into the source closure. The finite
`_assert_padre_misma_org` argument map is reviewed conservatively; original dynamic
and external-dependency gates remain visible. Source discovery is not a general
semantic or behavioral closure proof.

Every selected original statement retains its bytes, source ordinal and digest.
The installation plan preserves interleaved table/function prerequisites for
return types and table defaults. It defers function-body checking during initial
DDL only. A mandatory second pass restores `check_function_bodies=on` and derives
`CREATE OR REPLACE` statements with exactly the same canonical bodies after the
objects exist. Failure in either pass fails the experiment. SQL function body
validation and PL/pgSQL definition validation do not prove every runtime branch.

After those passes, the fifteen fixed proposed installers compile in their
reviewed order. The public core helper is an explicit **fail-closed ownership
metadata fixture** that always raises if called. It supplies no successful core,
engine, approval or trigger replacement. Public business functions and triggers
come from the pinned canonical baseline; private engine/issuer/producer sources
come from the recorded public input. The verifier compares actual function bodies
and objects against the source manifest and requires empty business, identity,
registry and control tables. No organization, membership or financial row is seeded.

## Explicit synthetic bootstrap

The owned disposable cluster's administrator creates its compatibility roles and
one database only. Candidate installation runs as `postgres` **NOSUPERUSER
BYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION**, with no administrator
membership. BYPASSRLS is explicitly synthetic owner authority required by the
unchanged private installer; it does not certify application RLS.

`auth.users` and the auth-context table are empty synthetic compile fixtures.
`auth.uid`, `auth.role` and `auth.jwt` read that empty context; they do not fabricate
successful external authentication. The candidate installs trusted `pg_trgm` in
the `extensions` schema for the canonical `gin_trgm_ops` indexes. Bootstrap is
identified separately from real identity, runtime permissions and issuer approval.

The runner imports unchanged `scripts/ci/crm-acl-review/run_ci.py` only after its
SHA256 `a364f833851080d9b290fca35fa7925514dc898979359e55c411f0eef57e7816`
matches. It reuses that implementation's pinned image
`postgres@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3`,
network none, socket-only PostgreSQL, no ports/host mounts/DSN, read-only root,
bounded tmpfs, capability drop and ownership-verified cleanup. No infrastructure
source or original CRM branch changes. fsync-off/tmpfs is not WAL/crash/failover
or restore acceptance.

## Reproduction and evidence

Offline tests use Python built-ins, without SQL, Docker, network or dependencies:

```text
python3 -B -I -m unittest discover -s scripts/ci/demo-financial-compile-recovery -p 'test_*.py' -v
```

The dedicated same-repository draft-PR Actions gate checks exact branch, event
base and checkout HEAD before opening its owned container. Local SQL/Docker mode
is rejected. The artifact contains only public result/diagnostic and canonical
source manifests; ownership tokens, raw Docker logs and host paths are excluded.
The private stage logs retain exact stdin bytes. A failed stage reports its name,
SQLSTATE and bounded PostgreSQL diagnostic; successful source extraction alone
cannot become installation PASS.

`complete`, `canonical_closure_complete` and `fixtures_complete` remain false even
after compile PASS. Full fixture paths, happy behavior, rollback/fault suites,
real identity, no-bypass authority and operational binding require separate work.
At-most-once with quarantine remains the intended semantics; no exactly-once or
availability guarantee is added here.

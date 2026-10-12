# Acceptance candidate real-schema semantic regression

Status: generated and statically reviewed; not executed by this worker. The isolated Actions runner must execute on PostgreSQL 17.6 and 17.9. A complete pass is exactly the semantic marker inventory in `review-contract.json`, with successful final ROLLBACK and parent pre/post catalog and baseline-row comparison. A missing marker, unexpected error, nonzero psql exit or an incomplete run is not a pass.

## Inputs and scope

- Candidate binding is owned by the parent harness. This matrix requires the corrected acceptance migration that permits a live same-tenant accessory M:N company with an existing client. The prior proposed migration SHA256 `095aaade8d000fd9ae6f37278c2a04f6b6dead6186191fa01da59b76105913ef` is expected to fail that regression and is not the target for a green run.
- Real full baseline catalog supplied in `pr264-baseline-review/artifact/004-catalog-before.stdout.log`; exact table definitions supplied in `input/baseline-table-extracts.sql`.
- Original converter and CRM triggers are not edited. Seven production function source hashes are asserted at runtime and listed in `source-function-fingerprints.json`.
- Only temporary helpers, fixtures and transactional rows are created by this file. No ACL changes, constraint removals, trigger disabling, service-role masquerading, public replacement functions, direct accepted-state success seeds, remote DB use, migration execution or PAC calls.
- Invocations use real SQL `authenticated` plus matching JWT subject and role. Fixture creation and unfiltered snapshots use postgres with no JWT. Modern organization membership supplies user-role mirrors.
- Every negative checks exact SQLSTATE plus stable domain error, and per-field fiscal failures check the complete missing-field message. NULL assertions fail closed. Every negative compares pre/post whole rows across all public UUID organization_id base tables for both fixture tenants, including soft-deleted rows, plus organization rows. Global tables, sequences and external effects are not included in those per-negative snapshots.

## Semantics explicitly characterized

1. First prospect acceptance is Enviada -> Aceptada. A Prospecto source becomes Pendiente de alta, its opportunity wins and it remains without a client. The original converter then reaches Convertido. Source-company state follows the original `lead_origen_id` trigger.
2. A company linked only through M:N remains Prospecto after original conversion; no company cliente_id is assigned by that converter. This is a characterization of the original contract, not a demand to broaden the converter.
3. A Calificado source remains Calificado after acceptance because the original advancement trigger does not promote it, while the original converter can subsequently reach Convertido. This behavior is asserted without changing the business contract.
4. After conversion, acceptance retry returns `autorizacion_cliente` for the default-created client or `interna_cliente_de_casa` when the original converter reuses a real-RFC house client whose authorization policy is false. Before conversion it returns `aceptacion_prospecto_crm`. In both post-conversion branches, the original acceptance audit still records `aceptacion_prospecto_crm` and the seal is identical.
5. An additional same-tenant live M:N accessory company with an existing client and different lead origin is accepted by the corrected candidate. Its complete company row remains unchanged through acceptance and original conversion. A converted actual source company linked through lead_origen_id still blocks acceptance, even if the same company is also linked through M:N.
6. Real manual-invoice RPC tests cover only wrong-tenant and no-concepts guards. The real shipment wrapper tests rejection before client conversion. Nothing here establishes invoice issuance, CFDI/PAC, payment, REP, production fiscal activity, or a complete downstream shipment success path.

## Uncovered or blocked fixtures

- Ordinary two-tenant membership cannot be seeded because the real baseline has UNIQUE(user_id). No constraint is weakened. A genuine global super_admin whose active org is B exercises active-tenant rejection for prospect A instead.
- A dangling M:N company FK cannot be manufactured with the FK enabled; deleting its target may remove the link, which is not that corruption. The valid no-company-link case is covered. Likewise, physical dangling stage/lead targets are not forged. Soft deletion and moved-tenant identities are covered where guarded table writes allow it.
- Multi-session serialization, NOWAIT contention, deadlocks and concurrent RFC insertion require the parent's separate concurrency harness. This file contains only single-session semantic cases.
- The unchanged baseline author's separate service and UI suites, actual RLS policy variants beyond these actors, production DB migration application and deployments are not covered.

`semantic-coverage.json` provides every expected case and its intended assertion. The committed SQL is the complete executable suite; no generator or external fixture is required.

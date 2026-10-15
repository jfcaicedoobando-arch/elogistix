# CRM operational event-trigger review design

Status: **NOT_ADMITTED**. This document defines review and isolated evidence requirements. It contains no target results, event-trigger names, instance identities, private definitions or operational authorization. Every new test for an operational role/event profile below is **NOT_RUN** until the complete definitions and their dependencies have been independently reviewed.

The existing lab renderer remains unchanged: `scripts/ci/crm-canonical-review/direct_wrapper.py` rejects event triggers with `EVENT_TRIGGERS_UNSUPPORTED_IN_LAB`. Its disposable scope, role, database and version gates remain in force. `PROPOSAL_direct_ledger_wrapper.sql` remains fenced. Supporting an operational event profile requires a separate contract and implementation; replacing these guards is not admission.

The payload remains the exact bytes of `drizzle/migrations/0021_crm_helpers_owner_only.sql`, SHA256 `32173fdde2d456d6d9da8f46b54e38f4535b699b3ca36d921f93f444105fecc6`. Neither event review nor fixture setup may rewrite its DO or REVOKE commands.

## Private review before implementation

Keep all actual inventories, source, identities, hashes of private definitions, destinations and observations outside Git, PRs, workflow inputs and public artifacts. The operational-capture package supplies projections and commitments, not an executable contract. In particular, `02_scoped_catalog.sql` captures event rows and directly associated functions; its dependency rows do not establish a complete call graph for procedural or dynamically constructed SQL.

For every event that might run, the private reviewer must establish:

- Its identity, owner, event, tag filter, enabled mode and associated function identity. Interpret enabled modes together with the actual execution session's replication mode. Include events invoked by recursively issued commands. Determine firing for the exact engine and commands experimentally; do not infer that an outer or nested DO hides its contained REVOKE commands.
- The exact current definition and hash of the handler, language, ownership, SECURITY INVOKER/DEFINER mode, execution ACL, argument/return contract, support routines, configuration and effective search path. Resolve unqualified names, temporary-schema resolution, overloads and any implicit privilege changes through membership or SECURITY DEFINER calls.
- Every reachable routine, dynamic command, extension and configuration dependency that can affect execution. Catalog dependency links alone are insufficient for text-built SQL or late binding. Unknown or data-dependent dispatch must be bounded and reviewed; a source hash proves equality, not safe behavior.
- An explicit effect inventory: reads; relation or catalog DML; nested DDL; ACL/owner changes; sequence calls; settings; locks; exception handling; notices; notifications; audit or job queues; logical replication; filesystem, network or external calls. Include downstream consumers and indirect calls when they can create effects. Identify which effects occur before commit, at commit, after commit or outside transactional rollback.
- A finite read/write footprint and expected deltas for all admitted effects. Review permissions and object behavior in that footprint, including defaults, constraints, triggers, policies, types, operators and access methods. No customer rows are needed for this review package; isolated tests use synthetic data.

The execution profile must explicitly bind effective role capabilities and membership, SECURITY DEFINER transitions, BYPASSRLS, row-security and replication settings, encoding, engine version and required timeouts. Discovery can observe these facts; capturing them in JSON does not mean the lab has tested or admitted that mode. Missing visibility or an unreviewed capability is a blocker, not a reason to add privileges.

## Separate operational contract

Before any operational candidate is rendered, independently review a fresh private contract that combines the event inventory with complete ledger history, sequence state/default/ownership, catalog identities and semantic commitments. Define deterministic serialization, ordering, null handling, decimal-integer conversion and coverage for the operational-capture projections. Do not substitute commitments for the lab's raw arrays or reconstruct private stored SQL from hashes.

The single top-level wrapper must execute the canonical DO as unchanged decoded bytes, nested within the same transaction that inserts at most the one canonical Drizzle row through its verified existing default. Check the payload hash and UTF8 roundtrip before execution. The Supabase ledger and all prior ledger rows must remain unchanged. A registered identity requires full target, history, sequence and event-postcondition verification; it must not silently repair drift or fire the migration again.

Pin the event definitions, enabled modes, role/configuration profile, dependency closure and permitted effect footprint in preflight and terminal checks. Refresh the contract within a newly coordinated DDL/ACL window. Maintain that window through commit verification, independent postflight and any uncertain-response reconciliation. Locks and matching snapshots do not exclude a transient owner change or a noncooperating applier that already read history.

No handler may change the payload, target source/configuration/owner/trigger links, ledger metadata, historical rows, Supabase history, role access or ACLs outside the canonical removals. A narrowly reviewed transactional audit effect would need its own exact append/delta and preservation contract. Existing metadata equality checks cannot certify such a new effect by themselves.

Notifications require both a reviewed channel/payload policy and a reviewed consumer effect model. A synthetic listener can establish when a notification is observable; it cannot certify real consumers, delivery acknowledgement or downstream effects. Unknown consumers or external calls remain inadmissible. A network-disabled stub demonstrates only the stubbed behavior, not the original external operation. Nontransactional effects outside the already understood ledger-sequence behavior require a separate reviewed design and evidence; they cannot be hidden inside a rollback claim.

Verify the actual transport separately: session continuity, preexisting positive statement timeout, transaction boundaries, commit/error semantics, absence of automatic registration, result truncation, lost-response behavior and reconciliation. DO success is not proof of commit. The metadata SELECTs do not establish any of these properties.

## Isolated test plan

Use a disposable, pinned engine matching the proposed supported profile, synthetic histories and data, and no real connection or external consumer. Reproduce reviewed definitions faithfully. Private definitions and their results must remain private; public substitute fixtures demonstrate protocol properties only. If faithful isolated reproduction requires an unknown dependency or external service, the relevant operational test remains NOT_RUN and admission stays blocked.

Collect a synthetic trace of the actual event/tag order, command visibility at each supported callback phase, effective role/settings and bounded effect deltas. Instrumentation exists only in the disposable harness; it must not alter the canonical payload or the behavior being certified. Independently compare complete before/after witnesses, rather than trusting a handler's own success message.

| Case | Required evidence | New operational-profile status |
| --- | --- | --- |
| E01: firing and role profile | Exact canonical bytes, outer wrapper DO and nested canonical DO; observed firing/tag order for every relevant callback and recursive command; reviewed role/configuration transitions. | NOT_RUN |
| E02: successful commit | Canonical ACL result, exactly one default-generated Drizzle row, unchanged Supabase/history/catalog outside the explicit effect contract, bounded event effects and independent committed-state read. | NOT_RUN |
| E03: owner-only unregistered state | Canonical commands still execute unchanged; event behavior is measured for an already owner-only target; exactly one registration and no unrelated drift. | NOT_RUN |
| E04: registered verification | Independent reconciliation followed by verification produces no additional row, event effect, notification or sequence allocation; degraded target/event/history rejects without repair. | NOT_RUN |
| E05: handler failure and interruption | Inject failure at each relevant callback phase and cancel an owned test execution; target, ledgers and all transactional event effects roll back; classify the primary error and verify cleanup. | NOT_RUN |
| E06: failure after ledger insertion | A fault demonstrably reached after canonical execution and insertion rolls back target, ledgers and transactional effects. Record the ledger sequence gap separately; do not reset it. | NOT_RUN |
| E07: fresh retry after rollback | Fresh independent state admits a real sequence gap; one successful registration and only the reviewed successful event effects remain. No blind resend of the old envelope. | NOT_RUN |
| E08: notifications and commit boundary | A separate synthetic listener observes the exact admitted notification behavior for commit, rollback, registered verification and interrupted/lost-response scenarios. No real subscriber is contacted. | NOT_RUN |
| E09: uncertain response | Model both committed and rolled-back outcomes. Reconcile both ledgers, target, sequence and every admitted side effect independently before any next action; no duplicate delivery or registration assumption. | NOT_RUN |
| E10: identity, source and behavior drift | Changed event tags/enabled mode/owner/function/source/configuration/dependency, privilege profile, queue/default or unknown dispatch rejects before mutation or rolls the transaction back. | NOT_RUN |
| E11: preservation and hostile effects | Synthetic handlers attempting extra ACL/role/DDL/catalog/history/Supabase writes, extra registrations or effects outside the footprint fail admission or terminal checks, with full rollback evidence. | NOT_RUN |
| E12: contention and external effects | Observe actual competing locks/appliers in isolated sessions and strict errors. Unknown external/nontransactional behavior rejects; record the limits of synthetic substitutes and external-writer exclusion. | NOT_RUN |

For every case, evidence must identify the exact reviewed code/fixture/profile and payload, show assertions and full scoped witnesses, separate transactional and nontransactional state, and confirm owned-resource cleanup. A case is PASS only when its required evidence and independent review are complete. A violated condition is FAIL. Missing definitions, unavailable dependencies, incomplete visibility, unexercised behavior or unconfirmed cleanup remains NOT_RUN or a blocking failure; it is never promoted to PASS because another lab suite passed.

## Admission decision

Admission remains **NOT_ADMITTED** until the event effect is bounded, all relevant definitions and privileges are known, the separate contract and implementation pass the required isolated tests, independent reviewers approve the exact candidate, the transport is verified, and a new operational window is coordinated. Any unknown source, reachable behavior, privilege transition, external effect, consumer or preservation result blocks application. This design does not disable event triggers, grant roles, authorize SQL execution, deploy or merge a change.

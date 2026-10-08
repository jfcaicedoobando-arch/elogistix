# Short-lived private shipment cache

The 15-second module cache deduplicates concurrent reads of `embarques_interno_v`
from shipment details, tariff information and reconciliation. It is an optimization,
not authorization: database privileges and RLS remain authoritative.

## Isolation and invalidation

- Entries include user, effective organization, effective role and session generation.
  Missing scope and portal roles fail closed without a private-view request.
- The lib-owned session cache registry lets features register resetters without a
  reverse `lib → features` dependency. Auth changes, active tenant changes and
  `purgeSessionCache` invalidate the generation synchronously.
- Auth session events clear unresolved profile scope before React publishes the new
  identity. Late initial hydration cannot restore a session after a newer auth event,
  including StrictMode effect replay; callbacks from unsubscribed listeners are ignored.
  A changed `session_id` starts a new generation even for the same user. Repeated
  `SIGNED_IN` on tab focus and ordinary token refresh preserve the session. Only
  the session ID is compared in memory; no token is stored or logged. Legacy
  events without a session ID clear short-lived data without revoking confirmations.
- Pending completions and resolved cache hits are checked again before delivery.
  Replaced or forgotten entries cannot complete with old data; an old rejection
  only removes its own entry, never a newer `fresco` request.
- A successful mutation clears registered short-lived data **before** local
  `onSuccess` refetches. This is intentionally global: payment mutations can
  automatically close a shipment. Data invalidation does not change auth generation
  and therefore does not cancel a valid invoice-confirmation continuation.
- The three React Query consumers append scope to their existing key prefixes.
  Previously, same-user role/tenant changes could retain a resolved private result
  for their 15–30 second `staleTime`, independent of the module cache. Keeping the
  prefixes preserves existing mutation invalidation while preventing reuse by a
  different scope. The internal hook no longer forces a duplicate `fresco` request.

## Verification

Synthetic transport fixtures cover request deduplication, TTL, explicit forget,
user/organization/role transitions, unresolved scope, portal restriction, active
superadmin tenant, logout/re-login, A→B→A transitions, stale resolutions/rejections,
composite tariff reads, React Query consumers and mutation callback ordering.
Existing session/provider, reconciliation and invoice-confirmation tests remain
part of the focused regression run. No real private records, migrations, fiscal
operations or production deployment are required by this change.

As with any finite client cache, server-side permission changes become known when
the application receives refreshed identity/profile scope; this patch does not add
new background authorization polling or replace server-side checks.

## Consolidate user edge functions into `user-management`

### Scope
Merge these 4 edge functions into one `supabase/functions/user-management/index.ts`:
- `create-user`
- `delete-user`
- `invite-client-user`
- `list-users`

Note: `list-client-users` also exists and is parallel to `invite-client-user`. I will **include it as well** under the same router (action `list-clients`) so the portal-user surface lives together. If you'd rather leave it standalone, tell me and I'll drop it from the plan.

### Router design
Single entry file with:
1. Strict CORS preflight via `handlePreflightStrict(req)` (whitelist).
2. JWT validation (read `Authorization`, verify caller via service-role client) — shared once.
3. Dispatch by `action` in JSON body (POST) — uniform contract for all operations, including reads:
   - `action: "list"` → current `list-users` logic
   - `action: "create"` → current `create-user` logic
   - `action: "delete"` → current `delete-user` logic
   - `action: "invite-client"` → current `invite-client-user` logic
   - `action: "list-clients"` → current `list-client-users` logic (only if kept in scope)
4. Zod schema per action; 400 on validation failure.
5. Unified error envelope `{ error: { code, message } }` with CORS headers on every response (including errors).
6. Per-action authorization checks preserved verbatim (e.g. tenant admin vs global admin, org membership rules) — no behavior changes.

### File layout
```text
supabase/functions/user-management/
  index.ts          # router + CORS + auth + dispatch
  handlers.ts       # one function per action, pure logic
  schemas.ts        # zod schemas per action
  validate_test.ts  # ported from create-user/validate_test.ts (+ new cases)
```

### Frontend updates
Replace `supabase.functions.invoke("<name>", { body })` with `invoke("user-management", { body: { action, ...payload } })` in:
- `src/services/usuario/index.ts` (list, create, delete — 4 call sites)
- `src/services/admin/members.ts` (list)
- `src/services/comisiones/vendedoras.ts` (list — comment + call)
- `src/services/cliente-usuarios/index.ts` (invite-client + list-clients if included)
- `src/hooks/admin/useOrgMembersMutations.ts` (comment ref)
- `src/hooks/cliente/useClientUsersMutations.ts` (comment ref)
- `src/services/admin/__tests__/idempotencia.test.ts` (fixture `fn: "create-user"` → `"user-management"`)

No UI/component changes; services keep the same exported signatures so callers don't change.

### Cleanup
- Delete `supabase/functions/{create-user,delete-user,invite-client-user,list-users[,list-client-users]}/` from the repo.
- Call `supabase--delete_edge_functions` with the same names to remove deployed functions.
- Keep `_shared/cors.ts` as-is; update its docstring to reference `user-management`.

### Versioning / docs
- Bump `src/constants/appVersion.ts` (patch).
- Add `CHANGELOG.md` entry describing the consolidation and the new action contract.
- Update `ARCHITECTURE.md` edge-function section to list `user-management` and its actions.

### Validation
- Run `validate_test.ts` via `supabase--test_edge_functions`.
- Deploy `user-management` and smoke-test each action with `supabase--curl_edge_functions` (list, create dry-run, invite-client, list-clients, delete on a throwaway id).
- Run `src/lib/__tests__/architecture.test.ts` and any service-level tests.

### Risks
- Idempotency keys: existing rows reference `fn = 'create-user'`. Plan keeps idempotency working by passing `action` as the `fn` value going forward; historical rows remain valid (read-only).
- Frontend tests mocking `functions.invoke` by name will need their mock strings updated — included above.

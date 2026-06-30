# Plan: Errores de Sentry pendientes (últimos 7 días)

Resumen de los 3 issues abiertos:


| ID  | Descripción                                                                | Eventos | Usuarios | Causa raíz                                                                                                                   |
| --- | -------------------------------------------------------------------------- | ------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1M  | RPC `auditoria_capturar_snapshot` no encontrada (PGRST202) en `/auditoria` | 45      | 5        | Cliente llama el RPC **sin argumentos**, pero la firma requiere `p_organization_id uuid`                                     |
| 1R  | `Permisos insuficientes` (42501) en `/facturacion`, rol `contador`         | 1       | 1        | `_assert_writer` sólo acepta `admin`/`operador`; el rol `contador` está bloqueado al disparar una mutation desde facturación |
| 1K  | `Invalid login credentials`                                                | 2       | 0        | Error de usuario al teclear contraseña — no es bug                                                                           |


---

## Fix 1 — Auditoría snapshot (1M, prioridad alta)

**Síntoma:** Al entrar a `/auditoria` y disparar la mutation "Capturar snapshot", PostgREST devuelve PGRST202 porque la firma en BD es `auditoria_capturar_snapshot(p_organization_id uuid)` y el cliente llama sin parámetros.

**Cambio:**

1. `src/features/auditoria/services/snapshots.ts` — `capturarSnapshotAuditoria(organizationId: string)` ahora recibe el org id y lo pasa al RPC: `supabase.rpc("auditoria_capturar_snapshot", { p_organization_id: organizationId })`. Lanza un error claro si el id es null/undefined (defensivo).
2. `src/features/auditoria/hooks/useAuditoriaSnapshots.ts` — leer el `organizationId` activo desde `useOrganization()` y pasarlo a la mutation. Si no hay org activa, deshabilitar la mutation y devolver error legible.
3. `src/features/auditoria/services/__tests__/snapshots.test.ts` — actualizar los dos tests (`invoca el RPC` y `propaga errores`) para esperar el argumento `{ p_organization_id }`.

**No tocar BD:** la firma actual es la correcta y ya respeta multi-tenant.

## Fix 2 — Contador en facturación (1R, prioridad media)

**Síntoma:** Una contadora en `/facturacion` disparó una mutation que llegó a un RPC con `_assert_writer`, el cual sólo permite `admin`/`operador`/`super_admin`. Resultado: 42501.

**Acciones:**

1. Identificar el RPC concreto agregando un `breadcrumb`/tag temporal en `reportCaughtError` (o bien usar Sentry Replay del evento — ya hay réplica adjunta para 1M; pedir réplica del 1R en build). En el plan asumimos los RPCs típicos de facturación: `registrar_pago_factura`, `generar_proforma`, `crear_factura_emitida`, `convertir_proformas_a_factura`, `crear_pago_proveedor`.
2. Decidir política — la matriz de roles (`mem://features/roles-catalog`) indica que `contador` **sí** debe registrar pagos y operar facturación.
3. Cambio (migración nueva): crear helper `_assert_writer_contable(p_org)` que acepta `contador` además de `admin`/`operador`, y aplicarlo en los RPCs fiscales/CXC/CXP que hoy usan `_assert_writer` y son competencia de contabilidad. Los RPCs de **operación** (embarques, cotizaciones, duplicar, etc.) siguen con `_assert_writer` (sólo admin/operador).
4. Tests RLS: extender `supabase/tests/rls/test_rls_financiero.sql` con casos de contador feliz/triste.

**Pendiente confirmar con el usuario:** ¿el rol `contador` debe poder ejecutar **todas** las mutations de `/facturacion` (emitir, timbrar, registrar pago, generar REP, cancelar) o sólo "registrar pago" y "generar proforma"? Esto define la lista exacta de RPCs a relajar.

## Fix 3 — Invalid login (1K)

No es un bug; es un usuario tecleando mal su contraseña.

**Acción:** Marcar el issue como **Resuelto / Ignorado** en Sentry vía `update_issue` con razón "user-error: invalid credentials no es un bug". No requiere código.

---

## Versionado y changelog

- Bump a `13.141.6` (patch).
- Entrada en `CHANGELOG.md` con los 3 hallazgos y sus fixes.
- Actualizar `mem://audit/pendings` si quedan items abiertos.

## Detalles técnicos

```text
src/features/auditoria/services/snapshots.ts
  - capturarSnapshotAuditoria(organizationId: string): Promise<void>

src/features/auditoria/hooks/useAuditoriaSnapshots.ts
  - const { organizationId } = useOrganization();
  - useMutation({ mutationFn: () => capturarSnapshotAuditoria(organizationId!) })

supabase/migrations/<timestamp>_contador_writer.sql
  - CREATE OR REPLACE FUNCTION _assert_writer_contable(p_org uuid)
  - Sustituir _assert_writer por _assert_writer_contable en RPCs fiscales:
    * registrar_pago_factura, registrar_pago_proveedor
    * convertir_proformas_a_factura, generar_proforma_desde_embarque
    * (lista final pendiente de confirmar)
```

¿Procedo con **Fix 1 + Fix 3** ya, y dejamos **Fix 2** hasta que confirmes qué mutaciones de facturación deben abrirse al rol `contador`? ¿O quieres que `contador` quede habilitado para todas las mutations de `/facturación`? Contador debe de tener los permisos. 


## Auditoría Final v8.6.0 — Oportunidades de Compactación

El codebase está muy limpio. Los hallazgos son menores y orientados a **reducir volumen** más que a corregir problemas.

---

### Hallazgos

#### 1. ALTO — `Changelog.tsx` tiene 2,018 líneas (261 entradas)

Es el archivo más grande del proyecto por mucho. Debería externalizarse a un archivo de datos JSON/TS y renderizarse con un componente ligero.

**Solución**: Mover las entradas a `src/data/changelogData.ts` y dejar `Changelog.tsx` como un componente de ~50 líneas que importa y renderiza.

---

#### 2. MEDIO — Supabase calls directos en 4 componentes

Persisten llamadas directas a `supabase.from()` / `supabase.functions.invoke()` en componentes UI en vez de hooks:

- **`NuevoUsuarioDialog.tsx`**: query a `organizations` + insert a `organization_members` + `create-user` invoke (3 llamadas)
- **`TabPortalCliente.tsx`**: `invite-client-user` invoke + `delete` en `client_users` (2 llamadas)
- **`AdminUsuarios.tsx`**: `delete-user` invoke (1 llamada)
- **`PortalCotizacionDetalle.tsx`**: `portal_responder_cotizacion` RPC (1 llamada)

**Solución**: Extraer mutaciones a hooks dedicados (`useUsuarioMutations`, `useClientUsersMutations`, `usePortalCotizacionMutations`).

---

#### 3. BAJO — `Embarques.tsx` (379 líneas) combina filtros complejos + tabla

Es la página de listado más grande. Los filtros (modo, estado, operador, rango de fechas) podrían extraerse a un componente `EmbarquesFiltros`.

**Solución**: Extraer componente de filtros para reducir a ~200 líneas.

---

#### 4. BAJO — `useOperacionesData.ts` (324 líneas) hace cálculos de date-fns inline

Usa `format`, `subMonths`, `startOfMonth`, etc. directamente. Son cálculos legítimos de agregación pero podrían modularizarse.

**Solución**: Opcional — solo si crece más.

---

### Plan de acción

| Paso | Descripción | Impacto |
|------|------------|---------|
| 1 | Externalizar datos de Changelog a archivo `.ts` separado | -1,950 líneas en página |
| 2 | Extraer mutaciones Supabase de 4 componentes a hooks | Separación de concerns |
| 3 | Extraer filtros de `Embarques.tsx` a sub-componente | -150 líneas en página |


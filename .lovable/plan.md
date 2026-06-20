# Auditoría arquitectónica — Libre Carga

Resultado de 4 subagentes en paralelo (tamaño/complejidad, separación de capas, duplicación/código muerto, naming/estructura). El proyecto está **mayormente sano**: las migraciones de Pasos 8-10 dejaron `src/pages/` y `src/contexts/` vacíos, las capas `lib` y `services` no importan de capas superiores, los formateadores están centralizados y `domain/` es puro. Los hallazgos se concentran en **fugas Supabase en componentes** y **shims residuales** post-migración.

## Hallazgos por categoría

### A. God Components — UI llamando a Supabase directo (CRÍTICO)
La regla "componentes no llaman a `@/integrations/supabase/client`" se rompe en 7 puntos:

| Archivo | Línea | Llamada |
|---|---|---|
| `src/features/facturacion/components/FacturasMasivasToolbar.tsx` | 33, 78 | `supabase.from("facturas").select/update` |
| `src/features/facturacion/components/DialogTimbrarFactura.tsx` | 11, 84 | `clientes.maybeSingle`, `facturas.update` |
| `src/features/embarques/components/TabDemoras.tsx` | 20, 55 | `embarque_contenedores.update` |
| `src/features/embarques/components/facturacion/ProformaInconsistenteAlert.tsx` | 13, 42 | `supabase.rpc("asignar_conceptos_a_proforma")` |
| `src/features/cotizacion/components/seccionRuta/aplicarTarifa.ts` | 4, 25 | client + `bitacora_actividad` |

### B. Shims de re-export huérfanos (post Paso 10)
8 archivos en `src/components/shared/utils/*` cuyo único contenido es `export * from "@/lib/...";` Ya no aportan: son `authSnapshot`, `authSnapshotBuilder`, `auditoriaConfig`, `errorDetailsStore`, `errorReportFormat`, `estadoConfig`, `kpiTones`, `uiMappings`.

### C. Archivos largos
- `src/integrations/supabase/types.ts` (6887) — autogenerado, no tocar.
- `src/components/ui/sidebar.tsx` (637) — shadcn primitiva original; partirlo invalida la convención shadcn (riesgo alto/beneficio bajo).
- Resto del top 25 está bajo 222 líneas. **No hay deuda de tamaño real.**

### D. Código muerto (knip)
- Exports no usados: `useRevalidarTarifa` (`useRevalidacionTarifa.ts`), `useAceptarCotizacionVersion` y `useCostosCotizacionVersion` (`useVersionadoCotizacion.ts`).
- Bloque comentado: `src/features/cotizacion/services/conversiones/portal.ts:22-26` (invocación a Edge Function abandonada).
- 7 barrels `index.ts` con ≤2 usuarios externos (eliminables).
- Scripts residuales en root: `count_its.py`, `detect_weak.py`, `audit_coverage.cjs`.

### E. Naming inconsistente
- Columnas: `clienteColumns.tsx` (camel) vs `AdminOrganizacionesColumns.tsx` (Pascal). Sin estándar único.
- Spanglish: `useAdminOrgConfig` vs `useAdminOrgDetalle`, `useIdempotenciaLog` vs `useAppLogs`.
- Carpetas mezcladas: `admin/services/organization/` (singular) vs `organizations.ts` (plural); `admin/routes/admin-org/` (kebab) vs `AdminOrganizaciones.tsx` (Pascal).

### F. Misplaced files
- `src/components/shared/utils/auditoriaConfig.ts` → pertenece a `features/auditoria/`.
- `src/hooks/shared/useOrgFilter.ts` y `usePermissions.ts` → acoplados a auth/org.
- `src/features/admin/routes/BackfillLegacyCard.tsx` → es componente, no ruta.
- Carpetas con 1 archivo: `src/components/selects/`, `src/components/seo/`.

### G. Features con layout divergente
- `bandejas/` y `catalogos/` no siguen el estándar `{routes,components,hooks,services,domain,types}`.
- `auth/` no tiene `domain/`.

### H. Complejidad puntual
Top 3 (no crítica): `FacturasMasivasToolbar.tsx:30` (descargarZip con try/catch anidado), `embarqueColumns.tsx:37` (ternarios densos en `ContenedorCell`), `DialogTimbrarFactura.tsx:56` (array `checks` con validación inline).

---

## Plan ordenado (crítico → opcional)

### Paso 1 — CRÍTICO: Eliminar fugas Supabase en componentes
Mover las 7 llamadas directas a servicios:
- `FacturasMasivasToolbar` → nuevos métodos en `features/facturacion/services/facturas.ts`.
- `DialogTimbrarFactura` → `services/timbrado.ts`.
- `TabDemoras` → `features/embarques/services/contenedores.ts` (ya existe).
- `ProformaInconsistenteAlert` → `features/embarques/services/proformas.ts`.
- `aplicarTarifa.ts` → mover a `features/cotizacion/services/tarifas.ts` (separar puro/IO).
Tests de arquitectura existentes (`unsubscribe-encapsulation.test.ts` patrón) detectarán regresiones.

### Paso 2 — CRÍTICO: Borrar los 8 shims de `components/shared/utils/`
Reescribir imports `@/components/shared/utils/{authSnapshot,authSnapshotBuilder,auditoriaConfig,errorDetailsStore,errorReportFormat,estadoConfig,kpiTones,uiMappings}` → `@/lib/...` o `@/lib/ui/...` correspondiente. Después eliminar los archivos shim. Riesgo bajo: son re-exports de 1 línea.

### Paso 3 — ALTO: Mover `auditoriaConfig` a su feature
Cortar `src/lib/ui/auditoriaConfig.ts` (o donde quede tras Paso 2) → `src/features/auditoria/constants/auditoriaConfig.ts`. Actualizar imports.

### Paso 4 — ALTO: Eliminar código muerto detectado por knip
Borrar exports `useRevalidarTarifa`, `useAceptarCotizacionVersion`, `useCostosCotizacionVersion`. Limpiar bloque comentado en `conversiones/portal.ts:22-26`. Verificar con `bun run lint:unused:strict`.

### Paso 5 — MEDIO: Mover scripts residuales del root
`count_its.py`, `detect_weak.py`, `audit_coverage.cjs` → `/scripts/` (o eliminar si CI no los usa — verificar `.github/workflows/`).

### Paso 6 — MEDIO: Eliminar 7 barrels redundantes
`features/{dashboardEjecutivo,profit,reportes,dashboard,notificaciones}/{hooks,services}/index.ts` con ≤2 importadores. Reescribir esos importadores y borrar el barrel.

### Paso 7 — MEDIO: Reubicar archivos sueltos
- `BackfillLegacyCard.tsx` → `features/admin/components/`.
- `src/components/selects/SearchInput.tsx` → `src/components/shared/` y eliminar carpeta.
- `src/components/seo/Seo.tsx` → `src/components/shared/` y eliminar carpeta.
- Evaluar `useOrgFilter.ts` y `usePermissions.ts` → `features/auth/hooks/` (decisión: ¿son transversales o auth-owned?).

### Paso 8 — BAJO: Unificar naming de columnas a PascalCase
Renombrar `clienteColumns.tsx`, `usuariosColumns.tsx`, `embarqueColumns.tsx`, `facturacionColumns.tsx`, etc. → `ClienteColumns.tsx`, etc. Un test de arquitectura puede enforce.

### Paso 9 — BAJO: Spanglish y consistencia en `admin/`
Decidir un idioma por capa y renombrar `organization/`↔`organizations.ts`, `useIdempotenciaLog`↔`useAppLogs`, `useAdminOrgConfig`↔`useAdminOrgDetalle`.

### Paso 10 — OPCIONAL: Refactor de complejidad
Partir `descargarZip` (extraer worker), `ContenedorCell` (extraer helper), `checks` array de `DialogTimbrarFactura` (mover a `domain/`). Solo si los toca un feature nuevo.

---

## Notas técnicas

- **No tocar**: `src/integrations/supabase/types.ts` (autogen), `src/components/ui/sidebar.tsx` (primitiva shadcn), `src/components/ui/*` en general.
- **Pasos 1-4 son los de mayor impacto y menor riesgo**; cubren la mayoría del valor.
- **Pasos 5-7 son higiénicos**; ningún cambio funcional, solo orden.
- **Pasos 8-10 son cosméticos/refactor**; valor marginal, postergar hasta tener pretexto.
- Cada paso debe: actualizar `CHANGELOG.md` + bumpear `APP_VERSION` + correr `bun run lint -- --max-warnings 0` y `bun run lint:unused`.

## Resumen para no técnicos

Tu casa está bien construida. Hay 7 "cables sueltos" donde la cocina (UI) habla directo con la tubería principal (BD) en vez de pasar por el plomero (services) — eso es lo más urgente. También quedaron 8 "carteles viejos" señalando direcciones que ya cambiamos (shims) que se pueden quitar de una sola pasada. El resto son detalles de orden y nombres.

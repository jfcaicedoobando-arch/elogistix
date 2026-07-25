## Ola 2 · resto (P12 completo, P13, P14, P15) + Ola 3 · higiene (P17–P20)

Ya cerré P11, P16 y la mitad de P12 en `v13.317.4`. Faltan los ítems más pesados de Ola 2 y toda la higiene de Ola 3. Los agrupo en 2 tandas para poder revisarlas por partes.

### Analogía general
Ya cambiamos el escaparate del súper (P11) y sacamos la tortillería a un mostrador aparte (P12 parcial). Ahora toca reorganizar la cocina: dejar de contar los pagos dos veces (P13), pedir al servidor el resumen ya sumado en vez de traer todos los tickets (P14) y paginar dos filas más de bandejas (P15). Al final barremos migas (P17–P20).

---

### Tanda A · Ola 2 restante (~5 días)

**A1 · P12 completo (dynamic-import de `@react-pdf`)**  
Migrar los consumidores estáticos restantes de `@/pdf/documents/*` a `await import(...)` al hacer clic. Rutas afectadas:
- `src/features/tesoreria/routes/Tesoreria.tsx` → `ReporteTesoreriaDocument`
- `src/features/presupuesto/components/TabVsReal.tsx` → `ReportePresupuestoDocument`
- `src/features/profit/routes/ProfitEstadoResultados.tsx` → `ReporteEERRDocument`
- `src/features/cxp/routes/Cxp.tsx` → `ReporteCarteraDocument` (se combina con P18)
- `src/generators/cotizacionPdf.tsx` / `proformaPdf.tsx` / `rentabilidadPdf.tsx` → convertir el adaptador thin en `async` con `import()` del `Document`.
- Botones muestran "Generando PDF…" mientras resuelve; errores por `notifyError`.

**A2 · P13 · Trigger `recalcular_estado_factura` deduplicando SUMs** ⚠️ money
- Migración `CREATE OR REPLACE` que calcula el total pagado UNA vez en variable local y lo reutiliza. Sin tocar máquina de estados ni códigos `LC_*`.
- **Tests SQL obligatorios**:
  - `supabase/tests/sql/cxc_guard_sobrepago.sql` (correr existente)
  - `supabase/tests/sql/guard_estado_factura.sql` (correr existente)
  - Nuevo `supabase/tests/sql/p13_recalcular_estado_dedup.sql`: pago exacto → `Pagada`; parcial → `Parcial`; borrado lógico → recálculo; NC aplicada → `Pagada`.

**A3 · P14 · KPIs de dashboards con agregación server-side**
- Migración con 3 RPCs `SECURITY DEFINER` scopeadas por `current_user_org_id()`:
  - `dashboard_direccion_kpis(p_desde, p_hasta)`
  - `facturacion_tendencia_6m()`
  - `crm_resumen_abiertas()`
- Reemplazar `loaders.ts:28-64` (Dirección), `dashboardEjecutivo.ts:133-145` (tendencia) y el fetch abierto del CRM por llamadas a las RPCs. Mapper delgado en cada service preserva el shape que consumen los componentes.
- Eliminar el `.in("embarque_id", ids)` masivo.
- Tests vitest del mapper (fixture RPC → estructura esperada) + 1 test SQL con fixture chico.

**A4 · P15 · Cotizaciones paginada + Proformas sin `select("*")`**
- Cotizaciones: paginación server-side (50/pág) en `cotizacion/services/queries.ts` y consumo en la ruta, replicando patrón Embarques (`page`, `pageSize`, `count`, `keepPreviousData`, debounce 300 ms del search).
- Proformas: reemplazar `select("*")` de `proformas/services/queries.ts:69-73` por lista explícita de columnas realmente usadas + `count: "exact"` + paginación 50/pág.
- Ajustar tests de queries mockeadas al nuevo shape.

**Aceptación tanda A:**
- Chunk `react-pdf` desaparece del initial en Cxp/Profit/Tesorería/Presupuesto (DevTools Network).
- Dashboard Dirección baja de ~33k filas transferidas a <1k.
- Bandejas de Cotizaciones y Proformas cargan ≤50 filas por página.
- `lint 0`, `typecheck`, `test`, `audit:arch`, `audit:tests`, `supabase/tests/rls` y los tests SQL de P13 verdes.

---

### Tanda B · Ola 3 higiene (~1 día)

**B1 · P17 · `experimentalMinChunkSize: 10_000` en `vite.config.ts`**  
Añadir en `build.rollupOptions.output`. NO tocar `manualChunks`. Si aparece cualquier error de init en preview, se revierte inmediatamente.

**B2 · P18 · `Cxp.tsx` sin `useCobranza({})` al montar**  
Quitar el hook del cuerpo. En el handler del botón "Descargar cartera PDF" usar `queryClient.fetchQuery({ queryKey: queryKeys.cxc.cobranza(...), queryFn: fetchCobranza })` y luego el `import()` dinámico de `ReporteCarteraDocument` (se junta con A1).

**B3 · P19 · Heap del build en CI**  
En `.github/workflows/*.yml` (jobs que corren `vite build`): `env: NODE_OPTIONS: "--max-old-space-size=2048"`. Quitar valores mayores si existen.

**B4 · P20 · `"use memo"` en archivos calientes**  
Añadir la directiva a: `Cxp.tsx`, `cxpColumns.tsx`, `EstadoFacturaCxPCell.tsx`, `TesoreriaConciliacion.tsx`, `ResponsiveDataTable.tsx`. Solo después de A1–A4.

---

### Detalles técnicos

- **Convención migraciones (regla 7 del doc):** header comentado con propósito, `IF NOT EXISTS` en índices, sin `CONCURRENTLY`, `CREATE OR REPLACE` preservando grants (`GRANT EXECUTE` original si aplica).
- **Money guards (regla 1):** solo P13 toca dinero, y va con tests SQL obligatorios. P14 no altera cálculos: replica las mismas fórmulas que hoy corren en JS, en SQL.
- **queryKeys (regla 3):** cada RPC nueva se registra en el `queryKeys.ts` del feature (`dashboardEjecutivo.direccionKpis(...)`, `facturacion.tendencia6m(...)`, `crm.resumenAbiertas()`).
- **Sin librerías nuevas** (regla 10). Se usa `useWatch`, `useIsMobile`, `queryClient.fetchQuery`, RPCs existentes.
- **Versionado:** cada tanda un bump. Tanda A → `13.318.0` (cambio SQL + shape de RPCs). Tanda B → `13.318.1`. Ambos con entradas en `CHANGELOG.md`.

### Riesgos y mitigaciones

- **P13** es el ítem sensible. Mitigación: correr los 3 tests SQL antes de mergear y no tocar la máquina de estados. Si algún test falla, se abandona el ítem.
- **P14** cambia la forma de traer datos del dashboard más visto. Mitigación: comparar KPIs contra la versión JS actual en el fixture de tests; el mapper mantiene el shape para que los componentes no cambien.
- **P17** puede romper init-order si Vite agrupa mal. Mitigación explícita en el doc: revertir al primer error.

### Aceptación final

- Chunk inicial ya no contiene `@react-pdf/renderer` ni Sentry (Sentry ya salió en P6).
- Bandejas caliente ≤ 100 filas iniciales; server les manda paginado.
- Dashboards con mismos números y <10 requests.
- Tests SQL de dinero pasan idénticos.

### Qué queda fuera de este plan

- Reescribir Embarques o facturación-aging (regla explícita).
- Reintroducir `manualChunks`.
- Cambiar la config global de React Query.
- Cualquier ítem no listado en el doc.

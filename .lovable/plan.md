# Pendientes de auditorías recientes

Compilado desde: `docs/audit-tests-2026-06-08.md`, `docs/refactor/dry-hooks-audit.md`, `docs/cast-audit.md`, `docs/rls-multitenant-audit.md`, `docs/auditoria.md`, `docs/ui-audit/99-resumen.md` y el hilo actual (Sprint DRY 7a → 7c).

**Este documento es sólo un inventario — no ejecuta nada.**

---

## 🟢 Ya cerrado (referencia)

- Auditoría de tests: Sprints 1-4 completos (1442/1442 verdes).
- RLS Multitenant: 67/67 tablas OK.
- Cast Audit: 0 HIGH / 0 CRITICAL.
- UI Audit Capas 0-3: 22 hallazgos resueltos, 27/27 rutas con `PageHeader`/`PageContainer`.
- Sprint DRY: 7a (formatters), 7b (rutas centralizadas), 7c (consolidación AlertDialog + fix crítico `DialogEliminarEmbarque` + tests).

---

## 🔴 Pendientes CRÍTICOS

Ninguno. Todos los CRITICAL identificados están resueltos.

---

## 🟠 Pendientes ALTOS

### AUD-1 · Migrar RPC `auditoria_embarques_org` a `embarque_contenedores`

- **Fuente:** `docs/auditoria.md §7` + `mem://audit/pendings`.
- **Problema:** la RPC lee columnas legacy de `public.embarques` (`contenedor`, `tipo_contenedor`, `peso`, `volumen`, `piezas`) que hoy se mantienen por trigger desde `embarque_contenedores`. Si el trigger se apaga o se retiran las columnas, la auditoría de peso/volumen/contenedor deja de detectar correctamente.
- **Esfuerzo:** M (una migración SQL + backfill de tests).

### DRY-1 · Extender canónicos a los 18 `AlertDialog` inline restantes (Lote 7d)

- **Fuente:** hilo actual (cierre del Lote 7c).
- **Problema:** 18 diálogos siguen inline porque contienen forms embebidos (`Textarea`, `RadioGroup`, `Checkbox`, inputs con validación). No caben en la API actual sin un slot `children`.
- **Archivos:** `PortalCotizacionConfirmDialog`, `DesvincularCotizacionDialog`, `ConfirmSinDesgloseDialog`, `BotonesAprobacionFactura`, `CancelarFacturaProveedorDialog`, `CerrarFacturaSinPagoDialog`, `EmbarqueHeaderDialogs`, `TabDocumentos`, `FilaContenedor`, `ListaContenedoresEditable`, `SeccionDemorasAuto`, `AvanzarEstadoButton`, `FacturaPagosSection`, `TabCategorias`, `OrgMembersCard`, `BackfillLegacyCard`, `DocumentChecklist`, `ComprasPorAprobar.confirmDialog`.
- **Esfuerzo:** M (extender `ConfirmActionDialog` con slot `children`, migrar en 3-4 tandas).

---

## 🟡 Pendientes MEDIOS

### DRY-2 · KPI strips ad-hoc no usan `<KpiCard>` / `<KpiStrip>`

- **Fuente:** `docs/refactor/dry-hooks-audit.md` (C-2).
- **Sitios:** 4 archivos.
- **Esfuerzo:** M.

### DRY-3 · `usdFormatter` estático duplicado dentro del feature `costeo`

- **Fuente:** dry-hooks-audit U-3.
- **Sitios:** 2 archivos.
- **Esfuerzo:** S.

### DRY-4 · `cierreCheckFormatters.ts` — otro formatter de moneda local

- **Fuente:** dry-hooks-audit H-3.
- **Sitios:** 2 archivos.
- **Esfuerzo:** S.

### DRY-5 · Rutas relativas del portal sin constante

- **Fuente:** dry-hooks-audit K-2.
- **Sitios:** 6 archivos (falta agregar builders `portal.*` en `src/constants/routes.ts`).
- **Esfuerzo:** S.

### DRY-6 · `.toLocaleString("es-MX")` numérico vs `formatNumber()`

- **Fuente:** dry-hooks-audit K-3.
- **Sitios:** 4 archivos.
- **Esfuerzo:** S.

### DRY-7 · `useDebouncedValue` compartido

- **Fuente:** dry-hooks-audit (único hook que sobrevive el filtro YAGNI).
- **Sitios:** ~4 (`useEffect + setTimeout` repetido).
- **Esfuerzo:** S.

---

## 🔵 Pendientes BAJOS

### UI-1 · Capa 4 de UI Audit — modo oscuro

- **Fuente:** `docs/ui-audit/99-resumen.md §6`.
- **Alcance:** pasada completa de dark-mode sobre las 27 rutas.
- **Esfuerzo:** L.

### UI-2 · Vistas móviles < 640 px

- **Fuente:** `docs/ui-audit/99-resumen.md §6`.
- **Alcance:** hoy sólo validadas puntualmente (filtros de portal).
- **Esfuerzo:** M.

### UI-3 · Accesibilidad AA/AAA con herramienta automatizada

- **Fuente:** `docs/ui-audit/99-resumen.md §6`. Contraste y navegación por teclado no medidos con Axe/Lighthouse.
- **Esfuerzo:** S (correr Axe) + variable (fixes).

### UI-4 · Snapshots visuales de las 27 rutas en Playwright

- **Fuente:** `docs/ui-audit/99-resumen.md §7 punto 3` (recomendación).
- **Esfuerzo:** M.

### TEST-1 · Auditoría trimestral ligera de UI (~2 h)

- **Fuente:** `docs/ui-audit/99-resumen.md §7 punto 4`.
- **Próxima ventana:** octubre 2026.

---

## 📊 Recap por severidad


| Severidad | Cantidad                |
| --------- | ----------------------- |
| Críticos  | 0                       |
| Altos     | 2 (AUD-1, DRY-1)        |
| Medios    | 6 (DRY-2 → DRY-7)       |
| Bajos     | 5 (UI-1 → UI-4, TEST-1) |
| **Total** | **13**                  |


---

## 🎯 Recomendación de orden

Si vamos a atacar el backlog, sugiero este orden por relación valor/riesgo:

1. **DRY-1 (Lote 7d)** — cerrar la consolidación de dialogs; ya tenemos momentum, la extensión del canónico con `children` es 1 archivo.
2. **DRY-5 + DRY-3 + DRY-4 + DRY-6** — bundle "cleanup pequeño" en un solo minor (S+S+S+S ≈ 1 versión).
3. **DRY-7** — `useDebouncedValue` compartido (S).
4. **AUD-1** — migración de RPC; necesita ventana de mantenimiento + tests SQL.
5. **DRY-2** — KPI strips.
6. **UI-3** (Axe) antes que UI-1/UI-2 porque da métrica objetiva.
7. **UI-1** (dark mode), **UI-2** (móvil), **UI-4** (snapshots), **TEST-1** (auditoría trimestral).

---

## Notas técnicas

- Los ítems marcados como "resueltos" en los docs siguen en el archivo porque los MD se conservan como historial; no requieren acción.
- `mem://audit/pendings` (referenciada en `docs/auditoria.md §7`) existe como entrada del índice de memoria pero **no en el filesystem** — si quieres, en el próximo pase se puede materializar como archivo `.md` para no perder trazabilidad.
- El cast-audit se autogenera con `bun scripts/audit-casts.ts`; conviene reejecutarlo tras el próximo sprint DRY para verificar que no introducimos casts nuevos.

---

**Siguiente paso sugerido:** confirma si arrancamos con **DRY-1 (Lote 7d)** o prefieres primero el bundle **DRY-3/4/5/6** (cleanup pequeño de bajo riesgo). vamos en orden
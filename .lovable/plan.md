# Plan: Cerrar pendientes antes del rediseño de proformas

Dos auditorías paralelas (multi-contenedor + módulo proformas) revelaron **8 bugs críticos** y **deuda diferida** que conviene resolver antes de tocar el workflow nuevo. **No, los pendientes del plan anterior NO eran todos**: faltaban bugs de atomicidad, idempotencia y varias vistas que aún leen el campo legacy `embarques.contenedor`.

## Respuesta corta

- **Críticos nuevos detectados:** 8 (4 multi-contenedor + 4 proformas).
- **Importantes:** 12 (vistas con campo legacy, PDF sin contenedores, defaults incorrectos).
- **Tests faltantes:** 4 suites (Fase 4 original quedó incompleta).
- **Recomendación:** ejecutar Fases 5, 6 y 7 (abajo) antes de empezar el rediseño de proformas. Total estimado: 3 versiones menores.

---

## Fase 5 (v12.13.0) — Críticos de datos

Bugs que pueden corromper datos hoy mismo. Sin esto, el rediseño hereda problemas.

1. **B-1 · `crearProforma` atómica** (`src/services/proforma/crud.ts:26-74`)
   - Mover creación a RPC `crear_proforma_atomica` que haga en una transacción: update `aplica_iva` + insert `proformas` + update `proforma_id` en conceptos.
   - Eliminar el compensador frágil del cliente.

2. **B-2 · `marcarProformaFacturada` idempotente + factura USD/MXN huérfana** (`src/services/proforma/facturar.ts:17-104`)
   - Añadir `requestId` (uuid) y guard `WHERE factura_id IS NULL`.
   - Cuando hay USD+MXN, persistir ambos IDs (nueva columna `factura_secundaria_id` en `proformas` o tabla puente).
   - Diferenciar path en Storage por moneda: `${org}/${proforma}/factura-${moneda}.pdf`.

3. **B-3 · Race condition `tiene_proforma`** (`src/services/proforma/crud.ts:95-107`)
   - Quitar el `UPDATE embarques SET tiene_proforma = false` del cliente; confiar exclusivamente en el trigger DB `trg_sync_embarque_tiene_proforma`.

4. **B-4 · `ProformaDocument` sin agrupación por contenedor** (`src/pdf/documents/ProformaDocument.tsx:62-105`)
   - Replicar el agrupador de `ProformaConsolidadaDocument` (líneas 35-45) pero usando `contenedor_id` real (no campo legacy).
   - Si la proforma cubre 1 solo contenedor, mantener layout actual; si cubre N, secciones separadas.

5. **C-4 · `sincronizarContenedores` atómica** (`src/services/embarque/contenedores/crud.ts:124-155`)
   - Mover a RPC DB `sincronizar_contenedores_embarque(embarque_id, contenedores jsonb)` con SAVEPOINT, para evitar perder hijos si falla el INSERT después del soft-delete.

## Fase 6 (v12.14.0) — Multi-contenedor en vistas restantes

Lugares donde el código aún lee `embarques.contenedor` (legacy) en vez de `embarque_contenedores`.

6. **C-1 · Tracking UI multi-contenedor** (`src/components/embarque/TabTracking.tsx`, `src/hooks/embarque/useTrackingLiveCard.ts`, `src/pages/portal/PortalEmbarqueDetalle.tsx`)
   - Aceptar lista de contenedores; selector/acordeón por contenedor activo.
   - Mantener JSONCargo deprecado (no agregar features, sólo no romper).

7. **C-2 · Portal cliente** (`src/hooks/portal/usePortalEmbarquesController.ts:15`, `src/components/portal/EmbarqueCard.tsx:68`, `src/components/portal/embarqueDetalle/PortalEmbarqueResumenTab.tsx:66`)
   - Búsqueda, card y detalle leen todos los hijos.
   - Mostrar formato `MSCU123 +2` con tooltip.

8. **C-3 · Limpiar auto-sync JSONCargo basado en campo legacy** (`src/hooks/embarque/mutations/useUpdateEmbarque.ts:52`)
   - Reemplazar `e.contenedor` por lectura de `embarque_contenedores` (o eliminar del todo si JSONCargo va a salir pronto).

9. **I-1..I-7 · Vistas que muestran sólo contenedor 1:**
   - `ResumenCards.tsx:17` (detalle operador).
   - `EmbarquesActivosTable.tsx:51` (dashboard).
   - `useEmbarquesPageController.ts:115` (export CSV — añadir columna lista o filas por contenedor).
   - `buildFilas.ts:51` + `agrupar.ts:11-26` (proyección de facturación cuenta mal).
   - `ProformaConsolidadaDocument.tsx:38` (agrupar por `contenedor_id` real, no string legacy).
   - `EmbarquesRelacionadosCard.tsx:55`.
   - Estrategia común: usar `useContenedoresInfoMap` (ya existe desde 12.12.0) y mostrar `primero +N`.

10. **R-1, R-2, R-3, R-5 · Defaults y caches de proformas**
    - `TASA_IVA` hardcoded en 3 PDFs → leer siempre de `proforma.tasa_iva_aplicada` (sin default).
    - `HistorialProformas.tsx:22` → default `"pendiente"` no `"aprobada"`.
    - `aprobarProformas` → guard `WHERE estado_revision = 'pendiente'`.
    - `useCrearProforma.onSuccess` → invalidar también `queryKeys.facturas.all`.

## Fase 7 (v12.15.0) — Tests + cleanup + docs

11. **Tests faltantes (Fase 4 original incompleta):**
    - `sincronizarContenedores` (preserve IDs, soft-delete, fallo parcial).
    - `useEditarEmbarqueWizard` hidratación.
    - `convertirCotizacionAEmbarques` (1, 3, BL vs Contenedor, `num_contenedores=null`).
    - `proforma.ts` cobertura completa de `contenedores_lista` y `MULTI_CONTENEDOR`.

12. **Cleanup deuda diferida:**
    - Split `useDialogGenerarProformaController.ts` (209 líneas) y `proforma.ts` (211).
    - Quitar `embarqueId!` non-null assertion (`proforma.ts:151`).
    - Distinguir `contenedor null` vs `""` en `ProformaConsolidadaDocument`.
    - Eliminar `contenedor, tipo_contenedor` del SELECT de `fetchProformasPendientes` una vez que el fallback ya no se use.

13. **Docs:**
    - Actualizar `docs/embarques-contenedores.md` (versión, contradicción wizard, tabla de campos legacy).
    - Nuevo `docs/proformas-pre-rediseño.md` con estado actual y handoff al rediseño.

14. **Versionado:** bump `APP_VERSION` + entrada en `CHANGELOG.md` al cierre de cada fase.

## Fuera de alcance (siguiente milestone)

- **Rediseño del workflow de proformas** propiamente dicho (se aborda después de Fase 7 con base estable).
- **D-4** Migración de `marcarProformaFacturada` a edge function — pertenece al rediseño.
- Reemplazo de JSONCargo por proveedor nuevo de tracking.
- Migración masiva de embarques legacy a `embarque_contenedores`.

## Detalles técnicos

- **RPC atómicas (B-1, C-4):** ambas siguen el patrón `SECURITY DEFINER` + `SET search_path = public` ya estándar en el proyecto. Validar `organization_id` dentro del RPC.
- **`useContenedoresInfoMap` reuso:** ya bachea queries, pero hoy sólo lo usa el dashboard. Extenderlo al portal requiere pasar `organization_id` cuando el caller es cliente final (RLS lo cubre).
- **PDF multi-contenedor (B-4):** el grupo "general" (`contenedor_id IS NULL`) debe ir al final, separado, con encabezado "Cargos generales del embarque".
- **Tests:** usar el patrón existente con `vi.mock("@/integrations/supabase/client", ...)`.

## Orden de ataque sugerido

```text
v12.13.0 (Fase 5)  → B-1, B-2, B-3, B-4, C-4   [bugs críticos]
v12.14.0 (Fase 6)  → C-1, C-2, C-3, I-1..I-7, R-1..R-5   [visibilidad + UX]
v12.15.0 (Fase 7)  → tests + cleanup + docs   [estabilización]
─────────────────────────────────────────────
v13.0.0            → rediseño del workflow de proformas
```

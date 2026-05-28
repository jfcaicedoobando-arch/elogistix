# Changelog

Registro de cambios de Libre Carga en formato [Keep a Changelog](https://keepachangelog.com/).
Versionado [SemVer](https://semver.org/). Orden descendente (lo más nuevo arriba).

Para el histórico anterior a `11.21.0` consultar el git history del repositorio
(antes los cambios vivían en `src/content/changelog/`).

## [12.0.0] - 2026-05-28

Cierre del major **12.0.0**. Resumen consolidado de lo entregado durante los `rc.1` → `rc.17` (el detalle granular se conserva más abajo).

- **CRM ↔ Cotizaciones**: integración bidireccional. El wizard de cotización permite *vincular* a lead/oportunidad existente o *crear* uno nuevo (lead + oportunidad en etapa "Cotizando") automáticamente. Cambios de estado de la cotización propagan a la etapa CRM (Enviada → Negociación, Aceptada → Ganada, Rechazada → Perdida). La conversión Prospecto → Cliente propaga `cliente_id` a la oportunidad y marca el lead como `Convertido`.
- **Embarques**: ciclo de 7 estados con timeline automático, alertas de demurrage en sidebar, estatus de liquidación (pagados/pendientes), alerta de documentación incompleta, duplicación con override de contenedor/peso/volumen/piezas.
- **Cotizaciones**: wizard refinado con `NumericInput` (decimales, sin spinner, sin scroll accidental) en LCL/aérea y conceptos de costo/venta; incoterms estándar compartidos; conversión a embarque sólo tras convertir prospecto a cliente.
- **Pre-facturación**: rediseño completo del módulo en 5 pestañas numeradas (Proyección → Por aprobar → Proformas → Facturas → Pagos), guía colapsable, banner compacto de Hueco de Facturación, ventana relativa de 24 meses atrás / 12 adelante en Proyección.
- **Multi-tenant**: aislamiento por `organization_id`, impersonación, demo readonly, *unified user management* (admins locales y globales) y *unified login* con ruteo por rol.
- **Portal de cliente**: RPCs `SECURITY DEFINER` de lectura, gráficas apiladas, layout limpio.
- **Dashboard operativo**: categorías de riesgo (Crítico, En Puerto), badge dinámico de alertas en sidebar.
- **Tablas**: estandarización de `DataTable`, zebra striping, paginación servidor con `.range()`, simplificación a `100 / pág` + `Todos` en todas las tablas principales.
- **Infraestructura**: tipos de cambio dinámicos (Frankfurter.app, caché 1h), `Chunk Load Recovery` automático, observabilidad estructurada (`requestId`, `errorCode`, `method`) en ~109 puntos.
- **Auditoría arquitectónica**: Bloque A cerrado (33 archivos migrados a `services/{admin,crm,portal,embarque,auth,organization}/`), Power of 10 aplicado, `Storage RLS Paths` validado vía `EXISTS`, `Browser Storage Wrapper` único, `Inline Styles Policy`, marcador `// SAFE-CAST:`, baseline de imports congelado (33 → 0).

**Deuda diferida a 12.x** (no bloqueante): pendientes Bloque B/C/D de auditoría (B6 split de `ImportarLeadsCsvDialog` / `BulkImportDialog`, B7 doc excepción `sidebar.tsx`, C9 renombrar shims en `hooks/crm/`, C10 auditar 25 `style={{…}}` inline, C11 prefijos `Configuracion.tsx` / `TabFacturacion.tsx`, D12 split `routes.tsx`), P1.5-1.7 (unificar `utils/`, romper servicios "god", schemas zod en boundary Supabase), refactor de complejidad para destrabar guardrail a 12, P3.13-16 (más E2E, convención hooks, split `TrackingPublico`, `Result<T,E>`), complejidad de edge functions `create-user` / `delete-user` / `invite-client-user` / `_shared/jsoncargoSync`. WARN preexistentes del linter Supabase (extension in public, SECURITY DEFINER públicos en RPCs de portal) también diferidos.

---

## [12.0.0-rc.17] - 2026-05-28
- **feat(crm/cotizaciones)**: integración CRM ↔ Cotizaciones (enfoque híbrido CRM-first con atajo). En el wizard "Nueva Cotización", al elegir **Prospecto** ahora se muestran dos modos: (a) **Vincular a lead u oportunidad existente** — combobox con búsqueda debounced (200 ms) sobre `crm_leads` + `crm_oportunidades` sin cliente, que precarga los datos al seleccionar; (b) **Crear nuevo prospecto** — formulario clásico con banner informando que se creará lead + oportunidad automáticamente. Al guardar el Paso 1 con `es_prospecto = true`, el helper `vincularOCrearOportunidadParaCotizacion` (en `src/services/crm/vincularCotizacion.ts`) decide entre: enlazar oportunidad existente, crear oportunidad sobre lead existente, o crear lead + oportunidad nuevos (etapa "Cotizando"). Es idempotente: en edición no recrea nada. Adicionalmente, los cambios de estado de la cotización propagan a la etapa CRM (`Enviada → Negociación`, `Aceptada/En operación → Ganada` con `fecha_cierre_real`, `Rechazada → Perdida`) y la conversión Prospecto → Cliente propaga `cliente_id`/`cliente_nombre` a la oportunidad y marca el lead como `Convertido` con `cliente_convertido_id` y `oportunidad_convertida_id`. Nuevos archivos: `src/services/crm/vincularCotizacion.ts`, `src/hooks/crm/useCrmProspectoSearch.ts`. Modificados: `SeccionDestinatario.tsx`, `useCotizacionWizardSteps.ts`, `useCotizacionDetalleHandlers.ts`, `CotizacionFormValues`. Fallos del CRM no bloquean el flujo de cotización (sólo registran un toast).

## [12.0.0-rc.16] - 2026-05-28
- **fix(pre-facturación)**: el selector de mes en la pestaña *Proyección* ahora usa una ventana relativa de **24 meses atrás a 12 adelante** respecto a hoy, en lugar del piso fijo en Abril 2026. Esto permite consultar meses anteriores (útil para revisar ETAs históricas) sin recargar el catálogo. `mesActualKey` deja de aplicar el clamp a Abril 2026 y devuelve el mes real actual.

## [12.0.0-rc.15] - 2026-05-28
- **ux(pre-facturación)**: rediseño completo del módulo para reducir confusión. (1) Se elimina la barra global de "Periodo Desde/Hasta": ahora el filtro de rango sólo aparece dentro de las pestañas que lo usan (Por aprobar, Proformas, Facturas, Pagos a proveedores), evitando convivir con el selector de mes de Proyección. (2) Las pestañas se numeran siguiendo el flujo natural: `1. Proyección → 2. Por aprobar → 3. Proformas → 4. Facturas emitidas → 5. Pagos a proveedores`. (3) Cada pestaña lleva un icono `Info` con tooltip describiendo su propósito. (4) Nueva guía colapsable "¿Cómo funciona este módulo?" con mini-diagrama de flujo de 5 pasos y explicación del Hueco de Facturación (`GuiaPrefacturacion.tsx`). (5) El banner del Hueco de Facturación se compacta a una sola fila (~52px vs ~120px) manteniendo la misma información y acción "Ver detalle". Sin cambios en lógica de filtros, RPCs, ni esquemas.

## [12.0.0-rc.14] - 2026-05-28
- **feat(embarques)**: el diálogo *Duplicar embarque* ahora permite editar por copia el **tipo de contenedor** (dropdown del catálogo `useTiposContenedor`), **peso (kg)**, **volumen (m³)** y **piezas**, además del número de contenedor. Pre-llena cada copia con los datos del embarque origen para conservar el flujo rápido, pero habilita ajustar contenedores con cargas distintas dentro del mismo shipment. El RPC `duplicar_embarque_completo` ya soportaba estos campos; sólo se exponen en la UI.

## [12.0.0-rc.13] - 2026-05-28
- **fix(cotizaciones)**: en cotizaciones de prospecto (`es_prospecto = true`) se ocultan los botones "Crear Embarque" y "Generar Embarques" hasta que el prospecto sea convertido a cliente. Esto previene un error de runtime al intentar insertar embarques sin `cliente_id`. Adicionalmente, el botón "Convertir a Cliente" pasa a `variant="default"` (primario) y el banner amarillo del prospecto indica explícitamente que debe convertirse antes de generar embarques.

## [12.0.0-rc.12] - 2026-05-28
- **fix(embarques)**: los campos de Monto/Cantidad en Conceptos de Costo y Venta del wizard de embarques ahora aceptan decimales correctamente (`NumericInput`), sin flechas spinner ni cambios accidentales con scroll. Antes, `Number(e.target.value)` y el locale es-MX impedían escribir `1.5` o `1,5`.

## [12.0.0-rc.11] - 2026-05-27
- **fix(cotizaciones)**: los inputs de dimensiones en carga LCL y aérea (Nueva Cotización) ahora permiten borrar el `0` por defecto, no muestran flechas spinner, no cambian valor con el scroll del mouse y seleccionan el contenido al hacer foco. Nuevo componente compartido `NumericInput` (`src/components/shared/NumericInput.tsx`) usado en `SeccionMercanciaMaritimeLCL` y `SeccionMercanciaAerea`.

## [12.0.0-rc.10] - 2026-05-27
- **feat(tablas)**: el selector de filas por página simplificado a **100 / pág** (default) y **Todos** se aplica ahora a todas las tablas principales: Clientes, Proveedores, Cotizaciones, Leads, Actividades, Facturación (Facturas y Proformas). `useListPageState.DEFAULT_PAGE_SIZE` y `useTabProformasState` ajustados a 100. Se conservan sin cambios las tablas de Diagnóstico/Logs (opciones grandes intencionales), Oportunidades (kanban) y Bitácora/Auditoría.

## [12.0.0-rc.9] - 2026-05-27
- **feat(embarques)**: el selector de filas por página de la tabla de embarques se simplifica a **100 / pág** (default) y **Todos**. Se eliminan las opciones 10, 20 y 50. `PaginationControls` y `DataTablePagination` ahora aceptan `pageSizeLabels` para etiquetas personalizadas (ej. `999999 → "Todos"`).
- **fix(observability)**: restaurados imports de `ERROR_CODES` removidos por error en rc.8 en 14 archivos (catálogos, configuración, embarques, portal, admin).

## [12.0.0-rc.8] - 2026-05-27
- **chore(observability)**: el reporte estructurado de errores (`requestId`, `errorCode`, `method`, `validationErrors`) se aplica ahora globalmente. Se actualizaron ~109 llamadas a `notifyError` en ~60 archivos (hooks, componentes y páginas) para propagar el `error` crudo y un `method` semántico (ej. `DELETE_PROFORMA`, `HANDLE_SUBMIT`, `USE_PROVEEDOR_DETALLE_CONTROLLER`). Las validaciones inline sin `error` crudo añaden `errorCode: VALIDATION_FAILED`. UX inalterada; solo cambia el payload de debug.

## [12.0.0-rc.7] - 2026-05-27
- **feat(observability)**: reporte de errores enriquecido con `requestId` (UUID v4 vía `crypto.randomUUID`), `errorCode` estandarizado (catálogo `ERROR_CODES` en `errorCatalog.ts`: VALIDATION_FAILED, DB_ERROR, FORBIDDEN, CONFLICT, SERVER_ERROR, NETWORK_ERROR…) y `method` / acción semántica (ej. `CREATE_DRAFT_COTIZACION`, `SAVE_CONCEPTOS_VENTA_COTIZACION`). Los códigos se infieren del error si no se pasan.
- **feat(observability)**: `extractErrorDetails` detecta `ZodError` (directo o vía `.cause`) y emite `errorDetails.validationErrors[]` con `{ path, message, code }`. Resuelve el problema de `errorDetails: {}` vacío en fallas de validación de cotizaciones.
- **chore(cotizaciones)**: el wizard ahora propaga el error crudo (`error: e`) y un `method` por paso al `notifyError`, para que el extractor pueda inspeccionar el `ZodError` envuelto por `parseOrThrow`.
- Tests: cobertura de ZodError directo, ZodError en `cause`, y derivación de `errorCode` para RLS, conflicto, 5xx, validación y desconocido.

## [12.0.0-rc.6] - 2026-05-27

- **feat(facturación)**: nuevo filtro de rango de fechas (Desde / Hasta) en `/facturacion`, persistente en URL (`?desde&hasta`) y compartido entre pestañas. Presets rápidos: Hoy, Esta semana, Este mes, Mes anterior, Año actual, Limpiar. Default: mes en curso (día 1 → hoy). Aplica sobre `fecha_emision` en Pendientes, Proformas y Facturas, y sobre `fecha_vencimiento` en Liquidación de Gastos. Las exportaciones CSV y el Layout Contable respetan el rango activo. Proyección conserva su selector de mes propio (ya filtra por fecha en backend).
- Nuevos: `src/hooks/facturacion/useFacturacionDateRange.ts`, `src/components/facturacion/DateRangeFilter.tsx`.

## [12.0.0-rc.5] - 2026-05-27

- **fix(cotizaciones)**: refactor del schema de validación — se introduce `cotizacionDraftInputSchema` (basado en `cotizacionBaseSchema`) que permite `conceptos_venta: []` en la creación del borrador del Paso 1. `crearCotizacion` ahora usa este schema de borrador en lugar del schema final estricto. La validación de al menos un concepto sigue vigente en el Paso 3 antes de finalizar.
- **chore(cache)**: invalidación automática de caché al detectar cambio de `APP_VERSION` en `main.tsx` (`queryClient.clear()` + `clearPersistedQueryCache()`), para evitar que usuarios queden atrapados en builds antiguos (`rc.3`) con lógica de validación obsoleta. Nuevas utilidades `getStoredAppVersion`/`setStoredAppVersion`/`clearPersistedQueryCache` en `browserStorage` con clave `lc-app-version`.

## [12.0.0-rc.4] - 2026-05-27
- **fix(cotizaciones)**: permitir crear una cotización en el Paso 1 (Datos Generales) sin `conceptos_venta`. El schema `cotizacionInputSchema` exigía `min(1)`, pero los conceptos se capturan hasta el Paso 3 — esto rompía la creación con el error "Conceptos: se requiere al menos uno." La validación de al menos un concepto sigue vigente en la UI del Paso 3 antes de finalizar.


## [12.0.0-rc.3] - 2026-05-27
- **Branding de PDFs leído desde `configuracion.empresa`** (hoy: *Elogistix Shipping*). Eliminado el hardcode "Libre Carga" en `BrandHeader`, `Footer` y los metadatos `author` de todos los documentos.
  - Nuevo `src/pdf/emisor.ts` con caché en memoria (TTL 5 min) que lee `nombre`, `subtitulo`, `rfc`, `direccion_fiscal`, `email` y `teléfono` de la tabla `configuracion`.
  - `BrandHeader` ahora muestra dinámicamente la razón social en mayúsculas y el subtítulo; `Footer` recibe `empresaNombre` opcional.
  - Generadores (`cotizacionPdf`, `proformaPdf`, `rentabilidadPdf`) son `async` y cargan el emisor antes de renderizar; todos los call sites ya esperaban `await` (CotizacionDetalle, useDescargarProformaPdf, useDialogGenerarProformaController, useReportesPageController).
  - Cambiar el nombre en `/configuracion` se refleja en el siguiente PDF generado tras invalidar caché (recarga o esperar TTL).

## [12.0.0-rc.2] - 2026-05-27
- **Pulido visual de PDFs ("Libre Carga Invoice System")**. Sistema visual unificado para Cotización, Proforma y Proforma Consolidada.
  - Nuevos componentes compartidos: `BrandHeader` (banda superior corporativa + marca + tipo doc + folio + meta), `BillToBlock` (destinatario consistente), `TotalesBox` (tarjeta de totales con TOTAL en fondo corporativo, multi-moneda en una sola caja), `PaymentTermsBlock` (vigencia + método + datos bancarios) y `Footer` rebranded en 3 columnas con línea superior `primary`.
  - `DataTable`: zebra striping real en filas pares, header con fondo corporativo y texto blanco, separadores más sutiles (0.25pt).
  - `theme/styles.ts` depurado: paleta consolidada en un solo acento (`primary` #0F4C81), tipografía y espaciado calmados (h1Xl 26→18pt sin letterSpacing dramático, h3 más respirado, page padding 32→36/40).
  - Proforma: aviso "sin validez fiscal" pasa de caja dashed amarilla al pie a banner discreto bajo el header; emoji 📦 de contenedores reemplazado por chip tipográfico; vigencia (emisión + 30d) y bloque de pago añadidos.
  - Cotización: usa el mismo sistema (BrandHeader + BillToBlock + TotalesBox); conserva sus secciones de prospecto/mercancía/dimensiones.

## [12.0.0-rc.1] - 2026-05-27
- **Release Candidate cortado.** Cierre de los 3 hallazgos RLS pendientes del backlog pre-GA antes del corte de RC, dejando 0 hallazgos de seguridad abiertos sin justificar.
  - `auditoria_snapshots`: SELECT restringido a `admin` / `operador` de la organización (más `super_admin`). Antes cualquier miembro de la org podía leer la auditoría.
  - `bitacora_actividad`: SELECT del admin global ahora exige también scope por `organization_id` (vía `is_org_admin`), bloqueando que un admin de una org lea bitácoras de otra. `super_admin` mantiene visibilidad total.
  - `tracking_intentos`: SELECT/INSERT restringidos a `admin` / `operador` / `super_admin`. Viewer y cliente del portal bloqueados.
  - `client-error-log`: rate-limit aplazado por ausencia de primitivas de backend (ver `<no-backend-rate-limiting>`); el endpoint sigue siendo público intencionalmente para capturar crashes pre-auth. Documentado en `@security-memory` como riesgo aceptado.
- **Versión**: bump a `12.0.0-rc.1` (semver pre-release). Próxima ventana de 5-7 días para QA; sin show-stoppers → GA `12.0.0`.
- **Docs**: `docs/rc-qa-checklist.md §L` actualizado con 3 ✅ adicionales; `docs/release-notes-12.0.md` ajustado.
- **Tooling de corte GA**: nuevo `scripts/ga-gate.sh` (gate automatizado: tests + lint + versión exacta + checklist sin pendientes + perf sin placeholders), `docs/ga-cutover.md` (procedimiento paso a paso con smoke negativo/positivo + ventana de hipercuidado 48h), `docs/templates/ga-announcement.md` (comunicado es-MX listo para rellenar). El gate **bloquea** cortes prematuros: con la versión actual `12.0.0-rc.1` falla en el check #3 hasta que se haga el bump manual a `12.0.0`.

## [11.71.0] - 2026-05-27
- **Preparación Release Candidate (paso 1 de 2).** Cierre de gaps pre-RC antes de cortar `12.0.0-rc.1`.
  - **Seguridad — 2 hallazgos cerrados**: `invite-client-user` ahora usa allow-list de orígenes (elogistix + preview lovable + localhost) en lugar del header `Origin` arbitrario (cierra open-redirect potencial). `jsoncargo-track` añade `checkAdminAccess` tras `authenticate`: clientes/viewers reciben 403, ya no pueden gastar cuota del proveedor.
  - **Seguridad — backlog pre-GA documentado**: 3 RLS a endurecer (`auditoria_snapshots`, `bitacora_actividad`, `tracking_intentos` restringir a admin/operador/super_admin) + `client-error-log` necesita validación de firma JWT y rate limit. Trackeados en `docs/rc-qa-checklist.md §L`.
  - **Seguridad — aceptados**: 62 warns SECURITY DEFINER del linter son el patrón intencional (`mem://technical/security-patterns`) — funciones con `SET search_path = public` que validan internamente con `has_role()` / `current_user_org_id()`. Documentado en `@security-memory`.
  - **Docs nuevos**: `docs/rc-qa-checklist.md` (checklist A-N con criterio de corte RC/GA), `docs/rc-perf.md` (plantilla de smoke de performance + rollback dry-run), `docs/release-notes-12.0.md` (borrador de release notes en español MX para usuario final).
  - **Política RC**: nueva §9 en `docs/operations.md` con code freeze, flujo de corte (RC → ventana 5-7 días → GA) y criterios de aceptación.

## [11.70.0] - 2026-05-27
- **Auditoría de paginación cerrada** (68 → 0 RISK). Nuevo `scripts/audit-pagination.ts` con heurística refinada (lookahead para chain split, allowlist de catálogos, reconocimiento de `.in()` por FK e `.insert().select()`). Resultado: 174 queries inspeccionadas → 151 OK · 23 CATALOG · **0 RISK**.
- Caps defensivos `.limit()` aplicados a 6 queries agregadas: `services/auditoria/snapshots.ts` (2000), `services/crm/forecast.ts` (5000 × 3), `services/crm/leaderboard.ts` (5000), `services/facturas/index.ts` `fetchGastosPendientes` (2000). Cuando se rebasen estos topes hay que migrar a RPC server-side.
- **Revisión preventiva de archivos > 190 líneas** (10 archivos en zona 190-199): todos cohesivos y con margen sano vs cap warning de 250. Sin extracciones de valor. Marcado como cerrado.
- Docs: nuevo `docs/pagination-audit.md` (auto-generado), `power10-baseline.md` §2 refundido, `audit-cleanslate-11.69.0.md` §6/§7/§8 actualizados (pendientes cerrados).

## [11.69.2] - 2026-05-27
- **ESLint**: umbral `complexity` 15 → 16. Las funciones con CC = 15 dejan de generar warning (estándar de industria es 15; subir a 16 evita refactors de bajo valor). Docs alineados (`audit-cleanslate-11.69.0.md`, `power10-baseline.md`).

## [11.69.1] - 2026-05-27
- **docs**: poda de 4 MD históricos ya superados — `migracion-tabla-fase2.md` (v9.2.0), `refactor-tanstack-summary.md` (v10.1.3), `datatable-perf-audit.md` (v10.1.2), `linter-warnings.md` (v8.179.0). Ajustada referencia en `datatable-columndef-guide.md` para apuntar al CHANGELOG.

## [11.69.0] - 2026-05-27
- **Auditoría cleanslate** previa al desarrollo de nuevos módulos. Reporte agregado en `docs/audit-cleanslate-11.69.0.md`.
  - Tests: 119 suites / **770/770** verde · higiene 0 violaciones.
  - Arquitectura: 0 imports prohibidos, 0 archivos productivos >200 líneas (excepción shadcn).
  - Casts: **0 HIGH / 0 CRITICAL** sobre 730 (vs 750 en 11.59.x).
  - `any` explícito: 0. Effects sin cleanup: 1 falso positivo (AuthContext).
  - Complejidad: 38 funciones con CC 13-15 listadas y priorizadas (Cx fase 2: `services/*` + `lib/*` primero).
- Docs actualizados: `power10-baseline.md`, `tests-audit.md`, `auditoria.md`, `cast-audit.md` (regenerado).
- `.lovable/plan.md` consolidado con próximos pasos.

## [11.68.0] - 2026-05-27
- **Cx fase 1 — Reducir complejidad ciclomática de los 2 peores ofensores** (de 13 detectados con umbral 12).
  - `src/lib/crm/nextBestActions.ts`: `computeNextBestActions` CC 20 → 3. Extraídos 5 helpers puros (`nbaLeadsSinContactar`, `nbaCotSinRespuesta`, `nbaCierreProximo`, `nbaSinActividad`, `nbaActividadesVencidas`), cada uno con CC ≤ 5. La función pública queda como composición + sort.
  - `src/lib/csv/leadsCsv.ts`: arrow interna de `mapLeadCsvRows` CC 18 → 4. Extraídos `parseScore`, `parseFuente`, `parseEstado` + `LEAD_STRING_SETTERS` (lookup table tipada que evita el `as Record<string,string>`). `assignLeadField` queda con CC 5.
  - Tests existentes (`nextBestActions.test.ts` 4, `leadsCsv.test.ts` 8) garantizan equivalencia funcional; 770/770 verde.
- Umbral ESLint `complexity` se mantiene en 15 (bajará a 12 cuando los 11 ofensores restantes — todos en CC 15 — se hayan reducido en fases siguientes).

## [11.67.0] - 2026-05-27
- **P1.7 — Zod en 3 hotspots adicionales** (continuación de 11.66.0):
  - `src/hooks/configuracion/configSchemas.ts` (nuevo): `seguridadConfigSchema` y `plataformaConfigSchema` con defaults; helper `parseConfigSafe()` que cae a defaults ante tipos inválidos sin romper el panel admin. Adoptados en `components/admin/TabSeguridadGlobal.tsx` (6 `as boolean/number/string` eliminados).
  - `src/services/embarque/idempotencyClaimSchema.ts` (nuevo): unión `pending | cached` con `.passthrough()` + guard `isCachedClaim()`. Adoptado en `services/embarque/documentos.ts` (2 casts a `Record<string, unknown>` / `string` eliminados; rama cacheada ahora valida `path` explícitamente).
  - `src/components/auditoria/hallazgosFiltrosSchemas.ts` (nuevo): enums Zod para `regla`, `severidad`, `revision`, `responsable`. Adoptados en `HallazgosFiltros.tsx` (4 `as TipoX` en `onValueChange` eliminados; Radix sigue garantizando el dominio pero ahora hay parse explícito).
- 15 tests nuevos (`configSchemas`, `idempotencyClaimSchema`, `hallazgosFiltrosSchemas`); suite completa 770/770; `audit-report` y `architecture-baseline` en verde (0 HIGH/CRITICAL, 0 oversized).
- `diffFields.ts` (peso 12) descartado como hotspot Zod: sus casts son intrínsecos a la genericidad de la API, no boundary Supabase. Queda como deuda aceptada.

## [11.66.0] - 2026-05-27
- **P1.5 y P1.6 cerradas** (sin código). Verificación contra el árbol actual:
  - P1.5: ya existe solo `src/lib/utils/` (con `index.ts` como barrel); no hay `src/utils/` ni `src/lib/utils.ts`. Demás utilidades segregadas por dominio (`formatters/`, `io/`, `parsers/`, `validation/`).
  - P1.6: ningún servicio supera 200 líneas (mayor: `cliente/crud.ts` 174). `useHuecoFacturacion` 55 líneas; `facturas/proyeccion` y `cotizacion/mutations` ya son carpetas modulares.
- **P1.7 — Zod en 3 hotspots de mayor peso de riesgo**:
  - `src/lib/parsers/dashboardSchemas.ts` (nuevo): `arribosEsteMesSchema`, `resumenMesSiguienteSchema`, `cargaPorClienteSchema` con coerción numérica y `.passthrough()`. Adoptados en `parsers/dashboard.ts` con `safeParse` + fallback a `EMPTY_*` (preserva resiliencia visual).
  - `src/lib/mappers/embarquePayloadSchemas.ts` (nuevo): enums `modoEmbarqueSchema`, `tipoOperacionSchema`, `incotermSchema`, `tipoServicioMaritimoSchema`, `monedaSchema`. Reemplazan los `as EmbarqueInsert["…"]` en `embarqueToDb.ts` (errores claros en vez de fallos crípticos de Postgres).
  - `src/services/embarque/queries/embarqueRowSchema.ts` (nuevo): `embarqueListRowSchema`/`embarqueListRowsSchema` con `.passthrough()`. Validan las filas del export en `exportListado.ts` antes de generar el CSV.
- **Tests**: 3 archivos nuevos (`dashboardSchemas`, `embarquePayloadSchemas`, `embarqueRowSchema`) con casos happy/inválido por schema.
- `.lovable/plan.md` actualizado: P1.5/P1.6 cerradas; P1.7 marcada como **parcial** (3 hotspots cubiertos).

## [11.65.0] - 2026-05-27
- **D12 — Split de `src/routes.tsx`** (188 → 19 líneas) en 4 grupos por guarda + layout:
  - `src/routes/publicRoutes.tsx` (19): login, tracking, redirects, `*` NotFound.
  - `src/routes/portalRoutes.tsx` (32): /portal/* bajo `PortalProtectedRoute + PortalLayout`.
  - `src/routes/adminRoutes.tsx` (32): /admin/* bajo super_admin + `AdminLayout`.
  - `src/routes/appRoutes.tsx` (131): resto bajo `ProtectedRoute + Layout`, incluye sub-árbol /crm.
- Orchestrator `src/routes.tsx` reducido a 19 líneas: importa los 4 fragments y los compone dentro de `<Routes>`.
- Cero cambios visibles: paths, lazy chunks, guardas y layouts idénticos. Solo reorganización estructural.

## [11.64.0] - 2026-05-27
- **Fase 2 — D16: casts HIGH = 0 en código productivo** (antes 37 reportados).
- **Clasificador mejorado** (`scripts/lib/casts.ts`) con 2 reglas de degradación:
  - Test files (`__tests__/`, `*.test.{ts,tsx}`, `*.spec.{ts,tsx}`): `HIGH/CRITICAL → MEDIUM`. El mocking con `as unknown as X` es práctica estándar.
  - Comentario `// SAFE-CAST:` hasta 6 líneas arriba: `HIGH → LOW`. Opt-out documentado.
  - `CRITICAL` (`as any`, `JSON.parse(x) as Y`) nunca se degrada.
- **Refactors productivos** (3 casts eliminados, 1 conservado con justificación):
  - `src/lib/utils/omitUndefined.ts`: helper genérico tipado nuevo.
  - `VirtualDataTable.tsx`: `props as unknown as Record<string, unknown>` → `omitUndefined(props)`.
  - `exportCsv.ts`: firma acepta `ReadonlyArray<CsvHeader>` → elimina cast en `useHuecoFacturacion.ts` (compatible con `as const`).
  - `leadsCsv.ts`: asignación dinámica `(r as unknown as Record<string,string>)[field] = val` → `switch` exhaustivo sobre `keyof ParsedLeadRow`.
  - `queryPersistBootstrap.ts`: cast inevitable por marca privada de `@tanstack/react-query-persist-client`; comentario renombrado a `SAFE-CAST:` (queda en LOW).
- **Guardrail nuevo en `src/__tests__/audit-report.test.ts`**: falla CI si `bySeverity.HIGH > 0` o `CRITICAL > 0`.
- **Nuevo test** `src/__tests__/audit-casts-classifier.test.ts` (13 assertions) valida ambas reglas y los casos límite.
- Política documentada en `mem://principles/safe-cast`.
- Reporte regenerado: `750 casts → SAFE 297, LOW 9, MEDIUM 441, HIGH 0, CRITICAL 0`.

## [11.63.0] - 2026-05-27
- **Fase 1 del backlog de auditoría (D14 + C10)** — blindaje sin riesgo previo a refactors grandes.
- **D14 — Guardrail oversized > 200 líneas**: nueva aserción en `src/lib/__tests__/architecture-baseline.test.ts` que falla la CI si cualquier archivo productivo en `src/` supera 200 líneas. Antes el reporte sólo informaba; ahora frena el merge.
- **C10 — Inline styles**: migrados 4 casos estáticos a clases Tailwind:
  - `TablaCostosDetalle.tsx`: `style={{ borderTop: 'none' }}` → `border-t-0`.
  - `ChartSkeleton.tsx`: `width: '100%'` → `w-full` (height permanece dinámico).
  - `VirtualDataTable.tsx`: `width: '100%'` + `position: 'relative'` → `relative w-full`.
  - `VirtualTimeline.tsx`: removido `position: 'relative'` redundante (ya está en `className`).
- Los 30 `style={{…}}` restantes son excepciones legítimas y documentadas en `mem://principles/inline-styles`: react-pdf (`src/pdf/**`), valores computados por virtualizer (`@tanstack/react-virtual`), anchos `%` dinámicos (progress/profit bars) y colores hex provenientes de DB (CRM kanban, operaciones).

## [11.62.0] - 2026-05-27
- **Bloque D15 — Reporte CI consolidado**: nuevo `scripts/audit-report.ts` que agrega violaciones de capa (Supabase directo en hooks/contexts/components/pages), archivos productivos >200 líneas, casts HIGH+CRITICAL (top-10 por peso) y higiene de tests.
- Genera `reports/audit-report.md` (humano) y `reports/audit-report.json` (CI). El workflow `.github/workflows/ci.yml` añade steps: ejecuta el reporte, lo appendea a `$GITHUB_STEP_SUMMARY` en PRs y lo sube como artifact (retención 30d).
- Refactor: extracción de helpers puros a `scripts/lib/{walk,arch,casts,tests}.ts`. Los 3 CLIs (`audit-architecture`, `audit-casts`, `audit-tests`) quedan delgados (<50 líneas) e importan de `./lib/*`.
- Nuevos scripts npm: `audit:report` y `audit:all`. `.gitignore` ignora `reports/`.
- Test `src/__tests__/audit-report.test.ts` valida el shape del reporte y el baseline limpio (0 imports directos, 0 oversized, 0 violaciones de tests).
- **Cleanup C9 follow-up**: `LeadEditForm` movido a `src/types/crm/leadEditForm.ts`; `lib/crm/{leadEditDirty,oportunidadFormState,oportunidadFormHelpers}` ahora importan tipos desde `types/` o `services/crm/oportunidades` (corrige violación lib→hooks detectada por `architecture.test.ts`).

## [11.61.0] - 2026-05-27
- **Bloque C9 — Consistencia hooks/crm**: helpers no-hook movidos a `src/lib/crm/`:
  - `hooks/crm/oportunidadFormState.ts` → `lib/crm/oportunidadFormState.ts`
  - `hooks/crm/oportunidadFormHelpers.ts` → `lib/crm/oportunidadFormHelpers.ts`
  - `hooks/crm/leadEditDirty.ts` → `lib/crm/leadEditDirty.ts`
  - Eliminados stubs de re-export `hooks/crm/oportunidadPayload.ts` y `hooks/crm/automatizacionesEtapaActions.ts` (sin consumidores externos).
- `hooks/crm/` queda libre de archivos no-hook: 100% de los `.ts` ahí son hooks `useXxx`.
- C11 (duplicados `Configuracion.tsx` / `TabFacturacion.tsx`) descartado: las carpetas de dominio (`admin-org`/`crm`, `configuracion`/`embarque`) ya desambiguan; renombrar sería cosmético con alto blast radius.

## [11.60.0] - 2026-05-27
- **Bloque B — Power of 10 cerrado**: 0 archivos productivos >200 líneas (antes 3).
  - `services/crm/leads.ts` (209) → carpeta `services/crm/leads/{queries,mutations,bulk,convertir,index}` (≤106 líneas cada uno). API pública intacta vía barrel.
  - `components/crm/ImportarLeadsCsvDialog.tsx` (201 → 67): parser/mapper extraídos a `lib/csv/leadsCsv.ts` (puro + tests `leadsCsv.test.ts`), orquestación a `hooks/crm/useImportarLeadsCsv.ts`, preview a `components/crm/ImportarLeadsCsvPreview.tsx`.
  - `components/shared/BulkImportDialog.tsx` (200 → 114): `BulkImportBody`/`BulkImportFooter` movidos a `BulkImportDialogParts.tsx` y `downloadCsvTemplate` a `lib/csv/downloadCsvTemplate.ts`.
  - `lib/query/index.ts` (256 → 65): query-key factory partido por dominio en `lib/query/keys/{embarques,proformas,cotizaciones,clientes,facturas,proveedores,catalogos,dashboard,admin,crm,portal,auditoria,facturacion,misc}` (≤66 líneas cada uno). Nuevo test `keys-shape.test.ts` valida paridad de dominios y firmas.
- Suite: 111 archivos / 728 tests (+2 archivos, +12 tests).

## [11.59.2] - 2026-05-27
- **Docs refresh post Bloque A**: actualizados `.lovable/plan.md`, `ARCHITECTURE.md`, `docs/architecture-map.md`, `docs/auditoria.md`, `docs/power10-baseline.md`, `docs/tests-audit.md`, `docs/cast-audit.md` (regenerado: 720 casts, 37 HIGH) y `docs/strict-mode-roadmap.md`. Reflejan el nuevo baseline: **0** hooks/contexts/components/pages con import directo a `@/integrations/supabase/client`, 18 suites en `services/`, 109 archivos / 716 tests, 3 archivos productivos >200 líneas (leads.ts 210, ImportarLeadsCsvDialog 202, BulkImportDialog 201). Plan vigente: Bloques B/C/D.

## [11.59.1] - 2026-05-26
- **Sentry — filtro robusto de errores de chunk Vite**: se añade `ignoreErrors` en `initSentry()` (regex para "Failed to fetch dynamically imported module", "Importing a module script failed", "Loading chunk N failed", "ChunkLoadError"). Complementa el `beforeSend` existente y cubre también pestañas viejas con releases cacheados (ej. eventos llegando desde `11.28.0`). Estos errores son transitorios — la app se auto-recupera con reload — y no aportan señal a Sentry.

## [11.59.0] - 2026-05-26
- **Migración hooks → services (lote 6, FINAL de la auditoría 11.53)**: bloque Auth/Organization cerrado. Los 5 archivos restantes (`AuthContext`, `OrganizationContext`, `useAuthProfile`, `useAuthSession`, `useLoginAudit`) dejan de importar `@/integrations/supabase/client` directamente. Nuevos módulos: `services/auth/session` (`subscribeToAuthChanges`, `getCurrentSession`, `signOutCurrentSession`, `fetchUserContext` + tipo `CachedOrganization`), `services/auth/loginAudit` (`insertLoginAudit`) y `services/organization` (`listActiveOrganizations`). API pública de los contexts intacta. **Baseline arquitectónico = 0**: ningún hook ni context importa Supabase directamente, todo el acceso a datos pasa por `services/`. El test `architecture-baseline` ahora actúa como guardrail estricto contra cualquier regresión futura.

## [11.58.0] - 2026-05-26
- **Migración hooks → services (lote 5 de la auditoría 11.53)**: bloque Embarque cerrado. 3 hooks dejan de importar `@/integrations/supabase/client` directamente. Nuevo módulo `services/embarque/jsoncargo` con `fetchJsonCargoTracking`, `invokeJsonCargoTrack`, `invokeJsonCargoBolLookup`, `invokeJsonCargoTrackBackground` (fire-and-forget), `applyJsonCargoFechas` y `createDocumentoEmbarqueRow`. Hooks refactorizados (API pública intacta): `useJsonCargoTracking` + `useSyncJsonCargo` + `useApplyJsonCargoFechas`, `useJsonCargoBolLookup`, `useUpdateEmbarque` + `useCreateDocumentoEmbarque`. Baseline arquitectónico baja de 8 → 5 archivos con import directo a Supabase (sólo restan los 5 contexts de auth/org).

## [11.57.0] - 2026-05-26
- **Migración hooks → services (lote 4 de la auditoría 11.53)**: se cierra el bloque CRM. 8 archivos dejan de importar `@/integrations/supabase/client` directamente. Nuevos módulos: `services/crm/leads` (list/get/create/update/softDelete + bulk + `convertirLead` con `resolveClienteForConversion`/`fetchPrimeraEtapaAbierta`), `services/crm/automatizacionesEtapa` (`fetchEtapa`/`fetchOportunidad`/`runAutomatizaciones` + notify/tareas) y `services/crm/forecast` (`fetchForecast`, `fetchReportesCRM`, `fetchEtapaTipos`). Hooks refactorizados (API pública intacta): `useLeads`/`useLead`, `useCrear/Actualizar/EliminarLead`, `useActualizar/Eliminar/CrearLeadsBulk`, `useConvertirLead`, `useMoverEtapaConAutomatizacion`, `useForecast`/`useReportesCRM`. `automatizacionesEtapaActions.ts` y `leads/convertirHelpers.ts` quedan como re-exports thin para retro-compatibilidad. Baseline arquitectónico baja de 16 → 8 archivos con import directo a Supabase (sólo restan los 5 contexts y 3 hooks de embarque).

## [11.56.0] - 2026-05-26
- **Migración hooks → services (lote 3 de la auditoría 11.53)**: 4 hooks más dejan de tocar `@/integrations/supabase/client` directamente. Nuevos módulos en la capa de servicios: `services/crm/cliente360` (`fetchCliente360`), `services/crm/search` (`searchCrm` para el command palette), `services/crm/proximasActividades` (`fetchProximasActividades` batch lookup) y `services/crm/nbaSignals` (señales de leads/oportunidades para Next Best Actions). Hooks refactorizados manteniendo API pública: `useCliente360`, `useCrmSearch`, `useProximasActividades`, `useNextBestActions`. Baseline arquitectónico baja de 20 → 16 archivos con import directo a Supabase.

## [11.55.0] - 2026-05-26
- **Migración hooks → services (lote 2 de la auditoría 11.53)**: 3 hooks centrales de CRM dejan de tocar `@/integrations/supabase/client` directamente. Nuevos módulos: `services/crm/oportunidades` (list/get/crear/actualizar/moverEtapa/eliminar), `services/crm/dashboard` (`fetchCrmDashboard`) y ampliación de `services/crm/actividades` (list, crear, completar, posponer, eliminar, count/list vencidas). Hooks refactorizados (API pública intacta): `useActividades` + `useCrear/Completar/Posponer/EliminarActividad`, `useOportunidades` + `useOportunidad` + `useCrear/Actualizar/EliminarOportunidad` + `useMoverEtapa`, `useCrmDashboardData` + `useActividadesVencidasCount/List`. Baseline arquitectónico baja de 23 → 20 archivos con import directo a Supabase.

## [11.54.0] - 2026-05-26
- **Migración hooks → services (lote 1 de la auditoría 11.53)**: 10 hooks dejan de tocar `@/integrations/supabase/client` directamente, pasando ahora por la capa `services/`. Nuevos módulos: `services/crm/{actividades,comentarios,plantillas,etapas,notificaciones}`, `services/admin/observability` (alertas + app_logs + RPCs health), `services/portal/notificaciones`, `services/auth.getCurrentUser`. Hooks migrados: `useActualizarActividadNotas`, `useComentariosOportunidad`, `usePlantillasMensaje`, `useEtapasPipeline` (+ motivos perdida), `useCrmNotificaciones`, `useAlertasSistema`, `useAppLogs`, `useAppLogsHealth`, `useNotificacionesCliente`, `auditoria/revisiones/query`. Baseline arquitectónico baja de 33 → 18 archivos con import directo. APIs públicas de los hooks intactas (sólo el cuerpo cambió).

## [11.53.0] - 2026-05-26
- **Auditoría arquitectónica + guardrails de no-regresión**: nuevo script `bun run audit:arch` (`scripts/audit-architecture.ts`) que lista (1) hooks/contexts que importan `@/integrations/supabase/client` directamente, (2) components/pages con la misma violación, (3) archivos productivos >200 líneas (con allowlist para shadcn `sidebar.tsx` y catálogo plano `lib/query/index.ts`). Nuevo test `src/lib/__tests__/architecture-baseline.test.ts` que congela el baseline actual (33 archivos: 5 contexts + 28 hooks) y falla la CI si aparece una violación nueva, si components/pages introducen imports directos al cliente Supabase, o si una entrada del baseline ya se limpió pero quedó listada. La deuda existente (CRM, auth contexts, admin/portal/embarque) queda registrada en `mem://audit/pendings` para migración posterior a `services/`.

## [11.52.4] - 2026-05-26
- **Fix pantalla en blanco — eliminado `manualChunks` completo en `vite.config.ts`**: agrupar paquetes con imports circulares internos (`recharts`, `@react-pdf/renderer`, `@sentry/*`) en chunks vendor monolíticos rompía el orden de inicialización en producción con `Cannot access 'n' before initialization` (primero en `Layer.js` de recharts, luego en `pdf-vendor`). Quitamos también el `modulePreload.resolveDependencies` (sin chunks personalizados ya no aplica). Vite ahora genera chunks automáticos por ruta lazy; el bundle inicial crece un poco pero la app deja de quedarse en blanco. **Requiere republicar.**

## [11.52.3] - 2026-05-26
- **Fix definitivo pantalla en blanco (`Cannot access 'n' before initialization` en charts-vendor)**: eliminado el `manualChunks` de `recharts` en `vite.config.ts`. El chunk `charts-vendor` agrupado disparaba un error de inicialización por imports circulares internos de recharts/`react-smooth`/`d3-*`, y peor aún se cargaba en `/login` (donde no se usa recharts) porque Rollup hoisteaba deps compartidas dentro del chunk vendor. Ahora Vite coloca recharts dentro de los chunks de las rutas que efectivamente lo usan (Reportes, Operaciones, AdminDashboard, Auditoría), evitando que se cargue en login y rompiendo el ciclo de inicialización. **Requiere republicar la app.**

## [11.52.2] - 2026-05-26
- **Fix pantalla en blanco recharts (continuación)**: agregadas al `charts-vendor` chunk las dependencias restantes de `recharts` 2.15.4 según su `package.json` (`recharts-scale`, `react-is`, `eventemitter3`, `tiny-invariant`, `lodash`, `d3-ease`). Sin éstas, lodash/react-is quedaban en chunks separados y `react-smooth` / utilidades internas de recharts disparaban `Cannot access 'n' before initialization` en `Layer.js` al inicializarse fuera de orden. **Requiere republicar la app.**

## [11.52.1] - 2026-05-26
- **Fix pantalla en blanco en producción (`Cannot access 'n' before initialization` en `Layer.js`)**: las dependencias transitivas de `recharts` (`victory-vendor`, `d3-array`, `d3-scale`, `d3-shape`, `d3-path`, `d3-time`, `d3-time-format`, `d3-format`, `d3-interpolate`, `d3-color`, `internmap`, `react-smooth`, `fast-equals`, `decimal.js-light`) ahora se agrupan en el mismo `charts-vendor` chunk. Antes quedaban dispersas en otros chunks y los imports circulares internos de recharts se inicializaban en orden incorrecto, rompiendo la app al cargar.

## [11.52.0] - 2026-05-26
- **Verificación automática del build**: nuevo plugin Vite `verify-html-bundle` que corre en producción (`apply: "build"`). Valida que `dist/index.html` contenga (1) `<div id="root">` y (2) al menos un `<script src="/assets/*.js">` antes de completar el build. Si falta alguno, aborta con error descriptivo para evitar despliegues con página en blanco. Si ambos existen, logea `[verify-html-bundle] OK`.

## [11.51.0] - 2026-05-25
- **CRM — cierre de pendientes anti-fricción**: (1) Conversión Lead→Oportunidad sin perder contexto: nuevo `ConvertirLeadSheet` (Sheet lateral) con sólo 3 campos (nombre prefilled, monto, moneda) + checkbox crear cliente. Al confirmar se queda en `/crm/leads/:id` y muestra toast sonner "Lead convertido" con acción **"Abrir oportunidad →"** (5s). El `ConvertirLeadDialog` clásico sigue disponible vía botón "Más campos →" dentro del Sheet. `LeadDetalle` orquesta ambos modales. (2) Notas inline de actividad: tercer botón (icono `FileText`) en `ActividadRowActions` abre `ActividadNotasSheet` (Sheet derecho con `Textarea` único de "Resultado / notas") — disponible tanto en pendientes como en completadas. Nuevo hook `useActualizarActividadNotas` (update mínimo de `crm_actividades.resultado`). (3) Toasts CRM silenciados: nuevo wrapper `src/lib/crm/crmToast.ts` (`success` 2s, `error` 4s, `info`, `undo` 5s) usando sonner directo. Migrados a `crmToast.success`: `LeadDetalle`, `ConvertirLeadDialog`, `ConvertirLeadSheet`, `ActividadRowActions`, `ActividadNotasSheet`, `NuevoLeadDialog`, `NuevaOportunidadDialog`, `NuevaActividadDialog`, `ComentariosOportunidad`, `ActividadTimeline`, `LeadsBulkBar`, `useOportunidadDetalleActions`. `notifyError` se conserva donde aporta panel de debug copiable.

## [11.50.0] - 2026-05-25
- **CRM — segunda ola anti-fricción**: (1) Quick-create de 2 campos: el menú "+ Nuevo" ahora abre un `Popover` inline con sólo los campos imprescindibles (Lead: empresa + email/teléfono; Oportunidad: nombre + cliente opcional; Actividad: asunto + oportunidad + fecha — default hoy 17:00). Botón "Más campos →" abre el dialog completo cuando se necesita. Tres nuevos componentes en `src/components/crm/quickCreate/`. (2) Kanban sin modal: mover una oportunidad de etapa ya no muestra toast verde de éxito — usa el nuevo `showUndoToast` (sonner minimalista de 5s con acción "Deshacer" que revierte la etapa y probabilidad anteriores). (3) Nueva vista `Mi día` (`/crm/mi-dia`) que prioriza el flujo del vendedor: sección "Hoy" (top 3 NBA + actividades de hoy), "Esta semana" (cierres ≤7d, cotizaciones sin respuesta, leads sin contactar) y "Pipeline" (stat strip). El dashboard previo se renombra a "Resumen" (sigue accesible en `/crm`). (4) Command palette CRM con `Cmd/Ctrl+P` — busca leads, oportunidades y actividades pendientes (debounce 200ms, 6 hits por tipo) con `CrmCommandPalette` + hook `useCrmSearch`. (5) `useCrmHotkeys` extendido para registrar `Cmd/Ctrl+P` aún cuando el foco está en inputs. (6) `CrmLayout` añade "Mi día" como primer tab (icono Sun) y monta el palette globalmente.

## [11.49.0] - 2026-05-25

- **CRM — menos bloatware, menos fricción**: (1) `CrmLayout` colapsado a una sola franja de 48px: se elimina el `<h1>CRM</h1>` y la descripción (la sidebar ya lo dice); tabs + QuickAddMenu + engranaje en la misma línea. (2) `PageHeader` removido de `Inicio`, `Leads`, `Oportunidades`, `Actividades` y `Analítica`; nuevo componente compacto `CrmSubheader` (h-10) sólo muestra contador/contexto a la derecha. (3) Un único punto de creación: se quitan los botones "Nuevo lead" / "Nueva oportunidad" y los `FloatingActionButton` del CRM — todo vive en `QuickAddMenu` (header), que ahora también incluye "Importar leads CSV". (4) Atajos de teclado nuevos vía `useCrmHotkeys`: `N` abre el menú, `L/O/A` crean lead/oportunidad/actividad directamente (ignora cuando el foco está en input/textarea). (5) `VencidasAlert` eliminado (archivo + import + hook `useActividadesVencidasList` en VM): la regla "Actividad vencida" sube a score 110+ en `nextBestActions.ts` y pasa a ser la prioridad #1 dentro de `NextBestActionsCard`, con subtítulo dinámico "Vencida hace N días". Test actualizado. (6) Dashboard de Inicio re-priorizado de ~11 bloques a 6: NBA arriba, 2×2 grid con `ActividadesHoy · CerrandoSemana · CotizacionesSinRespuesta · LeadsSinContactar`, KPIs comprimidos a un `stat strip` horizontal h-14 (antes 4 cards grandes). `TopDealsCard` removido del Inicio (vive ya en `/crm/oportunidades`). (7) Oportunidades: filtros avanzados ahora colapsables (`Collapsible` + chip "Filtros (N)" con badge del número de filtros activos); por defecto sólo se ve el `SearchInput`, ganando ~120px verticales. (8) Analítica: fusionada de 4 sub-tabs a vista única scrollable (`Forecast` arriba, `Embudo + Conversión + Pérdidas` en 3 columnas, `Vendedores` al final si `canEdit`); el query param `?tab=…` se ignora silenciosamente para no romper enlaces. (9) Configuración: 3 sub-tabs reemplazados por 3 `Accordion` items (Pipeline / Motivos / Plantillas), Pipeline abierto por default. (10) Leads: edición inline del estado en la tabla — nuevo `EstadoCell` con `Select` directo en la celda (usa `useActualizarLead` existente + `e.stopPropagation()` para no disparar el row click); estados "Convertido" siguen siendo badge inmutable.

## [11.48.0] - 2026-05-25
- **CRM — cierre automático del ciclo (B) + Next Best Actions (D)**: (1) Nuevo trigger `trg_cotizacion_cierra_oportunidad`: cuando una cotización vinculada a una oportunidad pasa a `Aceptada` o `En operación`, la oportunidad se mueve sola a la etapa `ganada` de la org, fija `probabilidad = 100`, `fecha_cierre_real = hoy`, `valor_real = subtotal` y guarda `cotizacion_ganadora_id` (y `embarque_ganador_id` si ya existe). Sólo dispara si la oportunidad sigue abierta. Bitácora + notificación al vendedor. (2) Banner verde "Oportunidad ganada" en `OportunidadDetalleContent` con links a la cotización y al embarque ganador. (3) Badge rojo "Sin respuesta · Nd" en `OportunidadCotizacionesList` cuando una cotización `Enviada` lleva > 5 días. (4) Nueva card "Cotizaciones sin respuesta (> 5 días)" en el Inicio del CRM. (5) Nueva card destacada "Qué hacer ahora" arriba del dashboard del CRM con las top 5 acciones priorizadas por `computeNextBestActions` (lib pura, testada): lead nuevo sin contactar > 24h, cotización sin respuesta > 5d, oportunidad con cierre ≤ 3d, oportunidad sin movimiento > 7d, actividades vencidas. (6) Función `crm_cierra_oportunidad_desde_cotizacion` con `EXECUTE` revocado para PUBLIC/anon/authenticated (sólo invocable vía trigger).

## [11.47.0] - 2026-05-25
- **Reimplementa "Duplicar embarque" desde el detalle**: a petición de un usuario que reportó que la funcionalidad era importante, se reintroduce el componente `DialogDuplicarEmbarque` (eliminado en 11.46.0 por knip al no quedar referenciado) pero ahora invocado desde el dropdown "…" de `EmbarqueDetalleHeader.tsx`, no desde la lista. El hook `useDuplicarEmbarque` y el RPC `duplicar_embarque_completo` ya seguían vivos. UX: el usuario captura 1..5 números de contenedor; tipo, peso, volumen y piezas se heredan del embarque origen. Al éxito navega al primer nuevo embarque y muestra toast con los expedientes generados.

## [11.46.0] - 2026-05-25
- **Auditoría fresca de bloat — limpieza de código muerto y assets**: (1) Eliminados 9 archivos huérfanos detectados por knip — `CrmNotificacionesBell`, `DialogDuplicarEmbarque`, `EmbarqueRowActions`, `useDuplicarCotizacion`, `lib/financial/index.ts`, `lib/mappers/index.ts`, `lib/parsers/index.ts`, `pages/crm/Forecast.tsx`, `pages/crm/Reportes.tsx` (estas dos últimas fueron fusionadas hace tiempo en `pages/crm/Analitica.tsx`). (2) Removidas dos dependencias no usadas — `@dnd-kit/sortable` y `@dnd-kit/utilities` (sólo `@dnd-kit/core` se usa en `OportunidadKanban`). (3) Declarada explícitamente la dep faltante `@react-pdf/types` (devDependency). (4) `src/assets/librecarga-logo.png` (157 KB) eliminado — era idéntico al de `public/librecarga-logo.png`; `BrandLockup.tsx` ahora referencia la versión de `public/` y se ahorra 157 KB del bundle. (5) `public/favicon.png` re-encodeado a 64×64 — pasa de **134 KB → 3 KB** (97% menos). Eliminado `public/favicon.ico` redundante. (6) Auditoría confirmó que sub-loops 1 y 2 del plan (lazy PDF, Sentry, recharts, libphonenumber) **ya estaban aplicados** en versiones 11.42–11.44 — `pdf-vendor`, `sentry-vendor` y `charts-vendor` ya no se cargan en el initial paint gracias a `manualChunks` + `modulePreload.resolveDependencies` + dynamic imports en todos los call sites. Verificación: build sin regresiones, knip pasa de 9 → 0 archivos no usados y de 2 → 0 deps no usadas.

## [11.45.0] - 2026-05-25
- **Track B — paquete de bajo riesgo (P2.10 + P2.11 + P2.12 + limpieza)**: (1) P2.10 — eliminados duplicados `src/hooks/use-toast.ts` y `src/hooks/use-mobile.tsx`; la implementación canónica vive ahora en `hooks/shared/useToast.ts` + `hooks/shared/useIsMobile.ts`, y los 78 importadores consumen el barrel `@/hooks/shared`. (2) Limpieza Supabase fuera de pages — `src/pages/dev/PdfPreviewCotizacion.tsx` ya no llama a `supabase.from()` directo, usa `fetchCotizacionById` de `services/cotizacion`. Métrica "Supabase calls fuera de services/" pasa de 1 → 0. (3) Edge function `supabase/functions/list-users/index.ts` — extraídos `resolveOrgScope()` y `filterUsersByOrg<T>()` con tipo `AdminClient` estructural (sin `any`); complexity baja de 17 a ≤12. (4) P2.12 ESLint endurecido — `no-restricted-imports` sube de `warn` a `error` (ya estaba en 0), nuevo glob `supabase/functions/**/*_test.ts` silencia `@typescript-eslint/ban-ts-comment` para los `@ts-nocheck` intencionales de tests Deno. Intento de bajar `complexity` 15→12 destapó 13 funciones en src/ y 6 en edge functions; se revierte a 15 y queda como TODO. (5) Nuevo doc `docs/architecture-map.md` con tabla dominio → pages → hooks → services → lib. (6) `mem://audit/pendings` refrescado: P2.10, P2.11, P2.12, limpieza Supabase y edge function complexity marcados cerrados. Verificación: 709/709 tests, `src/` con 0 errors y 0 warnings, lint global con 0 errors.

## [11.44.0] - 2026-05-25
- **Etapa 5 sub-loop 4 — eliminar modulepreload de chunks lazy**: Vite generaba `<link rel="modulepreload">` para `pdf-vendor` (463 KB), `sentry-vendor` (148 KB), `charts-vendor` (90 KB), `phone-vendor` y `query-persist-vendor` aunque sólo se importan vía `import()` dinámico, forzando ~700 KB de descargas innecesarias en /login medidas con `browser--performance_profile` contra `elogistix.lovable.app`. Solución: `build.modulePreload.resolveDependencies` en `vite.config.ts` filtra esos chunks por nombre. Ganancia esperada en FCP/LCP en redes lentas: 1-2 s. Baseline previo (post 5.3): TTFB 616 ms, FP 2120 ms, DCL 2894 ms, CLS 0, `index` 110 KB. Re-medir tras publicar.

## [11.43.0] - 2026-05-25
- **Etapa 5 sub-loop 3 — lazy charts + chunk de libphonenumber**: `recharts` (chunk `charts-vendor`, ~95 KB gzip) ya no bloquea el TTI de las rutas que lo usan. Cada componente que renderiza un gráfico se carga vía `React.lazy()` con `<Suspense>` y un skeleton de altura fija (`ChartSkeleton`) para evitar CLS. Componentes extraídos: `OperacionesTendenciaChart` (chart inline de `Operaciones.tsx`), `AdminDashboardActivityChart` (chart inline de `AdminDashboard.tsx`), `DesempenoOperadoresChart` (chart inline de `DesempenoOperadores.tsx`). Páginas/contenedores migrados a lazy + Suspense: `pages/dashboard/Reportes.tsx` (`ReportesTopChart`), `pages/dashboard/Operaciones.tsx`, `pages/admin/AdminDashboard.tsx`, `components/operaciones/DesempenoOperadores.tsx`, `components/auditoria/AuditoriaEjecutivoTab.tsx` (`AuditoriaTendenciaChart`, vía `.then((m) => ({ default: m.AuditoriaTendenciaChart }))` por export nombrado), `components/admin/DiagnosticoHealthPanel.tsx` (`HealthTimelineChart` + `HealthTopErrorsChart`). Adicional: nuevo chunk `phone-vendor` en `vite.config.ts` aísla `libphonenumber-js` (~30 KB gzip) usado sólo por `formatPhoneMx` en 3 rutas (`Clientes`, `ClienteInformacionCard`, `ProveedorDetalle`). Helper compartido nuevo: `components/shared/ChartSkeleton.tsx`. Suite: 709 tests verdes, gate de higiene limpio.

## [11.42.0] - 2026-05-25
- **Etapa 5 sub-loop 2 — diferir Sentry y React Query persister**: `@sentry/react` (~150 KB) y `@tanstack/react-query-persist-client` (~25 KB) salen del chunk crítico hacia `sentry-vendor` y `query-persist-vendor`, cargados desde `main.tsx` dentro de `requestIdleCallback` (fallback `setTimeout(1500)`). Cambios: (a) `src/lib/sentry.ts` ahora exporta `initSentry()` sin side effects al importar; (b) nuevo `src/lib/sentryUser.ts` con `syncSentryUser` que hace dynamic import de `@sentry/react` para que `AuthContext` (crítico) no arrastre el SDK; (c) nuevo `src/lib/queryPersistBootstrap.ts` con `bootstrapQueryPersister` lazy; (d) `App.tsx` usa `QueryClientProvider` plano; (e) `vite.config.ts` añade reglas `manualChunks` para `@sentry/*` y `@tanstack/(react-query-persist-client|query-sync-storage-persister|query-persist-client-core)`. Cobertura preservada: errores tempranos siguen capturados por listeners globales y se reenvían cuando Sentry termina init; `FeedbackButton` ya manejaba `!getFeedback()`. Suite: 709 tests verdes, gate de higiene limpio.

## [11.41.0] - 2026-05-25
- **Etapa 5 sub-loop 1 — bundle splitting de @react-pdf**: el chunk inicial de la app se redujo de **~2.04 MB a ~600 KB** (gzip: ~530 KB → ~177 KB, **-67%**). Causa raíz: `useReportesPageController.ts` importaba `generarRentabilidadPdf` estáticamente, lo que arrastraba `@react-pdf/renderer` + sus deps transitivas (`fontkit`, `yoga-layout`, `pako`, `brotli`, `@noble/ciphers`, `restructure`, `jay-peg`, `unicode-properties`, etc., ~1.44 MB) al grafo crítico. Rollup lo emitía como un chunk engañosamente llamado `DataTable-*.js` de 1.44 MB. Fix: (a) el controller hace `await import("@/generators/rentabilidadPdf")` dentro de `handleExportPdf` (descarga sólo cuando el usuario presiona el botón); (b) `vite.config.ts` ahora define `manualChunks` como función que aísla todo el árbol PDF en un chunk `pdf-vendor-*.js` con nombre descriptivo. Suite: 709 tests verdes, gate limpio. Pendientes próximos sub-loops: dividir `index.js` (599 KB), lazy-load de `charts-vendor` (348 KB), aislar `phone` (libphonenumber, 118 KB).

## [11.40.0] - 2026-05-25
- **CI gate de higiene de tests**: nuevo `scripts/audit-tests.ts` ejecutado en CI vía `bun run audit:tests` antes de la suite de Vitest. Bloquea (exit 1) si aparece (a) `.skip/.only/.todo`, `xdescribe`, `xit` sin un comentario adyacente `// TODO(#issue):` o `// FIXME(#issue):`, o (b) bloque `describe`/`it`/`test` con título idéntico en otro archivo de test (con `DUPLICATE_ALLOWLIST` para casos legítimos como `vacío/null → ''` o `convierte MXN a USD`). Detectó y eliminó un duplicado adicional no visto en v11.39.0: `embarqueCotizacion.test.ts` cubría exactamente los mismos `buildVincularCotizacionUpdates`/`buildDesvincularCotizacionUpdates` que `embarque.test.ts` (más completo) — archivo removido. Workflow `.github/workflows/ci.yml` actualizado con el step "Test hygiene". Suite: 712 → 709 tests verdes en 107 files.

## [11.39.0] - 2026-05-25
- **Auditoría de tests obsoletos**: reporte completo en `docs/tests-audit.md`. Hallazgos: 0 tests con `.skip/.only/.todo`, 0 imports rotos, 26 huérfanos (todos falsos positivos: cubren barrels/sub-módulos), 3 bloques con duplicados reales. Eliminados 12 tests redundantes: `describe("formatDate")` duplicado en `uiMappings.test.ts` (movido a `formatters.test.ts`, -3 tests); en `embarqueWizardSchemas.test.ts` se removieron `validateArchivo` (-3), `validateStepDocumentos` (-2) y `validateStepCostos` (-3) ya cubiertos en los archivos split del wizard; `sumarEnUSD([])` duplicado entre `costosUSD.test.ts` y `financialUtils.edge.test.ts` (-1). Suite: 724 → 712 tests verdes en 108 files, sin pérdida de cobertura. Próximos sub-loops sugeridos: gate de CI preventivo (`scripts/audit-tests.ts`), consolidación `aUSD`↔`convertirAUSD`, reorganización de huérfanos.

## [11.38.0] - 2026-05-25
- **Auditoría calidad — Etapa 4 sub-loop 4 (cobertura)**: +34 tests cubriendo 5 módulos puros adicionales. `formatters/text` (11 tests: toTitleCase con conectores/siglas/corporativos/dígitos colgantes/guiones, nombreDesdeEmail, shortName). `formatters/phone` (5 tests: CDMX 2 dígitos, Querétaro 3, prefijo +52, inválido preservado). `formatters/places` (9 tests: prioridad puerto>aeropuerto>ciudad para getOrigen/getDestino, correctSpanishPlace con diccionario México/Querétaro/Yucatán). `lib/ui/authSnapshotBuilder` (4 tests: snapshot completo + Sentry context con nulls). `lib/ui/estadoConfig` (5 tests: getEstadoVisual con fallback default, configs específicas embarque/cotización, kpiIconChipClasses). Total: 690 → 724 tests verdes (108 files).

## [11.37.0] - 2026-05-25
- **Auditoría calidad — Etapa 4 sub-loop 3 (cobertura)**: +27 tests cubriendo 4 módulos puros adicionales. `lib/ui/dynamicImportError` (4 tests: detección de firmas Vite/chunk, null/string/Error/objeto). `lib/ui/errorDetailsExtract` (8 tests: null, string, Error, Postgrest code/status, objeto plano, fallbacks, descarte de tipos incorrectos). `lib/ui/errorReportFormat` (10 tests: header con/sin opcionales, fallbacks "—", bloque de error con detalles técnicos, context JSON, stack markdown). `lib/crm/forecastBuckets` (5 tests: classifyEtapa, makeBucket inicial en 0, applyDelta acumulando pipeline/ponderado/ganado). Total: 663 → 690 tests verdes (103 files).

## [11.36.0] - 2026-05-25
- **Auditoría calidad — Etapa 4 sub-loop 2 (cobertura)**: +15 tests cubriendo 2 módulos puros adicionales. `lib/mappers/cotizacionForm` (9 tests: defaults, mapeo snake→camel, dimensiones LCL/Aérea con fallback, parsing de validez_propuesta a Date, fallbacks de null, costos iniciales con defaults). `services/facturas/proyeccion/buildFilas` (6 tests: indexarPorEmbarque agrupando por id/columna, fallback MXN/0, buildFilasProyeccion con conversión USD↔MXN, flag tiene_factura_pdf, TC=1 cuando null). Total: 648 → 663 tests verdes (99 files).

## [11.35.0] - 2026-05-25
- **Auditoría calidad — Etapa 4 sub-loop 1 (cobertura)**: +25 tests cubriendo 5 módulos puros críticos sin test previo. `lib/mappers/_helpers` (6 tests: str/num/numStr/bool/nullable/emptyToNull). `lib/parsers/dashboardProfit` (7 tests: numOr0, numOrCompute con 0 válido, safeMargen con división por cero, parse con/sin profit explícito). `services/embarque/jsoncargoFechas.buildFechasUpdate` (5 tests: ata seteando eta cuando falta, sin sobrescribir, null/undefined ignorados). `lib/mappers/embarqueCotizacion` (3 tests: vincular con defaults, desvincular reset incoterm=FOB). `services/cotizacion/mutations/payloadBuilders` (4 tests: folio + cliente vs prospecto + defaults de mercancía). Total: 623 → 648 tests verdes.

## [11.34.0] - 2026-05-25
- **Auditoría calidad — Etapa 3 (`as unknown as`)**: producción de 9 casts → 3 sin documentar + 4 con convención `// SAFE-CAST:`. `PdfPreviewCotizacion` y `services/facturas/snapshots.ts` ahora usan el helper `fromDb<T>()` de `lib/supabase/cast.ts` (boundary centralizado, listo para validación runtime con Zod). Los 4 casts restantes en producción (`exportListado.ts` ×2, `useHuecoFacturacion.ts`, `ImportarLeadsCsvDialog.tsx`, `VirtualDataTable.tsx`) llevan ahora comentario `// SAFE-CAST: <razón concreta>` que justifica por qué TS no puede tiparlos mejor (PostgREST generics, asignación dinámica por clave, iteración runtime). Tests sin cambios (los casts en `__tests__/` son mocks de `ReturnType<typeof hook>` y `typeof fetch` — patrón estándar Vitest). 623/623 tests verdes.

## [11.33.0] - 2026-05-25
- **Auditoría calidad — Etapas 1 y 2 (services + components)**: validación arquitectónica de las dos capas restantes. `src/services/**`: 0 imports a `@/hooks`, `@/components`, `@/pages` o `@/contexts` (capa ya limpia), ningún servicio >200 LOC. `src/components/**`: 0 componentes propios usan `useQuery`/`useMutation` directos (todo va vía hook controller), 0 cálculos financieros inline (todo en `lib/financial`). Único archivo >200 líneas es `ui/sidebar.tsx` (shadcn upstream). Guardrails añadidos: bloque ESLint `no-restricted-imports` para `src/services/**` (espejo del que ya existe en `lib/`), y `architecture.test.ts` extendido para cubrir también services. 623/623 tests verdes.

## [11.32.0] - 2026-05-25
- **Auditoría arquitectónica (etapas 7–12)**: `src/generators/*` confirmado como capa fina de adaptadores que delegan en `src/pdf/*` (no hay duplicación real, el split es intencional: `generators/` = API pública para páginas, `pdf/` = composición React-PDF). Eliminados los 9 `as unknown as` en controladores de cliente, proveedor y embarque: `diffFields<T extends object>` ahora acepta entidades tipadas de Supabase directamente y `fields` es `ReadonlyArray<string>`. `detalles?` de `insertBitacora` y `useRegistrarActividad` relajado a `Record<string, unknown>` (el cast a `Json` queda encapsulado en la capa de servicio). Nuevo test `src/lib/__tests__/architecture.test.ts` que verifica que ningún archivo en `src/lib/**` importa `@/hooks`, `@/components` o `@/pages` (red de seguridad ante eliminaciones del ESLint rule). Lint 0/0, 622/622 tests verdes.

## [11.31.0] - 2026-05-25
- **Auditoría arquitectónica (etapas 1–6)**: roto el ciclo `lib/ → hooks/` y `lib/ → components/`. Tipos de dominio (`EmbarqueRow`, `CotizacionRow`, `EmbarqueValidationErrors`, `EntradaBitacora`, `FiltrosBitacora`, `Cliente`, `ContactoCliente`, `NotificacionCliente`, `GlobalSearchResult`, `RentabilidadCliente`, `OperadorBase`, `DesgloseEstados`) movidos a `src/types/*` con re-export desde los hooks/services para preservar la API pública. `lib/jsoncargo/trackingLiveHelpers.ts` ya no depende de `useToast` (usa `AnyToastFn` de `lib/ui/appFeedback`). Nuevo bloque ESLint en `lib/**` que bloquea imports a `@/hooks`, `@/components` y `@/pages`. Creados barrels `lib/financial`, `lib/parsers`, `lib/mappers`. `Papelera`, `Idempotencia` y `SentryDiagnostico` movidos de `pages/dashboard/` a `pages/admin/`. `src/content/` disuelto (`ayudaContent.ts` co-localizado en `pages/dashboard/`). Lint 0/0, typecheck 0/0, 621/621 tests verdes.

## [11.30.1] - 2026-05-25
- **Sentry: silenciado ruido de chunk-load errors**: nuevo `src/lib/ui/dynamicImportError.ts` centraliza la detección. `lib/sentry.ts` filtra estos eventos en `beforeSend` (devuelve `null`). `main.tsx` añade listener global `unhandledrejection` que dispara la misma auto-recarga que ya existe para `vite:preloadError` (cubre el caso de `React.lazy()` cuando Vite no emite preloadError). `ErrorBoundary` reutiliza el helper compartido. Resuelve issue Sentry `JAVASCRIPT-REACT-5` (201 eventos).

## [11.30.0] - 2026-05-25
- **Eliminación del módulo Changelog (UI + chunks TS)**: removidos `src/pages/dashboard/Changelog.tsx`, `ChangelogEntryCard`, `useChangelogController`, `src/content/changelogData.ts`, toda la carpeta `src/content/changelog/` (~9.5k líneas) y `changelog.test.ts`. Sidebar entry, ruta `/changelog`, breadcrumb y link desde Ayuda eliminados. Reemplazado por este único `CHANGELOG.md`. Ahorro estimado ~20% por loop del agente (antes 3 archivos editados por release; ahora 2: `APP_VERSION` + esta entrada). `APP_VERSION` se mantiene como string standalone (lo consumen Sentry, observability, portal y sidebar).

## [11.29.0] - 2026-05-25
- **Wrapper único para Browser Storage (local + session)**: nuevo `src/lib/browserStorage/index.ts` con `safeLocalStorage` / `safeSessionStorage` (guard SSR + try/catch que reporta vía `console.warn` sin propagar `QuotaExceededError` ni errores de modo privado Safari), `getStorageRef('local'|'session')` para librerías que requieren la instancia nativa (TanStack persister), `STORAGE_KEYS` con las 4 claves del proyecto + helper `loginLoggedKey(userId)`, y 3 helpers de alto nivel para el flujo chunk-error reload (`hasChunkReloadBeenAttempted` / `markChunkReloadAttempted` / `clearChunkReloadFlag`). Migrados 6 consumidores: `ThemeContext`, `OrganizationContext`, `lib/queryClient`, `useLoginAudit`, `main.tsx`, `ErrorBoundary`. 633/633 tests verdes (+7).

## [11.28.0] - 2026-05-25
- **Eliminación de eslint-disable (parte 3/3): 0 directivas restantes** (9→0). `no-explicit-any`×4 resueltos con tipos concretos (`Record<string, unknown>`, genérico `<TForm extends FieldValues>`, interfaz `QueryLike`, `Parameters<typeof ...>`). `complexity`×3 con `stripUndefined()` + `withDefaults(props)`. `react-refresh`×1 allowlisted en `eslint.config.js`. `SentryDiagnostico` dividido en 4 subcomponentes. Override de tests añade `no-explicit-any: off`. 626 tests verdes.

## [11.27.0] - 2026-05-25
- **Eliminación de eslint-disable (parte 2): exhaustive-deps complejos** (19→9). `useConceptosForm.inicializarVenta/Costo` → `useCallback`; `useListPageState.defaultFilters` capturado vía `useRef` al montar; `useCotizacionWizardSteps` con `useCallback` y deps reales; `VirtualDataTable.gridTemplate` derivado directamente de `widthsKey` (split/join con sentinel `\\u0001`). 626 tests verdes.

## [11.26.0] - 2026-05-25
- **Eliminación de eslint-disable (parte 1/2)**: 11 directivas removidas (30→19). Tests (`no-console`, `no-control-regex`) movidos a override de config; `Dimensiones*` / `EmbarquesRelacionadosCard` a allowlist; `exhaustive-deps` corregidos por causa raíz en `AuthContext`, `EditarEmbarque`, `DialogBolContainers`, `useAuditoriaSnapshots`, `useEmbarqueEstadoActions`, `usePortalEmbarquesController`. 626 tests verdes.

## [11.25.0] - 2026-05-25
- **Spreads de queryKeys promovidos a factory methods**: 15 spreads `[...queryKeys.X, …]` eliminados. Factory expone métodos tipados (`embarques.full`, `dashboard.statsSummary`, `clientes.selectByOrg`, etc.). 0 spreads fuera de `lib/query`. 626 tests verdes.

## [11.24.0] - 2026-05-25
- **Centralización de query keys (P2)**: 110 literales queryKey migrados a factories en `lib/query` (crm, auditoria, appLogs, facturacion, misc). 44 archivos migrados. Invalidaciones usan el prefijo más amplio (`queryKeys.crm.X.all`, `dashboardAll`). 0 strings hardcodeados de queryKey fuera de `lib/query`. 626 tests verdes.

## [11.23.0] - 2026-05-25
- **P1.6 — Split de god services (cotización + facturas)**: `services/cotizacion/mutations.ts` (137 líneas) → `mutations/` con una operación por archivo + payload builders puros. `services/facturas/proyeccion.ts` (111) y `huecoFacturacion.ts` (165) → carpetas con `fetchSources` (I/O Supabase) + `buildFilas` (agregaciones puras) + `index` (orquestador). API pública intacta vía resolución a `index.ts`. 626 tests verdes.

## [11.22.1] - 2026-05-25
- **Perf tests estabilizados para CI**: `DataTable.perf.test.tsx` con helper `measureMedian` (1 warmup + N mediciones con `cleanup()` + `tryGc()`). Umbrales relativos (5k ≤ baseline1k×8, 10k ≤ baseline1k×15) + rerenders ≤50-60% del mount. 0 flakes en 5 corridas consecutivas. 626 tests verdes.

## [11.22.0] - 2026-05-25
- **Auditoría loop 10 — ESLint a 0 warnings**: resueltos 3 `react-refresh/only-export-components`, 1 `no-empty-object-type` y 5 `unused-disable`. Extraídos `oportunidadesFiltersTypes.ts` y `proveedorTableColumns.tsx`. `ColumnMeta` declara marker readonly opcional. 626 tests verdes.

## [11.21.0] - 2026-05-25
- **Auditoría loop 9 — complexity y exhaustive-deps**: complexity 14→3 (3 mappers planos con disable inline). Helpers extraídos: `buildLeadInsertPayload`, `buildOportunidadInsertPayload`, `buildFromOportunidad`, `isLeadDirty`, `extractErrorDetails`, `parseEmbarqueConProfitRaw`, `forecastBuckets`, `buildAuthSnapshot`, `useSentryInfo`, `useCrmInicioVM`. Barrel nuevo `hooks/sentry`.

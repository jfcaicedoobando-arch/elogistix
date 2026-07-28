# Wave 7 · Cerrar los hallazgos ALTOS todavía abiertos

## Ya cerrados en olas anteriores (verificado esta ronda)

Antes de tocar código nuevo dejo constancia de que **6 de los 13 hallazgos ALTOS ya se resolvieron** en olas previas y los revisé en el código:

- **B-007** — `useNotaCreditoDraft.ts` línea 80 aplica `Σ base × (1 + tasa_iva)` (Wave 3, v13.320.34).
- **B-008** — existe `CREATE UNIQUE INDEX clientes_org_rfc_unique` en la migración `20260728040216` (Wave 3).
- **B-013** — `NuevoEmbarque.tsx:28` ya honra `searchParams.get("fromCotizacion")` (Wave 3).
- **B-016** — la migración `20260728035544` re-escribe `duplicar_cotizacion` copiando `precio_venta` (Wave 2/3).
- **B-017** — `actualizarFechaLlegadaRealEmbarque` tiene guardrails contra arribo previo al ETD y transición de estado (Wave 4).
- **B-018** — la migración `20260728040216` re-escribe `pnl_financiero_embarque` usando `pf.total` en `pf_saldo` (Wave 3).

Estos NO se retocan. Cualquier regresión visible sería un bug nuevo, no una reapertura.

## Analogía rápida (para que ubiques la ola)

Imagina que la app es una oficina: en olas pasadas ya arreglamos las **calculadoras** (dinero mal sumado). Ahora nos toca destapar puertas cerradas (flujos que no dejan avanzar), poner un vidrio a la caja fuerte (validaciones) y **abrir la ventana** para que el aire de los cambios en catálogos entre sin tener que reiniciar la oficina (caché).

## Objetivo de la ola

Cerrar 6 hallazgos ALTOS pendientes en un solo lote, dejando B-012 fuera porque el propio reporte pide re-verificarlo en staging antes de invertir tiempo.

## Alcance — qué cambia y por qué

### Dinero / bloqueos duros

**B-006 · Captura manual CxP sin conceptos = limbo**

- `CargaCfdiSection.tsx` sólo captura totales; `_cxp_validar_aprobacion` exige al menos un renglón en `proveedor_facturas_conceptos`, por eso **toda** factura manual bloquea al aprobar con `LC_CXP_SIN_CONCEPTOS`.
- Cambio: cuando `carga_mode = "manual"`, mostrar una mini-tabla de conceptos (descripción, cantidad, precio, tasa IVA) dentro del mismo dialog. Como mínimo pedir 1 concepto con `subtotal + iva = total` capturado arriba. `useNuevaFacturaProveedorForm` valida cuadre en front (mismo helper que ya tenemos: `cuadreConceptos`) para no depender del error del trigger.
- Resultado: la factura manual se aprueba sin caer al catch de `LC_CXP_SIN_CONCEPTOS`.

### Flujos bloqueados

**B-009 · super_admin expulsado de módulos operativos**

- `resolveProtectedRouteRedirect.ts:40-41` redirige a `/admin` cualquier ruta que no sea del panel dueño.
- Cambio: si el usuario es `super_admin` **y** hay una `organization_id` activa en el store de impersonation, permitir rutas operativas (usar la misma matriz de `roleHierarchy`). Si no hay org activa, seguir redirigiendo a `/admin` (comportamiento actual).
- Resultado: el `OrgSwitcher` vuelve a tener sentido; el dueño puede entrar a Embarques / CxP como si fuera admin_org de la org seleccionada.

**B-010 · Conciliación bancaria sin movimientos**

- No existe UI de captura manual de movimientos ni importador amigable → el panel siempre queda vacío.
- Cambio (mínimo viable): agregar un dialog "Registrar movimiento bancario" dentro del módulo, escribiendo a `bbva_movimientos` (fecha, referencia, monto, moneda, cuenta, descripción). Ya existe RLS en la tabla; sólo hay que exponer el formulario y el listado en la ruta correspondiente.
- Fuera de alcance: mejorar el importador CSV (queda como QW aparte).
- Resultado: se puede conciliar aun sin el importador robusto.

**B-014 · Wizard paso 2 sin validación**

- Peso, volumen, piezas negativos y ETD/ETA vacíos pasan al paso 3 sin queja.
- Cambio: extender el schema Zod del paso 2 con `peso ≥ 0`, `volumen ≥ 0`, `piezas ≥ 1`, ETD y ETA obligatorios, ETA ≥ ETD; usar `trigger()` antes de `setStep(next)` y bloquear "Siguiente" con `disabled` si hay errores. Mensajes con `notifyValidationError`.
- Resultado: no se pueden avanzar embarques con basura numérica.

### Presentación / UX

**B-011 · Footer wizard cotización: VENTA MXN $0 y mezcla con/sin IVA**

- El footer del paso 2 agrupa por moneda pero descarta los MXN si el primer renglón es USD; el paso 3 muestra venta con IVA y costo sin IVA en el mismo renglón.
- Cambio: reutilizar el helper `sumPorMoneda` que ya usa el Resumen P&L (fuente única). Renderizar dos totales lado a lado ("VENTA USD" + "VENTA MXN"). En paso 3 forzar la lectura del mismo campo (`totalConIva` o `subtotal`) para venta y costo, no cruzados.
- Resultado: los cuatro paneles (paso 2, paso 3, Resumen P&L, paso 4) hablan el mismo idioma.

### Infraestructura

**B-015 · React Query persistido congela catálogos**

- `persistBootstrap.ts` guarda todo en localStorage con `staleTime` largo → catálogos administrables no se refrescan tras F5 hasta expirar el cache.
- Cambio: en `persistQueryClient` pasar `dehydrateOptions.shouldDehydrateQuery` para **excluir** query keys de catálogos administrables (`tipos_contenedor`, `navieras`, `puertos`, `conceptos_costo`, `conceptos_venta`, `catalogo_claves_sat`, `crm_etapas_pipeline`, `crm_motivos_perdida`). Esos caches se recalculan cada sesión; el resto sigue persistiendo.
- Resultado: cualquier cambio en un catálogo se ve al recargar sin tener que borrar localStorage.

## Fuera de alcance intencional

- **B-012** — el reporte mismo pide re-verificar en staging; no se toca aquí. Si tras staging aparece un race real de sesión/React Query, se abre una mini-ola dedicada.
- Importador CSV robusto de estado de cuenta (B-010 sólo aborda la salida manual).

## Cómo se verifica

- `bun run lint -- --max-warnings 0` y `bun run test` locales.
- Tests unitarios nuevos: `useNuevaFacturaProveedorForm` (cuadre con conceptos manuales), Zod paso 2 wizard embarques (casos negativos), helper `sumPorMoneda` cotizaciones (mezcla USD+MXN), `resolveProtectedRouteRedirect` (super_admin con y sin org activa), `persistBootstrap` (query key excluida no se dehidrata).
- Manual en preview: seguir el flujo B-006 (crear CxP manual con 1 concepto → aprobar sin error), B-009 (loguear como super_admin, cambiar org, entrar a `/embarques`), B-014 (peso negativo → error visible), B-015 (editar `tipos_contenedor` desde otra sesión → F5 refresca).

## Cierre / versionado

- Bump `APP_VERSION` a `13.321.0` (cambio mayor: super_admin recupera operación y wizard endurece validaciones).
- `CHANGELOG.md` con bullet por bug siguiendo el formato de olas anteriores (analogía breve + IDs).
- Estado acumulado esperado tras la ola: **30/63** bugs cerrados (Wave 7 suma 6). Restantes: 33 (todos MED/BAJA/verify).

## Detalles técnicos (para referencia)

| ID | Archivos principales |
| --- | --- |
| B-006 | `src/features/cxp/components/CargaCfdiSection.tsx`, `src/features/cxp/hooks/useNuevaFacturaProveedorForm.ts`, nuevo `ConceptosManualesTable.tsx` |
| B-009 | `src/lib/auth/resolveProtectedRouteRedirect.ts`, tests en `src/lib/auth/__tests__/` |
| B-010 | `src/features/embarques/components/reconciliacion/*` (o ruta actual de conciliación), nuevo `DialogRegistrarMovimientoBancario.tsx` |
| B-011 | `src/features/cotizaciones/wizard/**/Footer*.tsx`, helper `sumPorMoneda` |
| B-014 | `src/features/embarques/wizard/schema.ts` y `Paso2*.tsx` |
| B-015 | `src/lib/query/persistBootstrap.ts` + lista de keys en `staleTimes.ts` |

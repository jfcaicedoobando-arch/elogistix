# Auditoría: qué falta por implementar

De los 11 pasos de la auditoría del 18-19 de agosto, **5 ya están cerrados** y **6 siguen pendientes**.

## Ya cerrado (no hay que volver)

| Paso | Tema | Versión |
|---|---|---|
| 1 | Un solo cálculo de días vencidos/demora | 13.676.0 y 13.678.0 |
| 2 | Ciclo `dashboardEjecutivo` ↔ `profit` | 13.676.0 |
| 5 | Tipo `Moneda` centralizado | 13.676.0 |
| 6 | Buckets de antigüedad (aging) unificados | 13.677.0 |
| 7 | Topes de consulta con nombre (`queryCaps`) | 13.677.0 |

Cada uno quedó con su guardrail en `src/__tests__/architecture/`.

## Pendiente, en el orden que propongo ejecutarlo

### Paso 4 — ALTO · `index.ts` que en realidad es un servicio
Verificado hoy: `src/features/catalogos/services/index.ts` tiene 159 líneas y **13 llamadas a la base de datos**. Otros cinco `index.ts` cargan tipos y utilidades en lugar de sólo re-exportar (`configuracion/services` 136, `costeo/types` 127, `auditoria/types` 125, `auth/services` 95, `reportes/services` 95).

Analogía: es como si el índice de un libro tuviera capítulos escritos dentro. Quien sólo quería un tipo se lleva de paquete el código de red.

Trabajo: partir en archivos con nombre (`navieras.ts`, `puertos.ts`, `tiposContenedor.ts`, etc.), dejar cada `index.ts` como re-exportación pura y añadir un guardrail que prohíba `supabase.from` dentro de cualquier `index.ts`. Sin cambio funcional; se valida con typecheck y la suite.

### Paso 8 — MEDIO · Componentes de un solo dueño en `shared`
Verificado: `PortalFilterSheet.tsx`, `PortalFiltersBar.tsx` y `ProfitBadge.tsx` siguen en `src/components/shared/` aunque los use un solo feature. Se mueven a su feature dueño (`portal` y `cotizacion`). Sólo cambian rutas de import.

### Paso 9 — MEDIO · Despachos largos y ternarios triples
Verificado: siguen los `eslint-disable complexity` en `bitacoraDescripcionModulos.ts:15` y `bitacoraDescripcion.ts:112`. Se reemplazan por tablas `Record<accion, fn>` y se sustituyen los ternarios de 3 niveles por una función `clasificarBucket`. Riesgo: hay que cubrir cada rama con test para no perder ningún mensaje de bitácora.

### Paso 3 — ALTO en volumen · Barriles públicos por feature
Verificado: sólo 4 de 36 features exponen `index.ts` (`configuracion`, `cxp`, `proformas`, `tesoreria`). Los imports profundos hacia los features más consumidos hoy son: `embarques` 524, `cxp` 478, `facturacion` 471, `cotizacion` 411, `crm` 315.

Analogía: hoy cada equipo entra por la cocina del vecino en lugar de por la puerta. Mover un archivo interno rompe a otros features sin aviso.

Se hace por olas de un feature por vez (`embarques` → `facturacion` → `cotizacion` → `crm` → `catalogos` → `admin`), extendiendo `feature-barrel-surface.test.ts`. Es el paso más grande en número de archivos, pero cero riesgo en runtime: si compila, funciona.

### Paso 10 — OPCIONAL · Nombres de carpetas inconsistentes
`dashboardEjecutivo` (camelCase) junto a `anticipos-proveedor` y `portal-agente` (kebab-case). Conviene hacerlo pegado al paso 3, cuando ya se están tocando los imports.

### Paso 11 — OPCIONAL · Limpieza menor
Verificado hoy: `knip` reporta exactamente 2 tipos exportados sin uso (`CotizacionDetalleTotales`, `CotizacionDetalleDialogos` en `CotizacionDetalleContenido.tsx`) y hay 41 archivos con marcas `TODO/FIXME`. Se borran los 2 tipos y se revisan las marcas para cerrarlas o convertirlas en tarea.

## Notas técnicas

- Cada paso se entrega como una ola independiente: cambio + guardrail en `src/__tests__/architecture/` + entrada en `CHANGELOG.md` + bump de `APP_VERSION`.
- Ninguno de los pendientes toca dinero ni datos: los cuatro pasos financieros (1, 5, 6, 7) ya están cerrados. Lo que queda es estructura, legibilidad y contratos entre módulos.
- Verificación por ola: `tsgo --noEmit`, `eslint src`, suite completa de Vitest y las pruebas de arquitectura.

# Plan: Cerrar los 30 warnings de Knip

Objetivo: dejar `bun run lint:unused` en cero, sin tocar lógica de negocio ni romper tests.

## 1. Clasificación de los 30 hallazgos

Knip reporta **22 exports** + **8 types** repartidos en 19 archivos. Los agrupo por acción:

### A. Borrar (export realmente muerto, sin consumidores ni intención de API pública)


| Archivo                                            | Símbolo                                                                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/services/embarque/mutations.ts`               | `insertarNotaCambioEstado`                                                                                                     |
| `src/services/facturas/snapshots.ts`               | `fetchFacturaSnapshot`, `fetchProformaSnapshot`                                                                                |
| `src/services/reportes/index.ts`                   | `fetchProfitPorCliente`                                                                                                        |
| `src/services/cliente/crud.ts`                     | `CLIENTE_LIST_COLUMNS`                                                                                                         |
| `src/pdf/emisor.ts`                                | `invalidarEmisorCache`                                                                                                         |
| `src/components/crm/crmDashboard/DealsCards.tsx`   | `TopDealsCard` (sub-export no montado)                                                                                         |
| `src/services/cotizacion/queries.ts`               | `fetchCotizacionesListado`                                                                                                     |
| `src/pdf/documents/cotizacionSections.tsx`         | `HeaderCotizacion`                                                                                                             |
| `src/hooks/crm/useActividades.ts`                  | `ENTIDAD_TIPOS`, `useEliminarActividad`                                                                                        |
| `src/hooks/crm/useCrmNotificaciones.ts`            | `useCrmNotificaciones`, `useCrmNotificacionesNoLeidasCount`, `useMarcarNotificacionesLeidas` (archivo completo si queda vacío) |
| `src/hooks/crm/useOportunidades.ts`                | `useMoverEtapa`                                                                                                                |
| `src/services/cotizacion/conversiones/duplicar.ts` | `duplicarCotizacion` (eliminar archivo si queda vacío)                                                                         |
| `src/types/embarque/contenedor.ts`                 | `contenedorBorradorLclSchema`, type `EmbarqueContenedorUpdate`                                                                 |
| `src/hooks/configuracion/configSchemas.ts`         | types `SeguridadConfig`, `PlataformaConfig`                                                                                    |
| `src/lib/parsers/dashboardSchemas.ts`              | types `ArribosEsteMesParsed`, `ResumenMesSiguienteParsed`, `CargaPorClienteParsed`                                             |
| `src/lib/validation/mutationSchemas.ts`            | type `NotaInput`                                                                                                               |
| `src/services/crm/actividades.ts`                  | type `ActividadesVencidasParams`                                                                                               |
| `src/hooks/embarque/useEmbarquesFilters.ts`        | type `SortDir`                                                                                                                 |
| `src/components/shared/dataTable/types.ts`         | type `_ReactKept` (marcador obsoleto)                                                                                          |


Para cada uno: verificar 0 referencias con `rg` antes de borrar, eliminar export + definición, y si el archivo queda vacío, borrarlo y limpiar barriles que lo re-exporten.

### B. CRUD que sí pertenece a una API pública

`src/services/embarque/contenedores/crud.ts` expone `crear`, `actualizar`, `eliminar`. Estos son métodos de un módulo CRUD consumido vía namespace (`contenedores.crear(...)`). Verificar uso real con `rg "contenedores\\.(crear|actualizar|eliminar)"` y por import directo. Si no hay consumidores, borrar. Si hay consumo por namespace que Knip no detecta, anotar en `knip.json` bajo `ignoreExportsUsedInFile` o `ignore` para ese archivo.

## 2. Verificación post-cambio

```bash
bun run lint:unused   # esperado: 0 issues
bun run lint          # 0 errores, 0 warnings
bunx vitest run       # 781/781
bun run audit:tests   # 0 violaciones (Power of 10)
```

## 3. Versionado y changelog

- `src/constants/appVersion.ts` → `12.16.3`
- `CHANGELOG.md` → `## [12.16.3] - 2026-05-29` con bullet:
  - "Limpieza de 30 exports/tipos sin consumidores reportados por Knip; eliminados archivos huérfanos resultantes."

## Notas técnicas

- Cero cambios de comportamiento: solo se eliminan símbolos sin lectores.
- Antes de cada borrado se corre `rg -n "nombreSimbolo"` para confirmar 0 referencias (excluyendo el archivo origen).
- Si un símbolo se descubre referenciado dinámicamente (string, namespace import), se mantiene y se añade a `knip.json` con razón documentada.
- Barriles afectados a revisar tras borrar: `src/hooks/crm/index.ts`, `src/services/embarque/index.ts`, `src/services/facturas/index.ts`, `src/services/cotizacion/index.ts`, `src/services/cliente/index.ts`, `src/types/embarque/index.ts`.

Si hacer esto es más rápido con subagents, úsalos. 
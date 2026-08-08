# Verificación del archivo "Hotfix R9" antes de cambiar nada

El archivo se auditó contra la versión `13.454.1`. Hoy vamos en `13.457.2`, y **la mayoría de sus hallazgos ya no aplican**. Verifiqué uno por uno contra la base de datos real y el código actual (sólo lecturas, sin cambios).

## Resultado de la verificación

### P0 (los "3 bloqueantes"): ninguno se reproduce

| Hallazgo | Realidad verificada |
| --- | --- |
| P0-A: `_bitacora_facturas_estado` usa `NEW.folio_completo` | Falso hoy. La función ya no contiene ninguna referencia a `folio_completo` (0 coincidencias en su definición). Se corrigió en `13.455.1`. |
| P0-B1: falta la FK `conceptos_venta.proforma_id → proformas.id` | Falso. La FK existe (`conceptos_venta_proforma_id_fkey`), por eso el embed `proformas(...)` de `fetchSources.ts` funciona. |
| P0-B2: consulta legacy usa `facturas.archivo_pdf_url` | Falso. Ese nombre de columna no existe en `facturas` (la real es `factura_pdf_url`) y **ningún archivo del frontend la consulta**; las coincidencias son de otra tabla (`proveedor_notas_credito`) y de migraciones viejas. |
| P0-C: borradores con expediente NULL visibles en portal | No reproducible: hay **0 embarques en Borrador con expediente nulo**. El portal filtra por estados visibles y no incluye Borrador. |

### P1/P2: mezcla de "ya resuelto" y "no verificable desde el código"

Ya implementado (contradice el archivo):
- **Cobros CxC por GUI**: existe `DialogRegistrarPago`, `FacturaPagosSection`, `usePagosFactura` y 102 pagos registrados en la base. La ruta `/cobros` no existe **pero tampoco hay ningún enlace a ella**, así que no hay 404 que arreglar.
- **Folios por organización**: `folio_secuencias` ya opera con `organization_id` en el UPSERT; **0 folios de cotización compartidos entre dos organizaciones** hoy.
- **Aging CxP y CxC por moneda**: `cxp_aging_proveedores` devuelve una fila por (proveedor, moneda) y `cobranza.ts` trae `moneda` + `tipo_cambio`. No hay suma de USD como MXN en esos servicios.
- **Eventos de tracking**: existe `TrackingNuevoEventoForm.tsx`.
- **Alta de cliente sin CSF**: el controlador ya soporta modo `manual` (CSF opcional).
- **"Enviar proforma" vs "Duplicar"**: los handlers son distintos y correctos en `NuevaCotizacion.tsx`.
- **Inputs numéricos del wizard (peso/volumen/piezas)**: usan `register()` de RHF con string crudo, no `Number()` en `onChange`; no hay el patrón que el archivo culpa.

Conclusión: la fuente no es confiable — parece describir un estado del proyecto de varias semanas atrás y, en varios puntos, inventa causas técnicas (columna inexistente, FK ausente) que la base contradice.

## Qué propongo hacer

**No aplicar el plan R9.** En su lugar, un ciclo corto y honesto:

1. **Cerrar el archivo como obsoleto**: dejar constancia en `CHANGELOG.md` de que R9 se auditó y se descartó, con el detalle de lo verificado (sin bump de versión, no hay cambio funcional).
2. **Reproducir por GUI sólo los 6 puntos que el código no puede confirmar ni negar** (son de comportamiento en vivo, no de schema), con Playwright y sesión real:
   - Cartera CxC: etiqueta "Vence hoy 0 d" / posible off-by-one de días.
   - Cotizaciones Vencidas ausentes de la lista "Todos" y de la búsqueda.
   - Skeleton persistente en `/profit/dashboard` y en el chart de flujo de caja de `/tesoreria`.
   - Portal del agente: botones "Nueva tarifa" / "Duplicar" / "Crear condiciones" (¿RLS o handler vacío?).
   - Modal "Nueva factura manual" que se cierra y pierde captura.
   - Filas de costo en MXN "congeladas" tras restaurar borrador en el wizard de cotización.
3. **Reportar hallazgos reales** de ese paso 2 y sólo entonces proponer un plan de corrección con migración/frontend según lo que realmente falle.

## Detalles técnicos de la verificación

- Consultas de lectura a `pg_proc`, `pg_constraint`, `information_schema.columns`, `cotizaciones`, `pagos_factura`, `embarques`.
- Búsquedas en código: `archivo_pdf_url`, embeds `proformas(...)`, rutas `/cobros`, `folio_secuencias`, `cxpAging.ts`, `cobranza.ts`, `BloqueMercancia.tsx`, `useNuevoClienteController.ts`, `NuevaCotizacion.tsx`.
- Ningún archivo del proyecto fue modificado durante la verificación.

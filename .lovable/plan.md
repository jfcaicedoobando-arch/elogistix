# Reordenar el checklist de cierre por ciclo de vida del embarque

Hoy el checklist se muestra en el orden que devuelve la base de datos, así que un usuario ve mezcladas reglas de operación (contenedores, documentos) con reglas de contabilidad (REP, comisiones). La idea es agruparlo y ordenarlo igual que se vive un embarque: primero lo operativo, luego lo documental, luego la facturación, después la cobranza y el pago, y al final la rentabilidad.

## Orden propuesto

**1. Operación (Coordinador / Operador)**
- Datos de contenedores capturados (peso y volumen)
- Fechas de descarga y devolución capturadas

**2. Expediente documental (Coordinador logístico)**
- Documentos requeridos completos

**3. Costos y facturas de proveedor (Auxiliar contable / Operador)**
- Invoices del buzón capturados
- Evidencia de factura recibida por proveedor
- Todos los costos tienen factura de proveedor recibida

**4. Facturación al cliente (Contador)**
- Todos los conceptos de venta facturados
- Complementos de Pago (REP) timbrados

**5. Cobranza y pagos (Cobranza / Tesorero)**
- Cuentas por cobrar al día
- Cuentas por pagar al día

**6. Rentabilidad y comisiones (Ventas / Sistema)**
- Utilidad / margen mínimo alcanzado
- Comisión devengada calculada
- Comisiones devengadas definitivas

## Cambios visuales

- Cada grupo se muestra con un encabezado pequeño ("1. Operación", etc.) dentro de la misma tarjeta del checklist.
- Junto al encabezado, un contador tipo `2/2` para ver de un golpe qué fase ya está lista.
- Los grupos sin reglas aplicables simplemente no se muestran.
- Se conserva todo lo demás: iconos, badge de responsable, badge Pendiente/OK, enlace de drilldown y el modo informativo para embarques cerrados.

## Detalle técnico

- `src/features/embarques/utils/cierreCheckMeta.ts`: agregar a `CierreCheckMeta` los campos `fase` (id de fase) y `orden` (número dentro de la fase); definir la constante `FASES_CIERRE` con id, número y título. El fallback queda en una fase final "Otros" para reglas nuevas que aún no tengan metadatos.
- Nuevo `src/features/embarques/utils/cierreCheckOrden.ts`: función pura `agruparChecksPorFase(checks)` que ordena por `(fase, orden, label)` y devuelve los grupos con su conteo `ok/total`. Se deja en utils para mantenerlo testeable y fuera del componente.
- `src/features/embarques/components/cierre/CierreChecklistCard.tsx`: usar el agrupador y renderizar encabezado + contador por fase; se extrae `CierreChecklistFase.tsx` para no pasar de 200 líneas ni subir la complejidad.
- Tests: extender `cierreCheckMeta.test.ts` (toda regla conocida tiene fase) y agregar `cierreCheckOrden.test.ts` (orden estable, grupos vacíos omitidos, conteos correctos).
- `CHANGELOG.md` + bump de `APP_VERSION` a `13.361.0`.

Sin cambios en la base de datos ni en el RPC `validar_cierre_embarque`: el reordenamiento es solo de presentación.

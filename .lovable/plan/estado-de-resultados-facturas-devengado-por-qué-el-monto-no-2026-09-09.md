# Estado de resultados (Facturas / devengado): por qué el monto no cuadra

## Qué comprobé (septiembre 2026, empresa Elogistix)

Abrí la pantalla con sesión real y comparé contra la base de datos:

| Vista | Ingresos septiembre |
|---|---|
| Estado de resultados, fuente **Facturas** | 1,907,753.49 MXN |
| Estado de resultados, fuente **Embarques** | 7,688,264.96 MXN |
| KPI "Facturado del mes" de Facturación | 1,907,356.73 MXN |
| Facturas del mes sin IVA, con el tipo de cambio de la propia factura | 1,890,258.28 MXN |

Dos hallazgos distintos:

1. **La diferencia grande (1.9 M vs 7.7 M) no es un error de cálculo.** Son dos cosas
   distintas y hoy la pantalla no lo explica: "Embarques" cuenta los servicios de los 42
   embarques cuya llegada cae en septiembre, y de esos 21 todavía no tienen factura y 9 se
   facturaron en agosto. Es el hueco de facturación, no un bug.

2. **La diferencia pequeña sí viene de bugs.** Los tres números de arriba se calculan con
   reglas distintas: el estado de resultados usa el importe sin IVA pero convertido con el
   tipo de cambio del **embarque**, mientras Facturación usa el importe con IVA convertido
   con el tipo de cambio de la **factura**. Que se parezcan es casualidad: se compensan.

## Bugs a corregir

1. **Tipo de cambio equivocado en la fuente devengada.** Para una factura, el tipo de cambio
   válido es el de la factura (es el que se timbró ante el SAT). Hoy se usa primero el del
   embarque: 7 de las 11 facturas de septiembre tienen un tipo distinto al de su embarque.
   Se corrige el orden a: factura → embarque → tipo de cambio del día.
2. **Notas de crédito de proveedor no se restan.** El propio comentario del código dice que
   los costos van "menos notas de crédito de proveedor", pero nunca se restan. Hoy no hay
   ninguna registrada, así que el número de septiembre no cambia, pero en cuanto exista una
   los costos quedarán inflados.
3. **Facturas de proveedor rechazadas cuentan como costo.** Sólo se excluyen las canceladas;
   una factura rechazada o pendiente de aprobación entra igual al costo del mes.
4. **La consulta arranca antes de saber en qué empresa estás.** Durante ese instante suma
   facturas de todas las empresas (y de forma permanente si un superadministrador entra sin
   empresa activa). Hoy detecté 2 facturas de proveedor de otras empresas que podrían colarse
   por esa vía.
5. **Facturas sin embarque se clasifican siempre como "Marítimo"** y, cuando un expediente
   está duplicado (existe el caso ELIMP00006), puede tomar el embarque equivocado, desviando
   las columnas por modo.

## Además: dejar claro qué se está comparando

- Etiquetar en el estado de resultados que los importes son **sin IVA** y precisar en el
  texto de la fuente devengada que se cuenta por fecha de emisión de la factura.
- En Facturación, aclarar que "Facturado del mes" es **con IVA**, para que nadie espere que
  ambos números coincidan. No se cambia ninguna cifra ni la función de base de datos.

## Detalle técnico

- `src/features/profit/services/estadoResultadosBuckets.ts`: en `ingresosDeFacturas`
  invertir la precedencia a `fallbackTC(f.tipo_cambio, emb?.tipo_cambio_usd ?? tc.usd)`;
  mantener EUR con respaldo DOF. Sin cambios de firma.
- `src/features/profit/services/estadoResultadosFetch.ts`: nueva consulta
  `fetchProveedorNotasCreditoMes` (mismo patrón `unwrapOr`, filtro por org, estado aplicada,
  `fecha_emision` en el mes) y, en `fetchProveedorFacturasMes`, excluir
  `estado_aprobacion = 'rechazada'`.
- `estadoResultadosBuckets.ts`: `costosDeProveedorFacturas` recibe las NC de proveedor y
  agrega una fila negativa "Notas de crédito de proveedor" con el modo del embarque padre,
  reutilizando el mismo criterio de TC.
- `src/features/profit/hooks/useEstadoResultados.ts`: usar `orgListo` de `useOrgFilter` como
  `enabled` de la consulta, igual que otras bandejas.
- `estadoResultadosFetch.ts` / `loadEmbarquesPorExpedientes`: al construir el mapa por
  expediente, si aparece más de un embarque vivo con el mismo expediente no elegir uno
  arbitrariamente; dejar la factura sin embarque para que no falsee el modo, y clasificar
  las facturas sin embarque en la columna "Otros" en lugar de "Marítimo".
- UI: `ProfitEstadoResultados.tsx` (nota de fuente + "sin IVA") y el rótulo del KPI en el
  encabezado de Facturación. Sin migraciones, sin RPC nuevas, sin cambios de datos.
- Regresiones nuevas en `src/features/profit/services/__tests__/estadoResultadosDevengado.test.ts`:
  precedencia de TC, NC de proveedor restada, factura de proveedor rechazada excluida,
  expediente duplicado sin asignación de modo.
- Versión y `CHANGELOG.md` se bumpean al cierre. Vitest/CI/RLS/E2E quedan para GitHub Actions;
  aquí sólo typecheck, ESLint focalizado y build.

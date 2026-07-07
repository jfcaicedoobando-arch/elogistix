
# Fase 2 — Bandejas de trabajo en /facturacion

## Objetivo

Sustituir los 2 tabs actuales (`Emitidas`, `Notas de crédito`) por **7 bandejas de trabajo** con badges de conteo, cada una con una acción rápida por fila. Es el corazón del rediseño estilo Odoo/SAP: el usuario entra y ve dónde hay trabajo pendiente hoy.

## Analogía

Hoy hay un cajón grande con todas las facturas revueltas. Después de Fase 2 hay **7 cajones etiquetados**, cada uno con un número rojo si tiene pendientes y con una sola acción principal ("Timbrar", "Enviar", "Cobrar")\. El usuario abre el cajón que le urge y trabaja.

## Bandejas a construir

```text
[ 📄 Por facturar N ] [ 📥 Por timbrar N ] [ 📤 Por enviar N ]
[ 💳 Por cobrar N ] [ ⚠ Vencidas N ] [ 🧾 REP pendientes N ]
[ ✅ Emitidas ] [ ↩ Notas de crédito ]
```

| # | Bandeja           | Fuente de datos                                                            | Hook a reusar / extender                                       | Acción rápida por fila |
| - | ----------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------- |
| 1 | Por facturar      | Embarques cerrados sin CFDI (hueco de facturación)                         | `useHuecoFacturacion` (ya existe)                              | "Generar factura"      |
| 2 | Por timbrar       | `facturas` con `estado='Borrador'` + `facturapi_id IS NULL` + fecha ≥ corte | Nuevo `useFacturasPorTimbrar` sobre `facturas`                 | "Timbrar"              |
| 3 | Por enviar        | Facturas timbradas sin envío exitoso en `factura_envios`                   | Nuevo `useFacturasPorEnviar`                                   | "Enviar CFDI"          |
| 4 | Por cobrar        | `useCobranza` → `estatus_cobranza IN ('Al corriente','Por vencer')`, saldo>0 | `useCobranza` (ya existe)                                      | "Registrar pago"       |
| 5 | Vencidas          | `useCobranza` → `estatus_cobranza='Vencida'`, saldo>0                      | `useCobranza`                                                  | "Registrar pago"       |
| 6 | REP pendientes    | `pagos_factura.estado_rep IN ('Pendiente','Error')`                        | Nuevo `usePagosRepPendientes`                                  | "Timbrar REP"          |
| 7 | Emitidas          | Historial completo (comportamiento actual)                                 | `useFacturacionPageController` (sin cambios)                   | Menú kebab actual      |
| 8 | Notas de crédito  | Historial NC (comportamiento actual)                                       | `NotasCreditoRecientes` (sin cambios)                          | -                      |

Los conteos de las bandejas 2, 3 y 6 son los mismos que hoy están en `FacturacionKpisFiscales` (retirado en Fase 1). Vuelven como **badges numéricos** al lado del nombre de cada bandeja.

## Estructura de archivos

```text
src/features/facturacion/components/bandejas/
  BandejaTabs.tsx                  # trigger row con badges (≤120 líneas)
  BandejaPorFacturar.tsx           # reusa useHuecoFacturacion
  BandejaPorTimbrar.tsx            # nueva query
  BandejaPorEnviar.tsx             # nueva query
  BandejaPorCobrar.tsx             # useCobranza filtrado
  BandejaVencidas.tsx              # useCobranza filtrado
  BandejaRepPendientes.tsx         # nueva query
  BandejaEmitidas.tsx              # extrae la lista actual
  BandejaNotasCredito.tsx          # wrapper de NotasCreditoRecientes
  columns/
    porTimbrarColumns.tsx          # Folio · Cliente · Total · Emisión · Acción
    porEnviarColumns.tsx
    repPendientesColumns.tsx

src/features/facturacion/services/
  bandejas.ts                      # queries nuevas (porTimbrar, porEnviar, repPendientes)

src/features/facturacion/hooks/
  useFacturasPorTimbrar.ts
  useFacturasPorEnviar.ts
  usePagosRepPendientes.ts
  useBandejaConteos.ts             # 1 sola query con count:'exact', head:true × 6
```

Cada archivo ≤200 líneas (Power of 10).

## Navegación y URL

- El tab activo se sincroniza con la URL: `/facturacion?bandeja=por-timbrar`.
- Default: `por-timbrar` si hay pendientes, si no `emitidas`.
- Los redirects legacy (`?tab=cobranza|liquidacion|proyeccion|pendientes`) se conservan.

## Contadores de badges

Un solo hook `useBandejaConteos` hace 6 `count: 'exact', head: true` en paralelo (patrón ya usado en `kpisFiscales.ts`). Refresh cada 60 s. Muestra el número sólo cuando > 0; badge en tono `warning` (naranja) para "Por timbrar / Por enviar / REP pendientes", `danger` (rojo) para "Vencidas", `default` para el resto.

## Acción rápida por fila

Cada bandeja de acción muestra **un solo botón principal** al final de la fila:
- Por timbrar → abre `DialogTimbrarFactura` (ya existe).
- Por enviar → abre `DialogEnviarCfdi` (ya existe).
- Por cobrar / Vencidas → abre `DialogRegistrarPago` (ya existe).
- REP pendientes → llama `useTimbrarRep` (ya existe).
- Por facturar → navega a `/embarques/:id` (o abre wizard de conversión — lo que ya use el HuecoDetalleDialog).

El resto de acciones (cancelar, sustituir, descargar) siguen en `/facturacion/:id`.

## HuecoFacturacionChip

Se elimina el chip inline junto a los tabs. Toda su información vive ahora en la bandeja "Por facturar" (con más contexto y columnas).

## Riesgos y mitigaciones

1. **Campos faltantes en el RPC `facturas_listado`**: el listado paginado hoy no expone `facturapi_id` ni `uuid_fiscal`. Solución: para las bandejas "Por timbrar" y "Por enviar" hago queries directas a `facturas` (no vía RPC) con los filtros necesarios. Payload chico porque el N esperado es bajo (docenas, no miles).
2. **REP pendientes**: `pagos_factura.estado_rep` ya existe (usado en `kpisFiscales.ts`), pero no tengo columnas de "fecha del pago" y "factura relacionada" listas para tabla. Solución: consulta directa con `select` explícito y join a `facturas(numero, cliente_nombre)`.
3. **Rendimiento**: 6 conteos + 1 lista visible = 7 queries por render. Se cachean 60 s con React Query.
4. **Volver atrás**: Fase 2 no borra la tab "Emitidas" — la mantiene como una bandeja más, así que el flujo actual sigue disponible. Nada se rompe.

## Fuera de alcance de Fase 2

- Panel de aging integrado (Fase 3).
- Document flow en detalle (Fase 4).
- Cierre de periodo fiscal (descartado por producto).
- Vistas salvables por usuario (Fase 6).
- Command palette fiscal (Fase 6).

## Entregables

1. 8 componentes de bandeja + 3 hooks + 1 servicio nuevos.
2. `Facturacion.tsx` refactorizado a orquestador de bandejas (≤200 líneas).
3. `HuecoFacturacionChip` eliminado del layout (se sigue exportando por si algún test lo usa).
4. `TabFacturasEmitidas` → renombra internamente a `BandejaEmitidas` (misma lógica).
5. Tests unitarios de los 3 hooks nuevos.
6. Bump de versión y entrada de CHANGELOG.

## Detalles técnicos

- `useBandejaConteos` retorna `{ porFacturar, porTimbrar, porEnviar, porCobrar, vencidas, repPendientes }` con refresh 60 s.
- Query "Por timbrar":
  ```sql
  select id, numero, cliente_nombre, total, moneda, fecha_emision
  from facturas
  where organization_id = :org
    and estado = 'Borrador'
    and facturapi_id is null
    and fecha_emision >= '2026-07-01'
  order by fecha_emision desc;
  ```
- Query "Por enviar":
  ```sql
  select f.id, f.numero, f.cliente_nombre, f.total, f.moneda, f.fecha_emision
  from facturas f
  left join factura_envios e
    on e.factura_id = f.id and e.estado = 'enviado'
  where f.organization_id = :org
    and f.uuid_fiscal is not null
    and e.id is null
  order by f.fecha_emision desc;
  ```
  Alternativa si el `left join` es lento: dos queries y filtro en memoria.
- Query "REP pendientes":
  ```sql
  select p.id, p.fecha_pago, p.monto, p.moneda, p.estado_rep,
         f.numero, f.cliente_nombre
  from pagos_factura p
  join facturas f on f.id = p.factura_id
  where p.organization_id = :org
    and p.estado_rep in ('Pendiente','Error')
  order by p.fecha_pago desc;
  ```
- Todas las queries respetan RLS (multi-tenant) por `organization_id`.
- Reuso total de diálogos existentes (timbrar / enviar / pagar / timbrar REP).

## Orden de implementación

1. **Servicio + hooks** (`bandejas.ts`, `useFacturasPorTimbrar`, `useFacturasPorEnviar`, `usePagosRepPendientes`, `useBandejaConteos`).
2. **Columns files** (3 nuevos).
3. **8 componentes de bandeja** (empezando por las 3 nuevas; las de cobranza y emitidas reusan lo existente).
4. **`BandejaTabs`** — trigger row con badges.
5. **Refactor de `Facturacion.tsx`** para orquestar bandejas y URL `?bandeja=`.
6. Eliminar `HuecoFacturacionChip` del layout.
7. Tests + changelog + bump.

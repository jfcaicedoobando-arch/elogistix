# Cierre: deep-links con foco y filtro exacto del pendiente

Hoy el botón **Resolver** lleva al tab correcto del embarque pero el usuario sigue teniendo que adivinar **qué fila** del tab atender. El siguiente nivel: el destino llega con el foco puesto en la sección/lista que corresponde al pendiente, pre-filtrada y resaltada.

## Cómo funciona (UX)

1. Click en "Resolver" del check ❌ → navega a `…?tab=<tab>&focus=<key>&…` (params extra según el pendiente, ej. `containerId`).
2. El tab destino lee `focus`, hace **scroll suave** a la sección marcada con `data-focus="<key>"`, aplica un **ring resaltado** (animación de pulso ~2s) y, si aplica, **prefiltra** la tabla.
3. Al cambiar el usuario cualquier filtro o pasar 4s, el highlight se desvanece para no estorbar.

## Mapeo por regla → destino con filtro


| Regla (RPC)                    | Destino                                     | Filtro / foco aplicado                                                             |
| ------------------------------ | ------------------------------------------- | ---------------------------------------------------------------------------------- |
| `cxc_cobrada`                  | `?tab=facturacion&focus=cxc`                | Scroll a "Historial de facturas", resalta filas con saldo > 0 (estado ≠ Pagada)    |
| `cxp_pagada`                   | `?tab=costos&focus=cxp`                     | Scroll a tabla de costos, prefiltra `estado_liquidacion ≠ Pagado`                  |
| `docs_completos`               | `?tab=documentos&focus=faltantes`           | Prefiltra a documentos sin archivo subido                                          |
| `venta_conceptos_facturados`   | `?tab=facturacion&focus=venta-pendientes`   | Scroll a "Resumen de conceptos de venta", filtro "Pendientes / En proforma" activo |
| `costo_conceptos_con_factura`  | `?tab=costos&focus=costo-sin-factura`       | Filtra costos sin factura de proveedor ligada                                      |
| `costos_liquidados`            | `?tab=costos&focus=costo-no-liquidado`      | Filtra `estado_liquidacion = Pendiente`                                            |
| `pnl_margen_minimo`            | `?tab=pnl&focus=utilidad`                   | Scroll a tarjeta de Utilidad/Margen                                                |
| `comision_calculada`           | `?tab=pnl&focus=comision`                   | Scroll a sección Comisión                                                          |
| `contenedores_datos_completos` | `?tab=resumen&focus=contenedores&ids=<csv>` | Scroll a sección contenedores y resalta filas cuyo id esté en `ids`                |


Los `ids` y montos vienen del `detalle` de la RPC (ya los devuelve, ver `validar_cierre_embarque`).

## Cambios técnicos

### Nuevo helper compartido

- `src/features/embarques/hooks/useFocusSection.ts` — hook que:
  - Lee `focus` (y opcional `ids`/`containerId`) de `useSearchParams`.
  - Expone `{ focus, ids, registerRef(key) }`.
  - `registerRef(key)` devuelve un callback ref que, cuando `focus === key`, hace `scrollIntoView({behavior:"smooth", block:"start"})` y añade clase `ring-2 ring-primary animate-pulse` por 2.5s; luego limpia el param `focus` con `setSearchParams`.

### `cierreCheckMeta.ts` (extender)

- Cada regla devuelve `ruta(embarqueId, detalle)` ahora con `detalle` opcional, para poder anexar `ids` o `containerId` cuando exista.
- `ctaLabel` por regla se mantiene; los focus keys nuevos se añaden a la cadena.

### `CierreCheckItem.tsx`

- Pasa `detalle` al construir la URL: `meta.ruta(embarqueId, detalle)`.

### Tabs destino — pequeños refactors puntuales

- `TabFacturacion.tsx`:
  - Envuelve `ResumenConceptosVenta` con `<div ref={registerRef("venta-pendientes")} data-focus="venta-pendientes">`.
  - Envuelve `HistorialFacturas` con `data-focus="cxc"` y le pasa una prop opcional `defaultFiltro="pendientes"` (o equivalente) cuando `focus==="cxc"` para resaltar/filtar facturas con saldo.
- `TabCostos.tsx`:
  - Envuelve la tabla de costos con `data-focus="cxp"/"costo-sin-factura"/"costo-no-liquidado"` y aplica prefiltro derivado del focus (memoización sobre `conceptosCosto`).
  - Mostrar pill "Filtrando: <razón> (limpiar)" cuando el filtro venga de un focus.
- `TabDocumentos.tsx`: prop `focus` que oculta documentos completos cuando vale `faltantes` y resalta los faltantes.
- `TabPnl.tsx`: registrar refs para `utilidad` y `comision`.
- `EmbarqueDetalleTabs.tsx`: solo orquesta — el hook ya lee la URL directo.

### Tests

- `cierreCheckMeta.test.ts` — extender: la regla `contenedores_datos_completos` con `{ids:[…]}` produce `?tab=resumen&focus=contenedores&ids=…`; `cxc_cobrada` produce `?focus=cxc`.
- `useFocusSection.test.tsx` — render con `?focus=cxc`, ref recibido, scrollIntoView llamado, clase de pulso aplicada y luego removida.

### Sin tocar

- RPC `validar_cierre_embarque` — el `detalle` ya trae todo.
- Permisos / RLS / BD.
- Estructura de tabs (slugs siguen iguales).

## Versionado

`APP_VERSION` → `13.89.3` y entrada en `CHANGELOG.md` ("UX: deep-links de cierre con foco + prefiltro en el destino").

## Lo que el usuario verá

Isela ve `❌ Cuentas por cobrar al día — saldo $14,500` con botón "Ir a Facturación". Un click → tab Facturación abierto, la tabla **Historial de facturas** filtrada a "con saldo", resaltada con un ring azul que pulsa 2 segundos, y un chip "Filtrando: pendientes de cobro · limpiar".

Que al acer click, se abra una ventana nueva. 
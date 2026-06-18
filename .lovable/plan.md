## Contexto del hallazgo

Hoy la conversión cotización → embarque tiene un comportamiento **asimétrico**:

- `conceptos_costo`: cuando `cotizacion_costos.unidad_medida='Contenedor'` el helper `construirCostosRows` ya replica una fila por cada contenedor hijo (línea 64-66 de `embarquesHelpers.ts`). Cuando es `'BL'` se inserta una sola con `contenedor_id=NULL`.
- `conceptos_venta`: `parsearVentasJsonb` toma el jsonb `cotizaciones.conceptos_venta` y lo inserta **siempre con `contenedor_id=NULL`**, sin replicar y sin importar la unidad de medida. Por eso ELIMP00272 tiene 2 conceptos generales pese a tener 6 contenedores.

Para demoras, `calcular_demoras_embarque` usa **una sola fecha** `Descarga` (mín) y **una sola** `Entrega` (máx) del timeline del embarque y aplica los mismos días a cada contenedor. No hay forma hoy de capturar que el contenedor A se devolvió el día 12 y el B el día 25.

ELIMP00272 ya quedó como está (proforma única con los 2 conceptos manuales actuales — fuera de alcance de este plan).

## Cambios

### 1. Replicar conceptos de venta por contenedor (alineado con costos)

**`src/features/cotizacion/services/conversiones/embarquesHelpers.ts`** — extender `parsearVentasJsonb` a `parsearVentasJsonb(ventasJsonb, embarqueId, hijos)`:

- Si el item jsonb trae `unidad_medida === 'BL'` (o vacío): 1 fila con `contenedor_id=NULL` (como hoy).
- Si trae `unidad_medida === 'Contenedor'` (default): N filas, una por hijo, con `contenedor_id = hijo.id`, dividiendo `cantidad` para que el total siga siendo el cotizado (igual que costos).
- Mismas reglas para `tasa_iva_aplicada`/`aplica_iva` por fila.

**`embarques.ts`** — pasar `hijosCreados` al llamar `insertarVentasEmbarque` y propagar la firma.

Esto cierra el hueco: a partir de v13.66.11, cualquier embarque generado desde cotización **ya nace con ventas etiquetadas por contenedor** y la UI del wizard de proforma puede filtrar por contenedor sin pasos manuales extra.

**No se backfillea** ELIMP00272 ni embarques previos (los conceptos manuales ya divergieron de la cotización).

### 2. Demoras por contenedor

**Migración**: agregar a `embarque_contenedores`:

- `fecha_descarga date NULL` — fecha en que el contenedor llegó/se descargó.
- `fecha_devolucion date NULL` — fecha real de devolución a la naviera.
- `dias_libres_override int NULL` — opcional, para sobreescribir el default de la naviera por contenedor.

**Migración**: reescribir `public.calcular_demoras_embarque(uuid)`:

- Para cada `embarque_contenedores` del embarque:
  - Usar `ec.fecha_descarga`/`ec.fecha_devolucion` si existen; si no, **fallback** a las fechas del timeline (`Descarga` min / `Entrega` max) para no romper el comportamiento de embarques actuales sin datos por contenedor.
  - Usar `ec.dias_libres_override` si no es NULL; si no, el default de `costeo_navieras_condiciones.dias_libres_demoras_default`.
  - Calcular `dias_excedidos = max(0, dias_puerto - dias_libres)` por contenedor.
  - Aplicar el tabulador escalonado (ya existe la lógica `v_tarifa`) por contenedor.
- Borrar/recrear `conceptos_costo` y `conceptos_venta` con `origen='demoras_auto'` etiquetados con `contenedor_id` del hijo correspondiente.
- Mantener el shape JSON de retorno (`contenedores: [...]`) y los totales agregados.

**UI mínima** en `EmbarqueDetalleContenedoresTab` (o donde se edita el contenedor): inputs `Fecha de descarga`, `Fecha de devolución`, `Días libres (override)`. Al guardar dispara recálculo de demoras (ya existe trigger `trg_recalcular_demoras_al_entregar`; añadiremos otro `AFTER UPDATE` sobre estos tres campos).

### 3. UX wizard de proforma

`PasoSeleccionConceptos`/`FiltroContenedorChips` ya soportan filtrar por contenedor — sin cambios. Cuando los conceptos de venta vengan ya etiquetados (cambio #1) y las demoras también (cambio #2), el operador puede generar 1 proforma por contenedor pulsando el chip respectivo. No se fuerza: sigue siendo decisión del operador.

### 4. Tests

- `embarquesHelpers.integration.test.ts`: nuevos casos para `parsearVentasJsonb` con BL vs Contenedor + N hijos.
- `calcular_demoras_embarque`: test SQL/integration con 2 contenedores con fechas distintas → verificar conceptos generados por hijo.
- Snapshot del wizard de proforma filtrado por contenedor con conceptos heredados de cotización.

### 5. Metadata

- Bump `APP_VERSION` → `13.66.11`.
- Entrada en `CHANGELOG.md` (idioma español mexicano, formato Keep a Changelog) describiendo: replicación de ventas por contenedor, demoras por contenedor con fallback a timeline, columnas nuevas en `embarque_contenedores`.

## Fuera de alcance

- No se modifica ELIMP00272 ni embarques previos (sus conceptos ya están divergidos de la cotización; la proforma actual se genera tal cual con los 2 conceptos generales).
- No se quita la capacidad de tener conceptos `contenedor_id=NULL` ("generales del embarque") — sigue siendo válido para honorarios, despacho, etc.
- No se cambia el modelo de proforma (sigue siendo 1 proforma → 1 factura).

## Detalles técnicos clave

- Las nuevas columnas son `NULL` por default → embarques existentes no cambian su cálculo (fallback a timeline).
- La RPC mantiene `SECURITY DEFINER` + `SET search_path = public` + GRANT a `authenticated, service_role`.
- La replicación de ventas divide `cantidad` para preservar el total facturable; alternativa: replicar `cantidad` íntegra y duplicar el total → necesita confirmación del usuario antes de implementar (lo dejo con división como costos, que es el patrón canónico hoy).
- Triggers de UI: al editar `fecha_devolucion`/`dias_libres_override` de un contenedor → `PERFORM public.calcular_demoras_embarque(embarque_id)` para regenerar conceptos automáticos.

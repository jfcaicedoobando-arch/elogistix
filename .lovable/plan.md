# Tarifa-first: reordenar el wizard de cotización marítima

## Diagnóstico (lo que ya tenemos)

El wizard tiene 4 pasos: **Datos Generales → Costos & P&L → Cotización Cliente → Resumen**. El Paso 1 ya organiza secciones en orden: Cliente → Operación → Ruta → Mercancía → **Tarifa** → Cierre.

La buena noticia: la vinculación de tarifa **ya existe** (`TarifaVinculadaPanel` + `BuscarTarifaDialog` + `SugerenciasTarifaInline`) y al elegir una tarifa ya autorrellena `tarifaId`, `tipoContenedor`, `tiempoTransitoDias`, `diasLibresDestino` y `cartaGarantia`.

La mala: hoy la tarifa es **opcional** (no bloquea avance), las sugerencias aparecen "abajo" después de mercancía, y los conceptos de costo/venta **no se auto-cargan**.

## Estrategia (lo que cambia)

Convertir la vinculación de tarifa en el **centro de gravedad** del Paso 1 cuando el modo = Marítimo, con bloqueo duro al intentar avanzar sin tarifa.

### Nuevo orden del Paso 1 (solo marítimo)

```text
1. Cliente            (sin cambio)
2. Operación          (modo, tipo, incoterm)
3. Ruta + Contenedor  ← FUSIONADO: origen, destino, tipo de contenedor
4. Tarifa vinculada   ← PROMOVIDO: ahora es el "guardián" del paso
5. Mercancía          (peso, dimensiones, embarques) — pasa a después
6. Cierre             (notas)
```

Aéreo / Terrestre / Multimodal mantienen el orden actual (sin guardián de tarifa).

### Bloqueo duro

Al pulsar **Siguiente** desde el Paso 1 en modo Marítimo:

- Si `tarifaId` está vacío → no avanza. Se muestra inline en la sección Tarifa un mensaje destacado y dos CTAs:
  - **Buscar tarifa** (abre `BuscarTarifaDialog` ya existente).
  - **Crear tarifa nueva** → navega a `/costeo/tarifas/nueva` precargando origen+destino+tipoContenedor por query string; al guardar regresa al wizard con la tarifa ya vinculada (vía `returnTo` en la URL).
- Si origen/destino/tipoContenedor están incompletos → el guardián muestra primero "completa estos 3 campos para ver tarifas disponibles" (estado actual de `SugerenciasTarifaInline`, pero ahora como bloqueo, no como sugerencia opcional).

Se registra en `bitacora_actividad` cada bloqueo para medir adopción.

### Sugerencias siempre visibles y prominentes

`SugerenciasTarifaInline` (Top 3) se promueve dentro del nuevo bloque "Tarifa". Cuando origen+destino+contenedor están completos, las 3 cards aparecen sin tener que abrir el diálogo. Al elegir una desde ahí, se vincula directo.

### Auto-carga de costos y venta sugerida

Al vincular tarifa (desde sugerencia o diálogo), además de los campos ya existentes:

- **Costos internos (Paso 2)**: por cada recargo de la tarifa (`costeo_tarifa_recargos`) + flete base, se insertan filas en `cotizacion_costos` con `tipo = 'costo'`, moneda USD, monto del recargo, lado origen/destino, y `origen_tarifa_id` para trazabilidad.
- **Venta sugerida (Paso 3)**: se replica cada concepto como fila de venta aplicando un **markup configurable** (`configuracion.markup_default_maritimo`, default 15%, editable en módulo Configuración). Cada fila queda editable; el usuario puede ajustar antes de finalizar.
- Indicador visual: las filas auto-cargadas muestran un badge "Desde tarifa #ID" y un botón para restaurar el valor original si fueron editadas.

Si el usuario **cambia o quita la tarifa** después de auto-cargar, se le pregunta vía `AlertDialog`: "¿Reemplazar los conceptos auto-cargados o conservarlos?".

## Cambios técnicos

### Frontend

1. `PasoDatosGenerales.tsx`: reordenar secciones bajo condición `modo === "Marítimo"`. Fusionar tipo de contenedor dentro de la sección Ruta (mover el `Select` de `tipoContenedor` desde `SeccionMercanciaMaritimaFCL` al nuevo `SeccionRutaContenedor`).
2. Nuevo componente `SeccionTarifaGuardian` que envuelve `TarifaVinculadaPanel` + `SugerenciasTarifaInline` con UI elevada (card destacada, ícono Anchor, banner de estado: "Tarifa requerida para continuar").
3. `useCotizacionWizardSteps.ts → validatePaso1`: agregar regla `if (modo === "Marítimo" && !tarifaId) return error con focus a #seccion-tarifa`.
4. `aplicarTarifa.ts`: extender `aplicarTarifaAlForm()` para llamar nuevos hooks `autocargarCostosDesdeTarifa()` y `autocargarVentaSugerida(markup)`.
5. `BuscarTarifaDialog` + nuevo botón "Crear tarifa" que navega a `/costeo/tarifas/nueva?origen=...&destino=...&tipoContenedor=...&returnTo=/cotizaciones/nueva`.
6. `CosteoTarifas` (form de nueva tarifa): leer query string, precargar campos y, al guardar, si hay `returnTo`, navegar de regreso con `?tarifaId=<nuevo-id>` para que el wizard la vincule automáticamente.

### Configuración

Añadir clave `markup_default_maritimo` (numeric, default 0.15) en `public.configuracion` y exponerla en la pantalla de Configuración Global, sección "Cotizaciones".

### Trazabilidad

Añadir columna `origen_tarifa_id uuid` (FK a `costeo_tarifas.id`, nullable) a `cotizacion_costos` y `conceptos_venta` (las que apliquen al flujo de cotización). Permite saber qué filas provienen de auto-carga.

### Telemetría / bitácora

Registrar en `bitacora_actividad` los eventos: `tarifa_vinculada_desde_sugerencia`, `tarifa_vinculada_desde_dialogo`, `tarifa_creada_desde_wizard`, `cotizacion_bloqueada_sin_tarifa`. Sirve para medir si efectivamente la gente empieza por tarifa.

## Fuera de alcance

- Aéreo y terrestre: no se toca su orden ni se les añade guardián (no tienen módulo de tarifas equivalente).
- Edición de cotizaciones existentes que se crearon sin tarifa: siguen funcionando; el guardián solo aplica al crear o cambiar a modo Marítimo desde otro modo.
- Markup escalonado por cliente / por ruta: en esta fase es un valor global único.

## Entregables y versión

- Bump `APP_VERSION` (minor, p.ej. `13.35.0`).
- Entrada en `CHANGELOG.md` describiendo el reordenamiento, bloqueo y auto-carga.
- Memoria nueva `mem://features/cotizacion-tarifa-first` con la regla de bloqueo y la fórmula de markup.

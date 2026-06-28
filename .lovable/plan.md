## Objetivo

En `/cotizaciones/nueva`, el formulario aparece con varios campos precargados (Modo: Marítimo, Tipo: Importación, Incoterm: FOB, Tipo de carga: Carga General, Tipo de embarque: FCL, Tipo de peso: Peso Normal, Núm. contenedores: 1, y una fila vacía en dimensiones LCL/Aéreas). El usuario quiere que el área de contenido salga **en blanco** para que cada cotización se llene desde cero.

## Cambios

### 1. `src/features/cotizacion/types/form.ts` — `COTIZACION_FORM_DEFAULTS`

Vaciar los valores que hoy vienen precargados:

- `modo: ""` (antes `"Marítimo"`)
- `tipo: ""` (antes `"Importación"`)
- `incoterm: ""` (antes `"FOB"`)
- `tipoCarga: ""` (antes `"Carga General"`)
- `tipoEmbarque: ""` como string vacío (requiere ajustar el tipo a `"FCL" | "LCL" | ""`)
- `tipoPeso: ""` (antes `"Peso Normal"`)
- `numContenedores: 0` (antes `1`)
- `dimensionesLCL: []` (antes una fila con ceros)
- `dimensionesAereas: []` (antes una fila con ceros)

Sólo aplica a **Nueva Cotización**. Al editar (`buildCotizacionDefaultValues(d)` con datos existentes) sigue cargando los valores de BD igual que hoy; los fallbacks `?? "Carga General"`, `?? "FCL"`, `?? "Peso Normal"` dentro de los `partesMercancia*` se mantienen para no romper cotizaciones viejas.

### 2. Ajustes mínimos por el tipo

- En `CotizacionFormValues`, cambiar `tipoEmbarque: "FCL" | "LCL"` a `tipoEmbarque: "FCL" | "LCL" | ""`.
- Revisar los pocos lugares que leen `tipoEmbarque` (selector FCL/LCL, lógica de dimensiones, validación del wizard) para que acepten `""` como "no seleccionado" sin romper. Si la validación del paso 1 ya marca estos campos como obligatorios, el usuario simplemente verá los selects en blanco y tendrá que elegir antes de avanzar — que es justo el comportamiento pedido.

### 3. Versionado y changelog

- Bump `APP_VERSION` (patch).
- Entrada nueva en `CHANGELOG.md`: "Nueva Cotización ahora abre con el formulario en blanco; sin valores predefinidos de modo/tipo/incoterm/embarque."

## Fuera de alcance

- No tocar el flujo de edición ni los datos guardados.
- No cambiar las reglas de validación del wizard (sólo aceptar string vacío como "sin seleccionar"); si quieres que ciertos campos sigan teniendo un default sensato (por ejemplo Incoterm `FOB`), dímelo y lo dejamos fuera del vaciado.

## Pregunta rápida antes de implementar

¿Quieres vaciar **absolutamente todo** (incluyendo Modo, Tipo Import/Export e Incoterm), o prefieres conservar algunos defaults útiles — por ejemplo Modo `Marítimo` y Tipo `Importación`, que es lo más común — y sólo vaciar carga/embarque/peso/contenedores/dimensiones? vaciamos todo
# Precargar tipo de contenedor en Buscar tarifa marítima

## Problema
`BuscarTarifaDialog` ya acepta un prop `initial` con `tipoContenedorId`, pero `TarifaVinculadaPanel` (Paso 1) abre el modal **sin** pasarlo, por lo que el usuario debe volver a elegir el tipo de contenedor que ya seleccionó arriba.

Complicación: el campo `tipoContenedor` del formulario guarda una etiqueta hardcodeada (ej. `"20' GP"`, `"40' High Cube"`), mientras que el modal espera el `id` (UUID) del catálogo `tipos_contenedor`.

## Cambios

**1. `src/features/cotizacion/components/TarifaVinculadaPanel.tsx`**
- Cargar el catálogo con `useTiposContenedor()`.
- Resolver el `id` del catálogo a partir de la etiqueta del Paso 1 con un match normalizado (lowercase, sin apóstrofes ni espacios extra) contra `tipo.name`.
- Pasar `initial={{ tipoContenedorId }}` al `<BuscarTarifaDialog>`. Si no hay match, pasar `undefined` (comportamiento actual).

**2. Metadata**
- `APP_VERSION` → `13.26.2`
- `CHANGELOG.md`: nueva entrada `[13.26.2]` — "El modal Buscar tarifa marítima precarga el tipo de contenedor elegido en el Paso 1 del wizard de cotización."

## Fuera de alcance
- Precargar puertos origen/destino (los campos del Paso 1 son texto libre, no IDs de `puertos`). Requiere migración mayor, no parte de este cambio.
- Migrar `tipoContenedor` de string hardcodeado a FK del catálogo (cambio mayor ya discutido).

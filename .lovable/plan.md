# Fix CI failures — CatalogoClavesSATCard

## Diagnóstico

Dos jobs fallaron por el mismo archivo `src/features/configuracion/components/CatalogoClavesSATCard.tsx`:

1. **Knip (lint:unused)**: el archivo exporta `CatalogoClavesSATCard` como nombrado **y** como `default` → knip lo marca como export duplicado.
2. **Power of 10 (arch baseline)**: 217 líneas. La regla core prohíbe archivos productivos > 200 líneas fuera de allowlist.

## Analogía

El archivo se me infló porque le metí catálogos, constantes de UI, un sub-componente y el componente principal en un solo lugar — como llenar una sola caja con herramientas, tornillos y planos. La solución es partir la caja: constantes en su repisa, sub-componente en la suya, y el componente principal solo.

## Cambios

### 1. Extraer constantes + `EditRow` a `CatalogoClavesSATCard.parts.tsx`

Sacar del archivo principal:
- Tipos `TipoIva`, `Row`, `Draft`.
- Constantes `EMPTY`, `UNIDADES_SAT`, `TIPO_IVA_LABEL`, `TIPO_IVA_VARIANT`.
- Helper `tasaFromTipo`.
- Sub-componente `EditRow`.

Nuevo archivo: `src/features/configuracion/components/CatalogoClavesSATCard.parts.tsx` (~110 líneas).

### 2. Simplificar `CatalogoClavesSATCard.tsx`

- Importar todo lo anterior desde `.parts`.
- Eliminar `export default CatalogoClavesSATCard` (solo queda el export nombrado, que es el que usa `TabFacturacion.tsx`).
- Queda ~120 líneas (bajo el límite de 200).

### 3. Verificación

- `bunx tsgo --noEmit` para typecheck.
- Confirmar que `TabFacturacion.tsx` sigue funcionando (usa el import nombrado).

## Riesgo

Nulo. Es refactor puro — sin cambios de comportamiento, sólo separación de archivos y limpieza del default export.

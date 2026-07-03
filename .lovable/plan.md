# Simplificar Catálogo de productos — quitar Prioridad y Notas de la UI

## Alcance

Ocultar los campos **Prioridad** y **Notas** de la tarjeta `CatalogoClavesSATCard` (columnas de tabla + inputs del formulario de edición/alta). **No** tocar la BD: las columnas `prioridad` y `notas` en `catalogo_claves_sat` se conservan porque `prioridad` sigue siendo usada por el resolver legacy `resolver_clave_sat` (fallback ILIKE para proformas viejas). Los inserts nuevos usan el default `100` de la BD.

## Analogía

Es como quitar dos casillas del formulario del menú del restaurante que ya nadie llenaba: el mesero (usuario) ve un formulario más limpio, pero la cocina (BD + resolver) sigue funcionando con sus defaults internos.

## Cambios

### 1. `CatalogoClavesSATCard.tsx`

- Quitar de la query `select` los campos `prioridad` y `notas` (dejar sólo lo que la UI muestra).
- Quitar `.order("prioridad", { ascending: true })`; ordenar solo por `patron` alfabético.
- Quitar `prioridad` y `notas` del `buildPayload` — la BD llenará el default de `prioridad` (100) y `notas` quedará NULL.
- Quitar `<TableHead>` de Prioridad y Notas, y las `<TableCell>` correspondientes en la fila de lectura.
- Ajustar `colSpan` de la fila "vacío/loading" de 8 a 6.
- `startEdit`: quitar los campos `prioridad` y `notas` del `setDraft`.

### 2. `CatalogoClavesSATCard.parts.tsx`

- `Row`: quitar `prioridad` y `notas`.
- `Draft`: quitar `prioridad` y `notas`.
- `EMPTY_DRAFT`: quitar esas dos claves.
- `EditRow`: quitar los `<TableCell>` con `<Input>` de prioridad y notas.

### 3. Versión y changelog

- `APP_VERSION` → `13.170.2`.
- Entrada breve en `CHANGELOG.md`.

## Fuera de alcance

- No hay migración. Las columnas `prioridad` y `notas` siguen en la tabla.
- No se toca `resolver_clave_sat` — sigue usando `prioridad` internamente con el default 100.
- No se toca `ProductoServicioSelect` ni la lógica de cotización (nunca leyó estos campos).

## Riesgo

Nulo. Cambio puramente presentacional. La tabla ordenada por nombre en lugar de prioridad es más natural para el usuario.

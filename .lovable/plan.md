# Fix ESLint react-refresh warnings — separar constantes de componente

## Diagnóstico

ESLint marca 5 warnings en `CatalogoClavesSATCard.parts.tsx` con la regla `react-refresh/only-export-components`. El motivo: el archivo `.tsx` exporta a la vez el componente `EditRow` **y** constantes/tipos/helpers (`EMPTY_DRAFT`, `UNIDADES_SAT`, `TIPO_IVA_LABEL`, `TIPO_IVA_VARIANT`, `tasaFromTipo`). Fast Refresh de Vite requiere que un archivo `.tsx` exporte **solo componentes** para poder hacer hot-reload.

## Analogía

Es como tener el interruptor de luz junto con el manual de la lámpara en la misma caja: cuando reemplazas el interruptor (edición del componente), Vite se marea porque no sabe si también cambió el manual. La solución es separar: un archivo para el interruptor (componente), otro para el manual (constantes).

## Cambios

### 1. Nuevo archivo `CatalogoClavesSATCard.constants.ts`

Mover ahí (desde `.parts.tsx`):
- Tipo `TipoIva`.
- Interfaces `Row` y `Draft`.
- Constantes `EMPTY_DRAFT`, `UNIDADES_SAT`, `TIPO_IVA_LABEL`, `TIPO_IVA_VARIANT`.
- Helper `tasaFromTipo`.

### 2. `CatalogoClavesSATCard.parts.tsx` queda sólo con `EditRow`

- Elimina todas las constantes/tipos.
- Importa `Draft`, `TipoIva`, `UNIDADES_SAT` desde `./CatalogoClavesSATCard.constants`.
- Único export: `EditRow`.

### 3. `CatalogoClavesSATCard.tsx`

- Ajustar imports: `Row`, `Draft`, `EMPTY_DRAFT`, `TIPO_IVA_LABEL`, `TIPO_IVA_VARIANT`, `tasaFromTipo` vienen de `.constants`; `EditRow` sigue viniendo de `.parts`.

### 4. Versión y changelog

- `APP_VERSION` → `13.170.3`.
- Entrada breve en `CHANGELOG.md`.

## Fuera de alcance

Sin cambios de comportamiento, sin BD, sin tests nuevos.

## Riesgo

Nulo. Es solo re-organización de imports para respetar la regla de Fast Refresh.

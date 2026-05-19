# Eliminar opción "Duplicar" en embarques y cotizaciones

## Alcance

Quitar todos los puntos de entrada en UI para duplicar embarques y cotizaciones, para todos los usuarios (sin tocar la lógica del backend ni los servicios, para evitar regresiones en otras pantallas y permitir reactivarlo si más adelante se decide).

## Cambios por archivo

### Embarques

1. **`src/components/embarque/EmbarqueRowActions.tsx`** — quitar el `DropdownMenuItem` "Duplicar" y la prop `onDuplicar`.
2. **`src/components/embarque/embarqueColumns.tsx`** — quitar la prop/uso `onDuplicar` que se pasa a `EmbarqueRowActions`.
3. **`src/hooks/embarque/useEmbarquesPageController.ts`** — quitar el state `embarqueADuplicar`/`setEmbarqueADuplicar`, eliminar `onDuplicar` del armado de columnas y dejar de exportarlos.
4. **`src/pages/embarques/Embarques.tsx`** — quitar el import y render de `DialogDuplicarEmbarque` y las referencias `embarqueADuplicar`/`setEmbarqueADuplicar`.
5. **`src/components/embarque/EmbarqueDetalleHeader.tsx`** — quitar el `DropdownMenuItem` "Duplicar" y la prop `onAbrirDuplicar`.
6. **`src/pages/embarques/EmbarqueDetalle.tsx`** — quitar el state `dialogDuplicarAbierto`, el render de `DialogDuplicarEmbarque` y la prop pasada al header.

### Cotizaciones

7. **`src/components/cotizacion/columnsParts/accionesCell.tsx`** — quitar el `DropdownMenuItem` "Duplicar" y la prop `onDuplicar`.
8. **`src/components/cotizacion/cotizacionesColumns.tsx`** — quitar el cableo `onDuplicar: c.duplicar` y dependencia del `useMemo`.
9. **`src/hooks/cotizacion/useCotizacionesPageController.ts`** — quitar el `useDuplicarCotizacion`, la función `duplicar` y su export en el retorno del hook.

### Versionado y changelog

10. **`src/constants/appVersion.ts`** → bump a **8.223.0**.
11. **`src/content/changelog/v8/chunks/0.ts`** y **`src/content/changelogData.ts`** → entrada 8.223.0 explicando la eliminación.

## Lo que NO se toca

- `src/components/embarque/DialogDuplicarEmbarque.tsx`, `src/services/embarque/mutations.ts` (función `duplicarEmbarque`), `src/services/cotizacion/conversiones/duplicar.ts` y `src/hooks/cotizacion/mutations/useDuplicarCotizacion.ts` quedan en el repo como código muerto, sin imports activos. Esto deja la puerta abierta a reactivarlo sin reimplementar nada y evita un refactor profundo en esta iteración.
- RLS, RPCs y demás lógica de servidor no cambian.

## Validación

- `/embarques`: menú de acciones por fila ya no muestra "Duplicar"; detalle del embarque tampoco.
- `/cotizaciones`: menú de acciones por fila ya no muestra "Duplicar".
- Build sin warnings de imports faltantes; TypeScript verde.

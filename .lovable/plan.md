## Problema

Al entrar a `/facturacion`, el rango de fechas viene **precargado con el mes en curso** (día 1 → hoy). Se ve en `useFacturacionDateRange.ts` línea 49:

```ts
if (!hasQp) return { desde: startOfMonth(), hasta: new Date() };
```

Los otros filtros (Estado, Cliente, search) ya arrancan en "todos"/vacío — no tocan nada.

## Cambio

Sólo un archivo: `src/features/facturacion/hooks/useFacturacionDateRange.ts`.

1. **Sin URL params → rango vacío** (`{ desde: null, hasta: null }`) en lugar de mes en curso.
2. **Simplificar `limpiar()`**: al ya no existir el default "mes en curso", ya no hace falta el marcador de strings vacías (`params.set("desde", "")`). Basta con `params.delete("desde"); params.delete("hasta")`.
3. Actualizar el comentario del encabezado del hook: "Por defecto: sin filtro (rango abierto)."
4. Ajustar el test `useFacturacionDateRange.test.tsx` si asume el default de mes en curso.

## Efecto en la UI

- Al abrir `/facturacion`: tabla muestra **todas** las facturas (sin recorte por fecha), no aparecen chips de fecha activos, el badge "Filtros (N)" arranca en 0.
- El usuario puede seguir aplicando rangos manualmente desde el Sheet de filtros; nada más cambia.

## Versión

- Bump `APP_VERSION` a `13.148.2`.
- Entrada en `CHANGELOG.md`: "Facturación entra sin filtro de fechas precargado (antes: mes en curso)."

## Cambio

Renombrar las dos entradas del módulo de Costeo en el sidebar para que el propósito de cada una sea evidente a primera vista.

| Antes | Después |
|---|---|
| Buscar tarifa | **Comparador Top 3** |
| Tarifas marítimas | **Catálogo de tarifas** |

Las rutas (`/costeo/buscar` y `/costeo/tarifas`) y todo el código interno no cambian — es sólo el `title` que aparece en el sidebar.

## Archivos

1. **`src/components/layout/sidebarItems.ts`** (líneas 100-101) — actualizar los dos `title` en `SIDEBAR_COSTEO_ITEMS`.
2. **`CHANGELOG.md` + `src/constants/appVersion.ts`** — entrada nueva `13.299.21` describiendo el rename.

## Fuera de alcance

- No se tocan los títulos internos de las páginas (`PageHeader` "Buscar tarifa" y "Tarifas marítimas"): si más adelante quieres alinearlos también, lo hacemos en un segundo paso.
- No se cambian rutas ni permisos.

## Analogía

Es como cambiar los letreros de dos puertas de la oficina: una decía "Tarifas" y la otra "Tarifas" — ahora una dice **"Comparar"** y la otra **"Archivo"**, así nadie se equivoca de puerta. Adentro todo sigue igual.

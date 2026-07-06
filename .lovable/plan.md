## Problema

Al exportar CSV desde la tabla de embarques, el filtro **"Alerta"** (badges de sidebar: por vencer, vencidos, en puerto, etc.) **no se aplica**, por lo que el CSV incluye embarques que la UI ocultó.

### Causa raíz

`useEmbarquesPageController.exportarCsv` sólo aplica en el CSV:
- Los filtros server-side (búsqueda, modo, cliente, operador, fechas).
- El filtro de estado (client-side, ya cubierto).

Pero **nunca lee `filterAlerta` ni el `alertasResumen`** que en la vista sí recorta los resultados (ver `useEmbarquesPageState.ts` líneas 95-112). Por eso el CSV trae "una lista mucho más grande".

## Solución

Replicar el mismo recorte por alerta que hace la vista, dentro de `exportarCsv`:

1. En `useEmbarquesPageController.ts`:
   - Leer `state.filterAlerta` y el set de IDs de la alerta activa (exponerlo desde `useEmbarquesPageState` como `alertIdSet` — hoy es interno).
   - Después de `filtradosPorEstado`, aplicar:
     ```ts
     const filtradosFinal = state.filterAlerta === "todos" || !alertIdSet
       ? filtradosPorEstado
       : filtradosPorEstado.filter((e) => alertIdSet.has(e.id));
     ```
   - Usar `filtradosFinal` para la validación de "sin datos", el `exportToCsv` y el toast.

2. En `useEmbarquesPageState.ts`:
   - Agregar `alertIdSet` y `filterAlerta` al objeto retornado (ya se calculan internamente, sólo hay que exponerlos).

3. Tests:
   - Añadir caso en `useEmbarquesPageController.test.tsx`: con `filterAlerta = "por_vencer"` y `alertIdSet` de 2 IDs, el CSV sólo debe contener esos 2 registros.

4. Versionado:
   - Bump `APP_VERSION` a `13.205.2`.
   - Entrada en `CHANGELOG.md`: *Fix: exportar CSV de embarques respeta el filtro de alertas del sidebar.*

## Archivos a tocar

- `src/features/embarques/hooks/useEmbarquesPageState.ts` (exponer `alertIdSet`, `filterAlerta`)
- `src/features/embarques/hooks/useEmbarquesPageController.ts` (aplicar filtro alerta antes de generar CSV)
- `src/features/embarques/hooks/__tests__/useEmbarquesPageController.test.tsx` (nuevo caso)
- `src/constants/appVersion.ts`
- `CHANGELOG.md`

## Analogía para principiante

Piensa en el filtro de alertas como un **colador extra** que la tabla usa en pantalla pero que quedó fuera de la máquina exportadora. El CSV pasa la fruta por los otros coladores (cliente, fecha, etc.) pero olvida el de alertas, así que caen frutas de más. Vamos a instalarle ese colador también al exportador.
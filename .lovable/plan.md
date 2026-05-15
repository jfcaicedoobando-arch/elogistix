## Contexto

Hoy la carta "Cargas activas por cliente" muestra dos métricas inconsistentes:

1. **Número grande ≠ suma de chips.** El RPC `dashboard_details` devuelve `total = count(*)` de todos los embarques activos del cliente (cualquier `estado_real` distinto a EIR/Cerrado/Cancelado). Pero la UI solo pinta chips para 5 estados fijos (`Confirmado`, `En Tránsito`, `Arribo`, `En Aduana`, `Entregado`). Cualquier embarque con un estado fuera de esa lista (p. ej. en modos no Marítimo+Importación con valores como `Nuevo`, `Operación`, etc.) suma al total pero no aparece en ningún chip.
2. **Barra/porcentaje engañosos.** La barra es relativa al cliente #1 del top, así que el líder siempre marca 100%. Se lee como "este cliente representa X% del negocio" cuando en realidad es "X% del cliente más grande del top 10".

## Cambios

### 1. Total = suma de chips visibles (frontend, sin tocar el RPC)

En `src/components/dashboard/CargasActivasClienteCard.tsx`:

- Calcular el total mostrado como la suma de `c.desglose` sobre los 5 estados de `ESTADOS_ORDEN`, en lugar de leer `c.total` crudo.
- Si el desglose suma 0 (cliente con embarques activos pero todos en estados fuera de la lista), no renderizar la fila — así nunca queda un número grande sin chips que lo expliquen.

No tocamos el RPC: el campo `total` queda disponible por compatibilidad pero la carta deja de usarlo. Esto evita migración SQL y mantiene `dashboard_details` estable para otros consumidores.

### 2. Barra de proporción = % sobre el total activo de TODOS los clientes

- Añadir `totalActivosGlobal` derivado del payload del dashboard. Como el RPC ya solo trae el Top 10, necesitamos el universo completo. Dos opciones:
  - **Opción A (preferida):** ampliar `dashboard_details` agregando un campo escalar `cargasActivasTotal = count(*) FROM activos WHERE cliente_id IS NOT NULL` junto a `cargasPorCliente`. Migración pequeña, parser actualizado.
  - Opción B: calcular el denominador en el cliente sumando solo el top 10 (sería en realidad la otra opción del questionnaire que el usuario descartó). Se descarta.
- En la UI, `width = (totalCliente / totalActivosGlobal) * 100`, con un mínimo visual de 4px (no 8% del ancho) para que clientes pequeños no se vean inflados.
- Etiqueta de porcentaje: redondeo normal, sin forzar mínimo. Tooltip opcional: `"{n} de {total} cargas activas"`.

### 3. Parser y tipos

`src/lib/parsers/dashboard.ts`:
- Agregar `parseCargasActivasTotal(stats): number`.
- Exportar el nuevo número desde `useDashboardData`.

`src/components/dashboard/CargasActivasClienteCard.tsx`:
- Nueva prop `totalActivosGlobal: number`.
- Recalcular `total` y `proporcion` localmente.

### 4. Migración SQL

Editar `dashboard_details()` para agregar al JSON final:
```
'cargasActivasTotal', (SELECT count(*) FROM activos WHERE cliente_id IS NOT NULL)
```

### 5. Versionado y changelog

- Bump patch en `src/constants/appVersion.ts`.
- Entrada nueva en `src/content/changelog/v8/chunks/0.ts` y rotación en `src/content/changelogData.ts` (manteniendo el límite de 10).

## Detalles técnicos

- Sin cambios en `EstadoFiltro` ni en el orden de chips.
- Tests: actualizar `src/lib/parsers/__tests__/dashboard.test.ts` para cubrir `parseCargasActivasTotal` y verificar que el card recalcula `total` desde el desglose.
- Sin impacto en otros consumidores: `cargasPorCliente[i].total` queda intacto en el payload; solo la UI lo ignora.

## Archivos afectados

- `supabase/migrations/<timestamp>_dashboard_cargas_activas_total.sql` (nuevo)
- `src/lib/parsers/dashboard.ts`
- `src/lib/parsers/__tests__/dashboard.test.ts`
- `src/hooks/dashboard/useDashboardData.ts`
- `src/components/dashboard/CargasActivasClienteCard.tsx`
- `src/pages/dashboard/Dashboard.tsx` (pasar la nueva prop)
- `src/constants/appVersion.ts`
- `src/content/changelog/v8/chunks/0.ts`
- `src/content/changelogData.ts`

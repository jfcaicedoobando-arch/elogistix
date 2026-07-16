## Problema

El KPI **"Facturado mes"** (y la mini-tendencia de 6 meses) del card superior de Facturación filtra únicamente `estado ≠ 'Cancelada'`. Eso deja pasar **borradores** (`estado = 'Borrador'`) — que aún no están timbrados y no son ingreso facturado.

Hoy el mes en curso no tiene borradores, así que la suma coincide de casualidad. En cuanto haya un borrador con `fecha_emision` dentro del mes (por ejemplo, un borrador de sustitución creado desde el wizard) el KPI infla la cifra.

Referencia: `src/features/facturacion/services/dashboardEjecutivo.ts` línea ~110 usa `.neq("estado", "Cancelada")`. En cambio, `src/features/facturacion/services/cobranza.ts` y `estadoCuenta.ts` ya usan la lista blanca correcta `ESTADOS_ACTIVOS = ["Emitida", "Parcialmente pagada", "Vencida", "Pagada"]`.

## Solución

1. **`src/features/facturacion/services/dashboardEjecutivo.ts`**
   - Reemplazar `.neq("estado", "Cancelada")` por `.in("estado", ["Emitida","Parcialmente pagada","Vencida","Pagada"])` en la consulta de `facturas`.
   - Exportar la constante `ESTADOS_FACTURADO` para reutilizarla desde tests y del sumador del footer.

2. **`src/features/facturacion/utils/sumarFacturas.ts`**
   - Extender el filtro: además de saltar `Cancelada`, saltar `Borrador` (el footer de la tabla Emitidas ya rara vez los ve, pero cerramos el hueco por consistencia con el KPI).
   - Ajustar `conteoCanceladas` para que siga midiendo solo canceladas; los borradores se ignoran sin contarse.

3. **Tests**
   - Actualizar `src/features/facturacion/services/__tests__/` (o crear uno nuevo, `dashboardEjecutivo.test.ts`) que arme un dataset con mezcla `Emitida / Borrador / Cancelada` y verifique que solo se suman los estados facturados.
   - Añadir caso a `sumarFacturas.test.ts` para asegurar que el borrador no infla `mxnEquivalente`.

4. **Tooltip del KPI**
   - Ajustar `buildFacturadoUi` en `DashboardEjecutivoFacturacion.tsx` para que el hint diga "Excluye canceladas y borradores" (ambos idiomas de estado).

5. **Versionado**
   - `CHANGELOG.md` (raíz) + bump `APP_VERSION` a `13.301.18` con nota:
     _"Fix KPI Facturado mes: excluye borradores además de canceladas."_

## Fuera de alcance

- No tocar "Cobrado mes" en este cambio (el usuario indicó que el problema está en "Facturado mes"). Queda anotado que actualmente no valida si el pago apunta a una factura cancelada.

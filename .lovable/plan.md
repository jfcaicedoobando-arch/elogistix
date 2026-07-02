## Problema (Sentry JAVASCRIPT-REACT-1M · 48 eventos / 6 usuarios)

Un usuario con rol `coordinador_logistico` pulsó **"Convertir a factura"** en una proforma. La RPC de la base de datos responde con `P0001: No tienes permiso para convertir proformas a factura`. La UI muestra el `notifyError`, pero el error también viaja a Sentry desde el `mutationCache.onError` global de React Query. Resultado: alertas ruidosas por lo que en realidad es una validación de negocio esperada.

**Analogía:** es como si cada vez que alguien mete una tarjeta sin permiso en la cerradura, sonara la alarma antirrobo. La cerradura ya hizo su trabajo; no necesitamos avisar al servicio de emergencia.

## Causa raíz

1. El botón **Convertir a factura** se muestra a cualquier rol; sólo depende del estado de la proforma. La RPC restringe a `admin_org`, `super_admin`, `contador`.
2. El reportero global de React Query (`src/lib/query/queryClient.ts`) reporta a Sentry TODO error de mutación, incluidos los errores de negocio con `code = P0001` (permisos, validaciones de reglas).

## Cambios (frontend / presentación)

1. **`src/features/proformas/components/AccionesProforma.tsx`**
   - Usar `usePermissions().canEmitirFactura` (ya existe con el set correcto de roles).
   - En `computarFlags`, añadir `canEmitirFactura` al cálculo de `puedeConvertir`.
   - Si el usuario no puede emitir factura pero la proforma está lista, no mostrar el botón (el `mostrarHint` sigue vigente sólo cuando falta la aceptación del cliente).

2. **`src/features/facturacion/components/TabProformas.tsx`**
   - Aplicar el mismo gate `canEmitirFactura` al botón/acción masiva "Fusionar en factura".

3. **`src/lib/query/queryClient.ts`** (reportero Sentry)
   - Antes de `captureException`, descartar errores cuyo `code` sea de la familia `P0001` (Postgres `RAISE EXCEPTION`) — son validaciones de negocio esperadas, no bugs.
   - Mantener el reporte para el resto (fallos reales de red, RLS `42501`, etc.).
   - Añadir breadcrumb en su lugar para conservar rastro sin generar issue.

4. **Versionado**
   - Bump a `13.145.6` en `src/constants/appVersion.ts`.
   - Entrada en `CHANGELOG.md`: "Gate UI del botón Convertir a factura por rol + filtrar P0001 de Sentry".

## Detalles técnicos

- No se toca la RPC ni las políticas RLS; la restricción de servidor se mantiene como defensa en profundidad.
- El filtro en `queryClient` mira `err.code === 'P0001'` (via un type guard estrecho) para no cambiar el comportamiento de errores de infraestructura.
- No requiere tests nuevos: `usePermissions` ya está cubierto, y el cambio en `AccionesProforma` es puramente condicional.

## Verificación

- Build/tsgo y tests de arquitectura (`architecture-baseline`, `audit-report`).
- Manualmente: entrar como `coordinador_logistico`, ver proforma aceptada → el botón ya no aparece. Entrar como `contador`/`admin_org` → botón visible y flujo intacto.

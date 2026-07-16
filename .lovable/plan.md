## Problema

En `FacturaDetalle.tsx` (línea 72) el botón **Volver** está fijo a `navigate("/facturacion")`. Por eso, después de timbrar el borrador sustituto (F988) creado desde F975, al pulsar Volver el usuario aterriza en el listado en lugar de regresar a F975 para continuar con la cancelación (paso 3 del wizard de sustitución).

## Solución

Hacer el botón Volver "consciente" del contexto de sustitución:

1. **Detectar si la factura actual es un borrador sustituto**  
   Al entrar a `/facturacion/:id`, revisar `sessionStorage` en busca de una clave `sustitucion:*` cuyo `nuevaId` == `id` actual. Si existe, el "originalId" es la clave (ya persistida por `writePersisted` en `DialogSustituirFactura`).

2. **Comportamiento del botón Volver en `FacturaDetalle.tsx`**
   - Si hay factura original detectada → `navigate(/facturacion/<originalId>)` y etiqueta **"Volver a factura <numero-original>"** (fallback: "Volver a factura original" si aún no cargó el número).
   - Si no → conservar el comportamiento actual: `navigate("/facturacion")` con etiqueta "Volver".

3. **Helper de lectura**  
   Añadir `findOriginalFacturaId(nuevaId)` en `src/features/facturacion/components/sustitucion/persistence.ts` que recorra `sessionStorage`, filtre claves con prefijo `sustitucion:`, valide payload con el type-guard existente y devuelva el `facturaId` original si coincide (respetando el TTL de 24 h y limpiando entradas expiradas).

4. **Etiqueta con número original (opcional pero UX+)**  
   Consultar solo `numero` de la factura original vía React Query (`fetchFacturaNumero`), habilitado únicamente cuando `originalId` existe, para mostrar "Volver a factura F975".

## Detalles técnicos

- Archivos tocados:
  - `src/features/facturacion/components/sustitucion/persistence.ts` — nueva función `findOriginalFacturaIdFor(nuevaId)`.
  - `src/features/facturacion/routes/FacturaDetalle.tsx` — usar el helper y ajustar el `onClick`/label del botón Volver (también en el estado "no encontrada").
- Sin cambios de UI fuera del botón. Sin cambios de backend.
- No afecta el flujo normal (facturas abiertas desde el listado siguen viendo "Volver" → `/facturacion`).
- Al completar la cancelación (paso 3), `clearPersisted(facturaId)` ya limpia la entrada, así que el botón vuelve a su comportamiento estándar.

## Verificación

- Manual: repetir el flujo F975 → crear borrador → timbrar F988 → **Volver** debe regresar a F975.
- Deep-link directo a F988 sin `sessionStorage`: Volver sigue yendo al listado.
- Actualizar `APP_VERSION` y agregar entrada en `CHANGELOG.md`.

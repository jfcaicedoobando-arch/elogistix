# Arreglar carga de "Facturas de proveedor recibidas" (tab Costos)

## Qué está pasando
La consulta de facturas entrantes pide al proveedor una columna llamada `origen`, pero en la base de datos la columna se llama `origen_proveedor`. Postgres responde `column proveedores_1.origen does not exist` y la tarjeta muestra "No pudimos cargar la información".

Verificado: en `proveedores` existe solo `origen_proveedor` (Nacional / Extranjero).

## Cambios

1. `src/features/cxp/services/facturasEntrantes.types.ts`
   - En el select embebido, pedir `proveedores:proveedor_id(nombre, origen_proveedor)`.
   - Ajustar el tipo de la fila: `proveedores?: { nombre: string | null; origen_proveedor?: string | null } | null`.

2. Consumidores del dato (cálculo de `esNacional`, que controla el badge "Falta XML"):
   - `src/features/embarques/components/entrantes/FacturaEntranteItem.tsx`
   - `src/features/embarques/components/TabFacturasEntrantes.tsx`
   Leer `row.proveedores?.origen_proveedor` en lugar de `.origen`.

3. Revisar si algún otro punto (buzón CxP) usa el mismo alias y alinearlo.

4. Test de regresión ligero que valide que el select no incluye `origen` suelto para `proveedores`, para que no vuelva a romperse.

5. Actualizar `CHANGELOG.md` y subir `APP_VERSION` a `13.361.3`.

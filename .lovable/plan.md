# Corregir el destino de los checks de comisiones en el checklist de cierre

## Problema

En el tab **Cierre**, los checks "Comisión devengada calculada" y "Comisiones devengadas definitivas" llevan a `?tab=pnl&focus=comision`. Ese `focus` en el tab P&L apunta a la tabla **Pendiente de pago a proveedores** (`PnlProveedoresTable`), no a ninguna información de comisiones. Es decir: el clic manda a un lugar donde no se puede resolver el pendiente.

## Solución

Redirigir esos dos checks al módulo **Comisiones** (`/comisiones`), ya filtrado por el expediente del embarque, que es donde realmente se ven y se resuelven las comisiones devengadas.

- Destino: `/comisiones?q=<expediente>` (la pestaña "Devengadas" ya busca por expediente/factura/cliente vía el parámetro `q` en la URL).
- CTA: "Ir a Comisiones" (hoy dice "Ver P&L").
- Se abre en pestaña nueva, igual que el resto de los checks accionables.

Los checks de utilidad/margen (`pnl_margen_minimo`, `margen_minimo`) se quedan en P&L: ahí sí está la información correcta.

## Cambios técnicos

1. `src/features/embarques/utils/cierreCheckMeta.ts`
   - Permitir que la función `ruta` reciba el expediente del embarque además del id.
   - `comision_calculada` y `comisiones_definitivas`: ruta → `/comisiones?q=<expediente>` (sin `q` si no hay expediente), `ctaLabel` → "Ir a Comisiones".
2. Propagar el expediente hasta el ítem del checklist:
   - `TabCierre` recibe `expediente` desde `EmbarqueDetalleTabs` y lo pasa a `CierreChecklistCard` → `CierreChecklistFase` → `CierreCheckItem`.
3. Corregir la ruta como enlace externo al detalle del embarque (ya soportado por `CierreCheckItem`, que abre `target="_blank"`).
4. Tests: actualizar `src/features/embarques/utils/__tests__/cierreCheckMeta.test.ts` con un caso que verifique que las reglas de comisión apuntan a `/comisiones` con `q`.
5. `CHANGELOG.md` + bump de `APP_VERSION`.

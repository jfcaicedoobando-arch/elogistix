## Problema

La columna **Estado** de la tabla de proformas muestra solo `estado_proforma` (que solo tiene dos valores: `pendiente` → aún no facturada, `facturada` → ya se generó factura). Por eso PRO-093 aparece como "Pendiente" aunque el cliente ya la aceptó: la aceptación del cliente vive en otro campo (`estado_cliente`: `pendiente` / `aceptada` / `rechazada`) que sí se lee en el detalle.

## Solución (solo UI)

Enriquecer el badge de la columna Estado en `src/features/facturacion/components/proformasColumns.tsx` con lógica por prioridad:

1. `estado_proforma === "facturada"` → **Facturada** (verde)
2. `estado_cliente === "rechazada"` → **Rechazada** (rojo)
3. `estado_cliente === "aceptada"` → **Aceptada** (azul/success suave)
4. resto → **Pendiente cliente** (ámbar)

Así el badge refleja el estado real que el usuario ve al entrar al detalle.

### Detalles

- Solo se toca el `cell` y el `accessorFn`/`sortingFn` de la columna `estado` para que ordene por la nueva prioridad.
- **No** se cambian los tabs de filtro superiores (Todas / Pendiente / Facturada) ni los `counts` — siguen refiriendo al ciclo de facturación, que es lo que usa el equipo contable. Solo cambia el badge visible por fila.
- Bump de versión + entrada en `CHANGELOG.md`.

### Fuera de alcance

- No se modifica la lógica de negocio, RPCs, ni el estado en BD.
- No se agregan nuevos filtros por `estado_cliente` (se puede hacer en un follow-up si lo pides).

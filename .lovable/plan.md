
# Bug — Proforma 0961 sigue "facturada" tras borrar el borrador

## Causa raíz

La conversión de proforma a factura y el borrado del borrador **no hablan el mismo idioma**:

- Al **convertir** (`convertir_proformas_a_factura`): la factura guarda el link (`facturas.proforma_id = proforma.id`) y la proforma se marca `estado_proforma = 'facturada'`. **No** se llena `proformas.factura_id` (esa columna queda `NULL`).
- Al **borrar el borrador** (`eliminar_factura_borrador`): intenta revertir con `UPDATE proformas WHERE factura_id = p_factura_id`. Como esa columna nunca se llenó, el `UPDATE` no toca ninguna fila y la proforma queda huérfana en estado `facturada`.

Verificado en DB para PRO-2026-0961 (id `2f00be9a…`):
- Factura draft `b163c205…` (USD) creada 22:26 — ya eliminada, no aparece en `facturas`.
- Bitácora `factura.borrador_generado` guardó `proforma_ids = [2f00be9a…]`.
- Proforma sigue con `estado_proforma='facturada'`, `fecha_facturacion=2026-07-07`.

Analogía: cuando entregas el paquete al mensajero, le pones un sticker rojo a la caja ("enviado"). Si el mensajero devuelve el paquete, quien lo recibe se olvida de quitar el sticker rojo — la caja se ve como "enviada" para siempre.

## Solución (2 pasos)

### 1) Migration — arreglar `eliminar_factura_borrador`

Reemplazar el `WHERE factura_id = p_factura_id` por una revert que use las fuentes reales del vínculo:

- **Caso 1:1** (proforma única): leer `v_factura.proforma_id` capturado en el `SELECT * INTO v_factura`.
- **Caso 1:N** (consolidada, `proforma_id NULL` en la factura): leer el array `proforma_ids` desde la última entrada de bitácora `factura.borrador_generado` con `entidad_id = p_factura_id`.

Unir ambos en un `uuid[] v_proforma_ids` y correr:

```sql
UPDATE proformas
   SET estado_proforma   = 'pendiente',
       fecha_facturacion = NULL,
       factura_id        = NULL,  -- por si a futuro se llena
       updated_at        = now()
 WHERE id = ANY(v_proforma_ids);
```

La bitácora final registra `proformas_revertidas = v_proforma_ids` (ya lo hacía).

### 2) Data fix puntual — proforma 0961

Con la RPC nueva ejecutar un `UPDATE` manual sobre la proforma huérfana:

```sql
UPDATE proformas
   SET estado_proforma='pendiente', fecha_facturacion=NULL, updated_at=now()
 WHERE id='2f00be9a-54cb-40de-bb57-204ab163d5b8';
```

Se conserva `estado_cliente = 'aceptada'` (el cliente sí la aceptó; sólo revertimos la parte fiscal).

## Fuera de alcance
- Cambiar la dirección del FK (usar `proformas.factura_id`) — implicaría refactor grande de la conversión y no aporta a este fix.
- Tocar `enforce_proforma_aceptada_before_factura` o `marcar_proforma_facturada`.

## Validación
- Repetir el flujo aceptar → convertir → eliminar borrador con una proforma de prueba: la proforma debe quedar `estado_proforma='pendiente'` con `estado_cliente='aceptada'`.
- Confirmar por SQL que 0961 volvió a `pendiente`.
- `bun run lint` verde.
- Bump `APP_VERSION` → `13.213.36` y entrada en `CHANGELOG.md`.

## Archivos a tocar
- **Migration**: `CREATE OR REPLACE FUNCTION public.eliminar_factura_borrador` con nueva lógica de revert.
- **Data**: `UPDATE` puntual a la proforma 0961.
- `src/constants/appVersion.ts`
- `CHANGELOG.md`

Sin cambios de frontend — el hook y el servicio siguen llamando al mismo RPC.

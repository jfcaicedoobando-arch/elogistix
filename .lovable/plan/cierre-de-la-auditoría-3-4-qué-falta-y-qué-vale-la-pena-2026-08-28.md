# Cierre de la auditoría 3-4: qué falta y qué vale la pena

Revisé el reporte nuevo (26 hallazgos) contra el estado real de la base y del código. **Todos los Critical (C1–C9) y casi todos los High ya quedaron remediados** en las olas anteriores. Verificado directamente:

- C1/C1b: existe `nc_aplicadas_en_moneda_factura` y es la fuente canónica de saldo.
- C6: no hay permiso de borrado de facturas para usuarios y existe el bloqueo `_prohibir_delete_factura`.
- C7: `ensure_demo_membership` ya no es ejecutable por usuarios autenticados.
- C8: índice único de `uuid_fiscal` presente.
- C9: enmascaramiento de costos (`enmascarar_costos_jsonb`) activo.
- C2–C5: 31 candados de organización padre-hijo (`_assert_padre_misma_org`).
- H1: cierre de periodo operando (`_assert_periodo_abierto` + tarjeta de configuración).
- H2, H3, H4, H5 (bloqueo optimista en CxP, Tesorería y contactos), H7, M1–M7, L1 (desempate por id), L2, L3: implementados.

Queda pendiente poco, y sólo dos cosas valen la pena.

## Vale la pena hacer

### 1. H6 — Llaves de organización faltantes en 4 tablas (media prioridad, riesgo real)
`proveedor_facturas`, `proveedor_facturas_conceptos`, `pagos_factura` y `pagos_proveedor` guardan la organización sin llave foránea a `organizations`. Hoy nada rompe, pero una importación o restauración parcial podría dejar registros apuntando a una organización inexistente, invisibles para los filtros de seguridad. Es un candado de una sola migración.

### 2. M8 — Los filtros se pierden al compartir la liga (mejora de uso diaria)
En Embarques, Clientes y Cotizaciones los filtros viven sólo en memoria: si el usuario comparte la URL o usa el botón atrás, pierde lo que había filtrado. Ya existe el hook `useFiltroUrl` usado en Compras y Tesorería; sólo falta aplicarlo a estos tres listados.

## No vale la pena (mi recomendación: cerrar como aceptado)

- **L4 — código muerto de IVA agregado**: el reporte mismo confirma que el resultado es correcto (1.59, por renglón, igual que el SAT). Reescribir una migración de 12 KB sólo por limpieza estética agrega riesgo sin cambiar un solo peso.
- **H8 — reset canónico en CI**: la lista de exenciones de drift ya está vacía y la regla H9 cierra la causa raíz. Montar un job adicional de reset completo de 1,115 migraciones cuesta mucho tiempo de CI para un riesgo ya cubierto.
- **M3 (índice único de correos)**: ya está resuelto por trigger (`_assert_email_unico_org`); el índice sería redundante.

## Detalles técnicos

1. Migración: agregar `FOREIGN KEY (organization_id) REFERENCES public.organizations(id)` en las 4 tablas como `NOT VALID`, verificar que no haya huérfanos y luego `VALIDATE CONSTRAINT`. Sin cambios de RLS ni de permisos.
2. Frontend: migrar `useEmbarquesPageController`, el controlador de Clientes y el de Cotizaciones a `useFiltroUrl` (mismo patrón que `ComprasPagos.tsx`), manteniendo los valores por defecto actuales para no alterar la vista inicial.
3. Actualizar `CHANGELOG.md` y `APP_VERSION`, y anotar en la bitácora de auditoría los hallazgos aceptados sin acción (L4, H8, M3) con su justificación.

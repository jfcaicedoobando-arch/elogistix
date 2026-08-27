# Ola 4 — Cierre de los hallazgos HIGH restantes (auditoría 3)

Las Olas 1–3 ya cubrieron C1–C9, H1, H3 y H4. Quedan cuatro hallazgos HIGH: H2, H5, H6 y H7.

## 1. H2 — Aprobar factura de proveedor sin respaldo (three-way match)

Hoy la validación de aprobación ya revisa que los conceptos cuadren con el subtotal, que no se exceda lo comprometido y que el embarque sea de la misma empresa. Lo que falta: una factura **sin embarque vinculado y sin conceptos ligados a costos** se aprueba sin ningún contraste (hay 36 facturas aprobadas hoy sin embarque, la mayoría probablemente gastos legítimos).

Qué se hará:
- Al aprobar, si la factura no tiene embarque ni un solo concepto ligado a costo acordado, se exige una **justificación escrita** (gasto administrativo, renta, servicios, etc.) capturada en el momento de aprobar.
- Nuevo campo de justificación en la factura de proveedor y su registro en bitácora (quién aprobó, con qué motivo).
- Además, umbral configurable por empresa: arriba de ese monto, la aprobación sin vínculo se **rechaza** en lugar de pedir justificación (default sugerido: 50,000 MXN equivalentes).
- Las 36 facturas ya aprobadas no se tocan (se marcan como heredadas).

Analogía: hoy el visto bueno se firma sin comparar contra el pedido; a partir de ahora, si no hay pedido que comparar, hay que escribir por qué.

## 2. H5 — Ediciones que se pisan sin aviso (bloqueo optimista)

El patrón ya existe en cotizaciones, embarques, clientes, notas de crédito y datos fiscales. Se extiende a los módulos que hoy sobreescriben en silencio:
- Factura de proveedor (edición y actualización de pago a proveedor)
- Tesorería: conciliación y cuentas bancarias
- Contactos de proveedor

Comportamiento: si otro usuario guardó primero, el guardado se detiene con el mensaje ya estándar ("Otro usuario modificó este registro…") en lugar de perder su trabajo.

## 3. H6 — Empresa sin llave de integridad

`proveedor_facturas`, `proveedor_facturas_conceptos`, `pagos_factura` y `pagos_proveedor` guardan la empresa sin llave foránea a `organizations`. Verificado: **0 registros huérfanos hoy**, así que las llaves se pueden crear y validar de inmediato, sin ventana de limpieza.

## 4. H7 — Reseed de la organización demo falla

El reseed borra embarques y clientes pero no las facturas ni pagos generados después, así que falla por integridad si alguien operó en demo. Se corrige el orden de borrado (documentos financieros primero, luego operación y catálogos) para que el reseed sea siempre repetible.

## Fuera de alcance (propuesta aparte)

H8 (reset canónico de base limpia en CI sin exenciones) es trabajo de infraestructura de migraciones, no de producto; conviene tratarlo como una ola propia junto a M6.

## Detalles técnicos

- Migración única con: `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY (organization_id) REFERENCES public.organizations(id)` en las 4 tablas (NOT VALID + VALIDATE en la misma migración, dado que no hay huérfanos).
- `public._cxp_validar_aprobacion(uuid)`: nueva rama fail-closed cuando `embarque_id IS NULL` y no hay `proveedor_facturas_conceptos.concepto_costo_id`; nuevos códigos `LC_CXP_SIN_RESPALDO` y `LC_CXP_SIN_RESPALDO_MONTO`. Columna `justificacion_sin_vinculo text` + `aprobacion_heredada boolean` en `proveedor_facturas`. Umbral en `configuracion` (`compras.umbral_aprobacion_sin_vinculo`), leído por función security definer con `org_scope()`.
- `aprobar_factura_proveedor` recibe la justificación como parámetro opcional (nueva sobrecarga controlada, sin `replace()` de texto — archivo fuente en `supabase/schema/cxp/`).
- Frontend: modal de aprobación pide motivo cuando el backend lo exige; mensajes nuevos en `lcCodeMessages.financiero.ts`.
- Bloqueo optimista con el patrón existente (`expectedUpdatedAt` + `conflictoConcurrenciaError`, `.eq("updated_at", …)` y verificación de filas afectadas) en `proveedorFacturas.update.ts`, `pagoProveedorActualizar.ts`, `conciliacion.ts`, `cuentas.ts`, `contactosProveedor.ts`, y sus hooks de mutación.
- `seed_demo_organization`: borrado en orden de dependencia (pagos → notas de crédito → facturas → conceptos → embarques → catálogos).
- Suite `supabase/tests/ola4_high_restantes.sql`: aprobación sin respaldo rechazada, con justificación aceptada, FKs presentes, reseed demo idempotente tras operar. Tests unitarios de conflicto de concurrencia en los 5 servicios nuevos.
- Sincronizar `supabase/schema/baseline.sql`, subir `APP_VERSION` y registrar en `CHANGELOG.md`.

# Remediación auditoría 3 — cierre de Ola 1 y siguientes olas

La Ola 1 (dinero y seguridad) ya está aplicada en la base: notas de crédito multi-moneda convertidas, `ensure_demo_membership` sólo para el servicio interno, borrado físico de facturas prohibido, `uuid_fiscal` único por organización y dashboard con candado de rol. También quedaron listos el rollback lógico en facturación manual, dos suites SQL de regresión, el manifiesto de migraciones y el baseline del esquema.

Falta cerrar el entregable y seguir con las olas 2 a 4.

## Cierre de Ola 1 (inmediato)

- `CHANGELOG.md` + `APP_VERSION` → `13.770.0`, con los hallazgos C1, C1b, C6, C7, C8 y C9.
- Revisar que la pantalla de cotizaciones siga mostrando costos a los roles autorizados y muestre un aviso claro (sin error crudo) a quien ya no puede verlos.

## Ola 2 — Aislamiento multi-tenant en relaciones (High)

Hoy varias tablas hijas apuntan al padre con una llave simple: un registro puede colgarse de un padre de otra organización si alguien fuerza la petición, y las funciones internas con permisos de servicio amplifican el riesgo.

- Llaves compuestas `(id, organization_id)` en las relaciones críticas: facturas ↔ embarque/cliente/proforma, pagos ↔ factura, conceptos ↔ cotización/embarque, notas de crédito ↔ factura, CxP ↔ proveedor/embarque.
- Validación de organización en las funciones internas que hoy escriben con permisos de servicio.
- Suite SQL que intente cruzar organizaciones en cada relación y espere rechazo.

## Ola 3 — Controles del ciclo comercial y fiscal (High/Medium)

- **Cierre de periodo:** configuración por organización con la fecha de cierre; se bloquea emitir o pagar con fecha anterior (hoy el backdating es libre).
- **Cadena cotización → embarque → factura inmutable:** cotización aceptada no editable, conceptos ya proformados bloqueados, y la proforma sólo puede consolidar conceptos de su propio embarque.
- **`uuid_fiscal` inmutable** una vez timbrado.

## Ola 4 — Deuda y experiencia (Medium/Low)

- Bloqueo optimista con `updated_at` en los formularios financieros que aún no lo tienen.
- Limpieza de código muerto detectado en la auditoría y mensajes de error legibles para los nuevos candados.

## Detalles técnicos

- Cada ola es una migración única con `GRANT`/`REVOKE` explícitos, suite SQL registrada en `supabase/tests/_guards_manifest.txt`, sincronización de `supabase/schema/baseline.sql` y del manifiesto de release, más `CHANGELOG.md` + bump de `APP_VERSION`.
- Los candados nuevos lanzan códigos `LC_*` traducidos en la capa de mensajes del frontend.
- Sin docker en el entorno, el baseline se sincroniza con el mismo formato del dump (ya validado en la Ola 1).

## Orden sugerido

1. Cierre de Ola 1 (changelog + versión).
2. Ola 2 (aislamiento).
3. Ola 3 (controles).
4. Ola 4 (deuda).

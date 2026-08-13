# Cerrar la homologación Cliente ↔ Proveedor: contactos y expediente

Faltan las dos últimas piezas para que ambas fichas se vean y funcionen igual:
el proveedor sólo admite **un** contacto y el cliente **no** tiene expediente
documental.

## Estado actual verificado

- `contactos_cliente` existe (nombre, tipo, correo, teléfono, dirección, borrado lógico) y se muestra en la ficha del cliente con `TablaContactos` + `DialogContacto`.
- `proveedores` sólo guarda tres campos planos: `contacto`, `email`, `telefono`. No existe tabla de contactos de proveedor.
- `proveedor_documentos` existe con vigencias, borrado lógico y pestaña "Documentos" (archivos en el bucket privado `documentos`, prefijo `proveedores/{id}/`).
- La ficha del cliente tiene Información, Embarques, Cotizaciones, Estado de cuenta, CRM y Portal — **no** tiene pestaña de documentos.

## Ola 4A — Contactos múltiples de proveedor

1. Tabla nueva `proveedor_contactos` con el mismo espíritu que `contactos_cliente`: nombre, puesto, área (Operaciones / Facturación / Cobranza / Dirección / Otro), correo, teléfono, extensión, notas, marca de contacto principal, borrado lógico y aislamiento por organización.
2. Regla de negocio: máximo un contacto principal por proveedor; al marcar uno nuevo, el anterior se desmarca automáticamente.
3. Los tres campos actuales del proveedor se conservan y se siembran como contacto principal, para no perder información ni romper pantallas existentes.
4. Nueva pestaña "Contactos" en la ficha del proveedor, con la misma tabla, diálogo y confirmación de borrado que usa el cliente.
5. La tarjeta "Datos generales" muestra el contacto principal y un enlace a la pestaña.

## Ola 4B — Expediente documental del cliente

1. Tabla nueva `cliente_documentos`, espejo de `proveedor_documentos`: tipo, nombre, archivo, fechas de documento y vigencia, notas, tamaño, quién subió y borrado lógico.
2. Catálogo de tipos orientado a cliente: constancia de situación fiscal, comprobante de domicilio, acta constitutiva, poder notarial, identificación del representante, contrato de servicios, carta de crédito, otro.
3. Archivos en el bucket privado existente `documentos`, bajo `clientes/{cliente_id}/`, con las mismas reglas que proveedor: sólo personal de la organización dueña sube, lee y borra, y los documentos en papelera no son descargables.
4. Nueva pestaña "Documentos" en la ficha del cliente reutilizando los componentes del expediente de proveedor (semáforo de vigencia, KPIs de cobertura, subir/eliminar).
5. La constancia fiscal ya cargada por el flujo de CSF del cliente queda visible en el expediente en lugar de vivir aparte.

## Ola 4C — Detalles compartidos

- Extraer los componentes comunes (tabla de contactos, tarjeta de expediente, diálogo de subida) a `src/components/shared` o a un módulo `features/expediente`, para que cliente y proveedor consuman el mismo código y no se vuelvan a desincronizar.
- Documentar el patrón en `docs/design-system.md`.

## Notas técnicas

- Dos migraciones: `proveedor_contactos` y `cliente_documentos`, cada una con GRANT explícito, RLS por `organization_id`, índices parciales `WHERE deleted_at IS NULL` y trigger de `updated_at`. El contacto principal se garantiza con índice único parcial.
- Políticas de storage nuevas para el prefijo `clientes/` del bucket `documentos`, con validación de tenencia vía EXISTS contra `clientes` y exclusión de registros con `deleted_at`.
- Reutilizar `validarVigenciaDocumento` y `calcularExpediente` del dominio de proveedor, parametrizando el catálogo de tipos y los tipos con vigencia obligatoria.
- Respetar Power of 10: archivos ≤200 líneas, esquemas Zod en la frontera de lectura, sin `any`, cleanup en effects; agregar pruebas de dominio para la regla de contacto principal y el catálogo de tipos del cliente.
- Al cerrar: bump de `APP_VERSION` y entrada en `CHANGELOG.md`.

## Alcance excluido

- No se migran ni se eliminan los campos planos de contacto en `proveedores` en esta entrega (queda como limpieza posterior, ya sin dependencias de UI).

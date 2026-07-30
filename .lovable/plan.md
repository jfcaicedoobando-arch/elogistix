# Buzón CxP: el error "Este CFDI ya está capturado" es un callejón sin salida

## Qué pasó

En `/compras/buzon` se intentó capturar una factura cuyo CFDI ya estaba registrado. La base de datos rechazó el guardado (correcto: existe un índice único por organización + UUID fiscal), pero el mensaje que vio el usuario fue genérico — "Ya existe una factura viva con este UUID fiscal en tu organización" — sin decir **cuál** factura, sin botón para verla y después de haber llenado todo el formulario.

Datos verificados en la base:

- El único documento vivo del buzón de Elogistix (UUID `F2D6DAD2-…CEE0F`) ya está en estado `capturada` y ligado a la factura **FP-000056**.
- El índice único `ux_proveedor_facturas_uuid_fiscal_org` compara el UUID **tal cual** (texto sensible a mayúsculas/minúsculas) y los UUID guardados están mezclados: casi todos en mayúsculas y al menos uno en minúsculas.
- El aviso amigable dentro del modal (`CfdiDuplicadoAlert`) se apoya en una búsqueda que también compara texto exacto y que, si falla por cualquier motivo, devuelve "no hay duplicado" en silencio.

Diagnóstico no confirmado: no puedo afirmar todavía si el aviso previo no apareció por diferencia de mayúsculas, porque la búsqueda falló en silencio, o porque el documento no traía UUID cuando se abrió la captura. Por eso el primer paso del plan es reproducir y dejar traza, no adivinar.

## Qué se va a hacer

### 1. Confirmar la causa (primero)

Reproducir la captura del documento ya capturado y registrar qué devuelven la puerta de validación y la búsqueda de duplicado. Con eso se sabe cuál de las tres hipótesis aplica antes de tocar la lógica.

### 2. Que la detección de duplicados no falle en silencio

- Comparar el UUID sin distinguir mayúsculas/minúsculas ni espacios, y acotar la búsqueda a la organización del usuario.
- Si la búsqueda falla (red o permisos), decirlo explícitamente en vez de tratarlo como "no hay duplicado".
- Normalizar el UUID a mayúsculas en el momento de guardar, para que el índice único y las búsquedas hablen el mismo idioma. Incluye una migración que unifique los registros existentes.

### 3. Avisar antes, no al guardar

- En el buzón, marcar con una insignia los documentos cuyo CFDI ya está capturado y deshabilitar "Capturar factura", ofreciendo en su lugar "Ver factura" y "Vincular a factura existente".
- La puerta de validación previa (`validar_captura_entrante`) debe detectar el duplicado también cuando el documento no trae UUID guardado, leyéndolo del XML adjunto al momento.

### 4. Que el mensaje sea accionable

Cuando el choque ocurra de todos modos (por ejemplo, dos personas capturando a la vez), el mensaje debe nombrar la factura existente (folio, estado) y ofrecer el botón "Ver factura", igual que ya hace el aviso dentro del modal. Nunca terminar en un texto genérico.

## Detalles técnicos

- `src/features/cxp/services/proveedorFacturas.crud.ts` → `buscarFacturaPorUuidFiscal`: usar `ilike` sobre el UUID normalizado + filtro por `organization_id`; devolver un resultado tipado que distinga "no existe" de "no se pudo consultar".
- `src/features/cxp/hooks/useNuevaFacturaProveedorForm.dup.ts`: propagar ese tercer estado en lugar de `catch → null`.
- `src/features/cxp/hooks/useNuevaFacturaProveedorForm.submit.ts`: en la rama `23505 + uuid_fiscal`, reintentar la búsqueda normalizada y construir siempre la descripción con la factura encontrada.
- `src/lib/domain/` : función pura `normalizarUuidFiscal` (trim + mayúsculas) reutilizada por captura, buzón y parser CFDI.
- Migración: `UPDATE proveedor_facturas SET uuid_fiscal = upper(btrim(uuid_fiscal))` (idempotente, con verificación previa de que no genere colisiones) y lo mismo en `embarque_facturas_entrantes`; recrear el índice único sobre `upper(btrim(uuid_fiscal))`.
- `validar_captura_entrante`: comparar con `upper(btrim(...))` en ambos lados y devolver el `id` y folio de la factura duplicada dentro de `motivos` para que la UI pueda enlazarla.
- UI del buzón (`BuzonEntrantes*`): nueva insignia "CFDI ya capturado" y sustitución de la acción primaria.

## Pruebas

- Unitarias: `normalizarUuidFiscal`, búsqueda de duplicado sensible a mayúsculas mezcladas, y la rama de error 23505 que ahora sí nombra la factura.
- SQL: que la migración no rompa el índice único y que `validar_captura_entrante` cierre la puerta con UUID en minúsculas.

# Por qué la IA no reconoce a "HK LS LIMITED" (y cómo arreglarlo)

## Diagnóstico (verificado)

La IA **sí** lee bien el nombre del proveedor en el PDF. El problema es cómo lo usamos después:

1. El PDF de HK LS LIMITED **no imprime ningún Tax ID / RFC** (revisado el archivo: sólo domicilio en Hong Kong y datos bancarios).
2. La identificación del proveedor en el flujo PDF-IA se hace **únicamente por RFC/Tax ID** (`procesarPdfIaParsed` → `findProveedorByRfcEnOrg`). Si el campo viene vacío, ni siquiera se intenta la búsqueda.
3. En la base de datos el proveedor existe como `HK LS LIMITED` con RFC interno `TE25126564`, un valor que **no aparece impreso en la factura**, así que nunca puede coincidir.

Resultado: el nombre queda escrito, pero el proveedor no queda vinculado y el formulario obliga a elegirlo a mano cada vez.

Analogía: es como buscar a una persona sólo por su número de credencial. La factura trae su nombre completo y su dirección, pero no la credencial, así que el archivero responde "no lo encuentro" aunque esté ahí.

## Qué se va a cambiar

1. **Búsqueda por nombre como respaldo**: si el PDF no trae Tax ID (o no hay coincidencia por Tax ID), buscar el proveedor por nombre normalizado (mayúsculas, sin puntos, sin sufijos societarios tipo LIMITED / LTD / CO., LTD / S.A. / S de RL de CV) dentro de la organización.
   - Coincidencia exacta normalizada → se vincula automáticamente.
   - Coincidencia parcial única → se vincula y se avisa "Proveedor detectado por nombre, verifícalo".
   - Varias coincidencias o ninguna → se deja el selector abierto con el nombre precargado como texto de búsqueda.
2. **No proponer crear un proveedor duplicado**: hoy, cuando no hay match, se ofrece "crear proveedor". Con el respaldo por nombre, sólo se ofrecerá crear si tampoco hay coincidencia por nombre.
3. **Prompt de extracción más claro sobre quién emite**: reforzar que el emisor es el encabezado/logo del documento y que "Customer Name" es el receptor, para blindar contra facturas donde Elogistix aparece arriba en el cuerpo.
4. **Aprendizaje del emparejamiento**: cuando el usuario corrija manualmente el proveedor de una factura PDF-IA cuyo nombre extraído no coincidía, guardar ese nombre como alias del proveedor para que la próxima vez sí lo reconozca.

## Detalles técnicos

- Nuevo helper `src/features/proveedor/services/matchProveedorPorNombre.ts` con `normalizarNombreProveedor()` (upper, sin acentos/puntuación, quita sufijos societarios) y `buscarProveedorPorNombreEnOrg(nombre, organizationId)` usando `ilike` + desempate en cliente; scoped por `organization_id` y `deleted_at is null`.
- `useNuevaFacturaProveedorForm.pdfIa.ts`: cadena de resolución Tax ID → nombre → `askCrearProv`. Devolver además `matchOrigen: "tax_id" | "nombre" | "ninguno"` para que la UI muestre el aviso de verificación.
- `supabase/functions/parse-invoice-pdf/extract.ts`: ajuste de reglas en `SYSTEM` para distinguir emisor vs. receptor. Redeploy de la función.
- Alias de proveedor: nueva tabla `proveedor_alias` (`id`, `organization_id`, `proveedor_id`, `alias_normalizado`, `created_by`, `created_at`) con GRANTs y RLS por organización, más índice único `(organization_id, alias_normalizado)`. Se consulta antes del match difuso y se escribe al guardar una factura PDF-IA con proveedor corregido.
- Tests unitarios: normalización de nombres (sufijos, acentos, puntuación), resolución en cascada del proveedor, y que un match ambiguo no vincule nada.
- `CHANGELOG.md` + bump de `APP_VERSION`.

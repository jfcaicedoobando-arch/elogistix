# Arreglo: operaciones no puede subir facturas al buzón del embarque

## Qué está pasando

Valeria (rol `coordinador_logistico`) sube el PDF+XML del agente en la pestaña Costos del embarque y recibe "No se pudo subir la factura al buzón · Requiere un rol con permiso de captura CxP".

El expediente sí se guarda, pero el último paso —que el servidor verifique el XML y escriba los datos fiscales— la rechaza con 403.

Analogía: la puerta de la bodega acepta el paquete de operaciones, pero el guardia del mostrador de atrás sólo tiene en su lista a contabilidad, así que devuelve el paquete a medio registrar.

## Causa confirmada

Tres listas que deberían coincidir no coinciden:

| Capa | ¿Incluye `operador` / `coordinador_logistico`? |
|---|---|
| UI: `SUBIR_FACTURA_ENTRANTE_EMBARQUE` (`src/lib/access/permissionMatrix.operaciones.ts`) | Sí |
| Base de datos: `adjuntar_xml_factura_entrante` (roles operativos explícitos) | Sí |
| Servidor: `ROLES_CAPTURA_CXP` usada por `autorizarCxp` (`supabase/functions/_shared/auth.ts`) | **No** |

`supabase/functions/adjuntar-xml-entrante/index.ts` llama `autorizarCxp`, que exige `ROLES_CAPTURA_CXP` (sólo administración y contabilidad). Ese es el 403 exacto que ve el usuario.

## Corrección (mínima, sin features nuevas)

1. **Nueva lista server-side `ROLES_ADJUNTAR_XML_ENTRANTE`** en `supabase/functions/_shared/auth.ts`: unión de operaciones (`operador`, `coordinador_logistico`, `gerente_operaciones`) y contabilidad (`contador`, `auxiliar_contable`) más administración. Espejo documentado de `ADJUNTAR_XML_FACTURA_ENTRANTE` y de la RPC.
2. **`autorizarCxp` acepta `rolesPermitidos` opcional**, con valor por omisión `ROLES_CAPTURA_CXP`. Sin cambios de orden: la autorización sigue corriendo antes de leer el cuerpo y antes de tocar Storage.
3. **`adjuntar-xml-entrante` pasa la nueva lista.** `parse-cfdi-xml` y `parse-invoice-pdf` (parseo con IA, ruta de captura contable) quedan intactas con `ROLES_CAPTURA_CXP`.
4. **Mensaje de error más claro** para este caso en `adjuntarXmlEntranteEdge.ts`, sin cambiar la lógica.

## Pruebas

- Deno: caso nuevo en `supabase/functions/_shared/cxpGuard_test.ts` — `coordinador_logistico` autorizado con la lista de adjuntar y rechazado con la de captura.
- Prueba de invariante: la lista server-side de adjuntar coincide con `ADJUNTAR_XML_FACTURA_ENTRANTE` del frontend (evita que vuelvan a separarse).
- Suites existentes de CxP/embarques, `eslint`, `tsgo`, build.

## Cierre

Bump patch de `APP_VERSION` + entrada en `CHANGELOG.md`.

## Restricción operativa

Todo local: sin deploy de Edge Functions, sin publicar, sin migraciones ni SQL remoto, sin secretos ni cambios de datos. El arreglo real en producción requerirá desplegar `adjuntar-xml-entrante` cuando lo autorices.

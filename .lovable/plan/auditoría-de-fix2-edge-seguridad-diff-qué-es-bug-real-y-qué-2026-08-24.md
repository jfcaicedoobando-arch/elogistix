# Auditoría de `fix2-edge-seguridad.diff` — qué es bug real y qué no

Revisé el código actual de las Edge Functions contra cada cambio del parche. Analogía: el parche revisa las puertas del "cuarto de máquinas" (las funciones que corren con llave maestra del servidor). Cuatro puertas están efectivamente abiertas hoy; una está mal cerrada aunque nadie tiene la llave todavía; y una parte del parche es endurecimiento útil pero con riesgo de romper el uso diario.

## Bugs reales confirmados (lo que sí implemento)

**B-1 · Toma de cuentas al invitar al portal (crítico).**
`user-management/agenteHandlers.ts` en modo "password" hace `updateUserById(..., { password })` sobre CUALQUIER cuenta que ya exista con ese correo, y tanto ese flujo como `clientHandlers.ts` hacen `update user_roles set role='agente_carga' | 'cliente'` sobre cuentas existentes. Un admin de un tenant puede invitar el correo de otra persona (incluido el `super_admin` de plataforma, que hoy existe) y quedarse con su contraseña o degradar su rol. Verificado en el código, no hay ningún candado previo.
Fix: validador `validarReinvitacionPortal` (409 si la cuenta ya existe y el modo es password; 409 si tiene rol interno; 409 si no pertenece a la org) y `ensureRole` que sólo corrige el rol en cuentas NUEVAS.

**B-2 · `backfill-cxp-buzon` barre todas las organizaciones (crítico, explotable hoy).**
Hoy autoriza contra `user_roles` global (`admin, super_admin, admin_org, contador`) y luego llama `ejecutarBackfill` sin filtro de organización: escribe en facturas de cualquier tenant y devuelve sus IDs. Hay 3 usuarios con rol global `contador` y 6 con `admin_org`, así que un usuario de un tenant puede disparar un barrido global.
Fix: `organization_id` obligatorio (del body para `super_admin`, de la membresía para el resto), validado con membresía + rol, y `eq("organization_id", ...)` dentro del query del barrido.

**B-3 · `parse-invoice-pdf` sin rol ni límite de uso (drenaje de cuota de IA).**
Sólo hace `await authenticate(req)`. Cualquier sesión válida — incluidos portal cliente, agente de carga y la cuenta demo — puede subir PDFs de 10 MB en bucle contra Gemini con la llave del servidor.
Fix: exigir membresía + rol de captura CxP, rate limit persistente por usuario (20/h) y por org (100/h) con `check_ratelimit` fail-closed, y corte por `Content-Length` antes de bufferar el multipart.

**B-4 · `facturapi-enviar-email` permite reenviar el CFDI a un correo arbitrario.**
El gate es `ROLES_CONSULTA_FISCAL` (incluye `tesorero`, `auxiliar_contable`, `ejecutivo_cobranza`) y luego `resolveEmail` usa el `body.email` tal cual. Es exactamente el agujero que M8 ya cerró en otros envíos: PDF+XML del cliente a donde sea, desde el dominio de la plataforma.
Fix: si viene `body.email`, exigir rol escritor fiscal (`ROLES_EMISOR_FISCAL`) o que el correo pertenezca a los contactos del cliente (`emailPerteneceACliente`), con `DESTINATARIO_NO_PERMITIDO`.

**B-5 · `enviar-factura-email` devuelve URLs firmadas de 30 días al caller.**
Confirmado: `pdf_link`/`xml_link` en la respuesta y `SIGNED_URL_TTL = 30 días`. Enlaces sin autenticación al CFDI que quedan en el cliente y en logs.
Fix: quitar los enlaces de la respuesta (sólo viajan en el correo) y bajar el TTL a 7 días. `EnviarFacturaEmailResult` pasa esos campos a opcionales.

## Bug latente (lo cierro por defensa en profundidad)

**B-6 · `checkAdminAccess` trata el rol legacy `admin` como admin de plataforma.**
Sigue con `.in("role", ["admin","super_admin"])`, mientras `authorizeOrgMembership` ya fue endurecido a sólo `super_admin` (Ola 9 · A13). `isGlobalAdmin` habilita cross-org en `user-management` y `cxc-recordatorios`. Hoy NO hay ningún usuario con rol global `admin` (verificado en la base), así que no es explotable ahora, pero cualquier alta futura reabre el hueco. Lo alineo a `super_admin`; el `admin` legacy conserva acceso vía membresía.

## Lo que NO aplico tal cual

**Allowlist estricta de destinatarios en `enviar-factura-email` y `enviar-proforma-email`.**
La regla del parche (contactos del cliente + dominio del correo de quien envía) es correcta en dirección, pero rompería envíos legítimos frecuentes: agente aduanal, contador externo del cliente, correo personal del comprador. Lo implemento en **modo permisivo con registro**: se valida y, si el destinatario es ajeno, se bloquea sólo cuando el rol NO es escritor fiscal; un rol financiero de escritura puede enviar a terceros y queda asentado en bitácora. Así se corta el uso como plataforma de phishing por roles de sólo lectura sin frenar la operación.

## Detalles técnicos

- `_shared/destinatarioCliente.ts`: agrego `dominioDeEmail` y `destinatariosNoPermitidos` (reutilizan `emailsPermitidosCliente`).
- `_shared/auth.ts`: `checkAdminAccess` a `super_admin`; nueva lista `ROLES_CAPTURA_CXP`, espejo de `COMPRAS_POR_CAPTURAR_ROLES` en `src/lib/access/roleRouteSets.ts`.
- `user-management/reinvitacion.ts` nuevo, con mensajes `LC_USUARIO_CUENTA_*`; se agregan al catálogo `lcCodeMessages` para que la UI muestre texto en español.
- Pruebas Deno nuevas/ampliadas: `destinatarioCliente_test.ts`, `reinvitacion_test.ts`, `parse-invoice-pdf/index_test.ts`, `facturapi-enviar-email/index_test.ts`, `backfill-cxp-buzon/index_test.ts`, `enviar-factura-email/index_test.ts`.
- Sin migraciones de base de datos: todo es Edge Functions + tipo del cliente. Se despliegan las funciones tocadas.
- `CHANGELOG.md` + `APP_VERSION` (13.730.0), respetando el límite de 200 líneas por archivo.

## Criterio de salida

Suites Deno de las funciones tocadas en verde, lint/tipos/tests de CI en verde, ningún flujo de envío de correo o captura CxP roto en la app, y `parse-invoice-pdf` respondiendo 403 para portal/demo y 429 al exceder el tope.

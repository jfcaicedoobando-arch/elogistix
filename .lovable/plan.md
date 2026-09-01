# Hotfix local de autorización CxP por organización

## Alcance
Corregir exclusivamente los dos defectos de `_shared/cxpGuard.ts` sobre el HEAD local, conservando los ajustes locales posteriores a v13.823.0. No se desplegarán funciones, no se publicará la app, no se ejecutarán migraciones ni SQL remoto, y no se modificarán secretos ni datos.

## Implementación
1. **Rate limit realmente fail-closed**
   - Validar estrictamente la respuesta de `check_ratelimit`.
   - Autorizar sólo si el resultado es un objeto con `ok === true`.
   - Mantener `429` para un resultado válido con `ok === false` y `Retry-After` seguro.
   - Convertir `null`, `{}`, tipos incorrectos o cualquier shape inválido en `503 rate_limit_unavailable`, con captura observable y sin continuar.

2. **Organización objetivo explícita**
   - Cambiar `autorizarCxp` para recibir un UUID de organización objetivo y eliminar la selección arbitraria con `.limit(1)`.
   - Validar formato UUID y autorizar el rol efectivo de esa organización mediante `authorizeOrgRole`, reutilizando su política vigente de `super_admin`; no se añadirá ningún bypass nuevo.
   - Para `parse-cfdi-xml` y `parse-invoice-pdf`, propagar `organizationId` desde `useOrgActiva` por hooks y servicios mediante un contrato multipart compartido, y validarlo antes de consumir IA.

3. **Adjuntar XML según el documento**
   - Leer primero únicamente `organization_id`, `embarque_id` y estado del documento solicitado.
   - Usar la organización del documento como objetivo de `autorizarCxp` antes de cualquier descarga de Storage.
   - Mantener respuesta uniforme para documento inexistente o ajeno, validar la ruta canónica y conservar la RPC como segunda defensa.

4. **Pruebas y cierre**
   - Ampliar pruebas Deno para multiempresa A/B, acceso ajeno, política existente de `super_admin`, organización ausente/inválida y todos los shapes inválidos del rate limit.
   - Cubrir que adjuntar un documento de B autoriza contra B y no alcanza Storage cuando el actor sólo pertenece a A.
   - Ajustar pruebas frontend de hooks/servicios para comprobar la propagación de la organización activa.
   - Ejecutar localmente las suites focalizadas, Deno test/check/lint y las validaciones TypeScript/ESLint aplicables; no se ejecutará ninguna operación remota.
   - Actualizar `APP_VERSION` y `CHANGELOG.md` con una versión patch.

## Restricción operativa
Este hotfix es estrictamente local: queda prohibido usar herramientas de deploy/publish, migración remota, SQL remoto, secretos o modificación de datos.

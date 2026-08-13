# Cierre del Sprint 05 (Ola 11): arreglar el build y completar pruebas

## Situación actual (verificada)

- El Sprint 05 quedó implementado: los 6 hallazgos (RFE-04, RNF-08, RFE-05, RFE-06, RNF-09, RNF-12) están en el código, `APP_VERSION` ya es `13.564.0` y el `CHANGELOG.md` tiene la entrada.
- **Hay un error de compilación real**: en `src/features/cxp/services/facturasEntrantesUpload.ts` quedó el import `BUCKET_CXP_INBOX` sin usar, porque la función de subida al almacén se movió al archivo de helpers para respetar el límite de 200 líneas. Es un import huérfano, no una regresión de lógica.
- Pruebas: los tests del buzón CxP y del aviso al salir del asistente pasan (11 + 3 casos). Falta cobertura de dos piezas nuevas: la capacidad de permiso "adjuntar XML" y el aviso visual de CLABE/gates de lote.

## Qué se va a hacer

1. **Arreglar el build (bloqueante)**
   - Quitar el import `BUCKET_CXP_INBOX` que ya no se usa en el servicio de subida.
   - Volver a compilar y confirmar cero errores de tipos.

2. **Completar pruebas de lo nuevo**
   - Prueba de la matriz de permisos: confirmar que operación y contabilidad tienen la capacidad de adjuntar XML y que los roles de sólo lectura no la tienen.
   - Prueba de los gates de lote: confirmar que el permiso de cobro/pago en lote es negativo para gerentes de sólo consulta (así el bloqueo de la interfaz queda protegido contra regresiones).

3. **Verificación final**
   - Lint de los archivos tocados, corrida de las pruebas de CxP, bandejas y permisos, auditorías de migraciones y arquitectura, y build completo.
   - No se cambia la versión (`13.564.0` se mantiene): es un arreglo del mismo sprint, se anota como línea adicional en la entrada existente del changelog.

## Fuera de alcance

No se agrega funcionalidad nueva ni se retoman hallazgos de otros sprints (REF-04 en adelante, RBD/RNF pendientes de olas futuras).

## Detalle técnico

- `src/features/cxp/services/facturasEntrantesUpload.ts`: eliminar `BUCKET_CXP_INBOX` de la lista de imports de `facturasEntrantes.types` (sigue usándose `mensajeDuplicadoEntrante` y el tipo `SubirFacturaEntranteInput`). `subirArchivoEntrante` ya consume la constante dentro de `facturasEntrantesUploadHelpers.ts`.
- Nuevos casos en `src/hooks/__tests__/usePermissions.test.tsx` (o archivo hermano si crece de 200 líneas) para `canAdjuntarXmlFacturaEntrante`, `canRegistrarCobro` y `canPagarProveedor` por rol.
- Comandos de verificación: `bunx tsgo --noEmit`, `bunx eslint <archivos>`, `bunx vitest run src/features/cxp src/features/bandejas src/hooks`, `bun run audit:migrations`, `bun run audit:arch`, `bun run build`.

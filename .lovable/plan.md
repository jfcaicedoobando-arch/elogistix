# Alinear la confirmación de embarques con los datos marcados como obligatorios

## Qué está pasando hoy

En el formulario de embarque, cinco datos aparecen con asterisco (Shipper, Consignatario, Número de contenedor, ETD y ETA), pero nadie los revisa: ni al guardar, ni al pulsar "Avanzar a Confirmado". El aviso de bloqueo sólo menciona peso, naviera y BL master/house. Resultado: se puede confirmar un embarque sin remitente, sin destinatario y sin fechas, y el mensaje que ve el usuario queda incompleto.

Los datos reales confirman que en la práctica sí se capturan: de 276 embarques ya confirmados o posteriores, sólo 12 no tienen shipper/consignatario y 6 no tienen ETA. Así que exigirlos al confirmar no rompe la operación actual.

## Regla canónica propuesta (única, compartida)

Para pasar de Borrador a Confirmado se exige:

- Shipper (exportador)
- Consignatario
- ETD y ETA
- Peso mayor a 0 kg
- Marítimo: naviera, BL master u house, y al menos un contenedor (salvo LCL)
- Aéreo: aerolínea y MAWB
- Terrestre: transportista

El número de contenedor se conserva como hoy: obligatorio para marítimo FCL, opcional en LCL. Nada más cambia (no se toca aduanas, costos, facturación ni cierre).

## Cambios

1. **Regla compartida (frontend)**: `faltantesParaConfirmado` suma shipper, consignatario, ETD y ETA a la lista de faltantes, en el mismo lenguaje de negocio que ya usa el mensaje.
2. **Mensaje**: el aviso al pulsar "Avanzar a Confirmado" lista todos los faltantes reales, sin recortes.
3. **Servidor (misma regla)**: `avanzar_estado_embarque` valida esos mínimos cuando el nuevo estado es `Confirmado` y devuelve `LC_CONFIRMADO_INCOMPLETO: <lista>`, con mensaje amigable en el catálogo `LC_*`. Se conserva intacto el orden actual: idempotencia, `FOR UPDATE`, `_assert_writer` (tenant), guardas de documentos y bitácora.
4. **Formulario**: el asterisco de esos campos se acompaña de la nota de que son necesarios para confirmar, para que el significado quede claro mientras el borrador sigue guardándose incompleto.
5. **Regresión**: pruebas del helper (caso completo pasa, caso incompleto lista los cinco datos) y guard SQL registrado en `_guards_manifest.txt` que verifica que la RPC conserva la validación y sus candados.

## Detalles técnicos

- Nueva migración con el cuerpo canónico de `avanzar_estado_embarque` y espejo `supabase/schema/embarques/avanzar_estado_embarque.sql` sincronizado; baseline y manifiesto regenerados.
- Sin cambios de datos existentes: la validación aplica sólo a nuevas transiciones a `Confirmado`.
- Validaciones locales: typecheck, lint focalizado, pruebas focalizadas, `audit:schema-functions`, `audit:manifest`, `db:baseline:check`. CI/RLS/E2E completos quedan para GitHub Actions.

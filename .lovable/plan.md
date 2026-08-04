# Arreglo: "No se pudo subir la factura" (RLS de Storage) en el buzón de CxP

## Qué pasó (verificado)

Analogía: el candado del archivero deja **meter** hojas nuevas, pero no deja **reemplazar** una hoja que ya está adentro. Al reintentar subir el mismo archivo, el sistema intenta reemplazarlo y el candado lo rechaza.

Datos confirmados en la base:

- El rol del usuario (`coordinador_logistico`) **sí** tiene permiso: `has_role(..., 'operador')` lo incluye, y su organización coincide con la del embarque. No es un problema de rol ni de multi-tenant.
- El bucket `cxp-inbox` tiene políticas de **lectura, inserción y borrado**, pero **ninguna de actualización**.
- La subida usa `upsert: true` (reemplazar si ya existe).
- Los archivos del embarque `0e6b5a7f…` se subieron correctamente a las 23:25:08 y 23:25:09; el error llegó a las 23:25:24, es decir en un **reintento del mismo archivo**, que ya existía en el bucket → intento de reemplazo → rechazado por falta de política de actualización.

Efecto secundario: como la subida ocurre **antes** de la validación de duplicados, el usuario nunca alcanza el mensaje amable de "este archivo ya está en el buzón" y en su lugar ve un error técnico de RLS.

## Qué se va a hacer

1. **Permitir reemplazo en el buzón (backend)**
   Agregar una política de actualización en el bucket `cxp-inbox` con exactamente las mismas condiciones que la de inserción (misma organización + roles con permiso de escritura). Así un reintento del mismo archivo deja de fallar.

2. **Detectar el duplicado antes de subir (frontend)**
   Reordenar el flujo en `subirFacturaEntrante`: calcular el hash del archivo y consultar el buzón **primero**; si ya existe un documento vivo con ese hash, mostrar el mensaje claro ("Este archivo ya está en el buzón…" / "…ya fue capturado…") sin tocar el almacenamiento.

3. **Mensaje de error entendible como respaldo**
   Si de todos modos el almacenamiento devuelve un error de permisos, traducirlo a un mensaje en español con acción sugerida, en lugar de mostrar "new row violates row-level security policy".

4. **Alinear el borrado con la captura**
   La política de borrado del buzón hoy solo permite `admin`/`operador`/`super_admin`, mientras que la de inserción también permite `contador` y `auxiliar_contable`: quien captura no puede retirar su propio archivo. Se ampliará la de borrado para incluir esos dos roles, manteniendo la regla de la app (solo documentos pendientes y solo del propio usuario si no es admin).

5. **Pruebas y registro**
   - Tests unitarios del nuevo orden (duplicado detectado sin subir archivo; error de permisos traducido).
   - Actualizar `CHANGELOG.md` y subir `APP_VERSION`.

## Detalles técnicos

- Migración: `CREATE POLICY cxp_inbox_update_org ON storage.objects FOR UPDATE TO authenticated USING (...) WITH CHECK (...)` replicando `cxp_inbox_insert_org`; y `DROP/CREATE` de `cxp_inbox_delete_org` agregando `contador` y `auxiliar_contable`.
- Frontend: `src/features/cxp/services/facturasEntrantesUpload.ts` (separar `calcularHash` de `subirArchivo`, validar duplicado antes del `upload`), más el mapeo de error en `src/lib/errors`.
- Sin cambios de esquema en tablas de negocio.

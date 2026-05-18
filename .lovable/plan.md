
## Diagnóstico

El error "new row violates row-level security policy" al subir documentos del embarque **no es exclusivo de Valeria** — afecta a todos los usuarios con rol `admin` u `operador` desde el 2026-05-16.

### Causa raíz

La migración del 2026-05-16 (`20260516021519_...sql`) reescribió las políticas del bucket `documentos` exigiendo:

```sql
(storage.foldername(name))[1] = current_user_org_id()::text
```

Es decir, el **primer segmento del path debe ser el UUID de la organización**.

Pero el código construye los paths así (en `src/lib/storage/index.ts` y `src/services/embarque/documentos.ts`):

```
embarques/<expediente>/<documento>/<timestamp>_<archivo>.pdf
embarques/<embarqueId>/<docId>/<hash>-<archivo>.pdf
```

El primer segmento es la cadena literal `"embarques"`, nunca el `organization_id`. Por eso el `WITH CHECK` falla y la inserción en `storage.objects` es rechazada con "new row violates row-level security policy".

Los `super_admin` no lo notan porque su política los exenta. Valeria es `operador`, por eso a ella sí le pega.

Como consecuencia, Valeria tampoco puede **avanzar a Aduana** si ese paso requiere documentos obligatorios (BL Master, etc.) que nunca pudo cargar.

### Por qué los archivos previos al 16-may "sí están"

Se subieron antes de que existiera el chequeo de `foldername[1] = org_id`. La política vieja era más laxa.

---

## Plan de acción

### 1. Migración: ajustar las políticas del bucket `documentos`

Reemplazar las 3 políticas (`INSERT`, `UPDATE`, `DELETE`) para que validen la pertenencia a la organización **vía la tabla `embarques`**, no vía el primer segmento del path. Esto respeta el path actual (`embarques/<expediente>/...`).

Lógica nueva (para INSERT/UPDATE/DELETE):

```text
bucket_id = 'documentos'
AND (has_role(admin) OR has_role(operador) OR has_role(super_admin))
AND (
  has_role(super_admin)
  OR EXISTS (
    SELECT 1 FROM public.embarques e
    WHERE e.organization_id = current_user_org_id()
      AND (storage.foldername(name))[2] = e.expediente
  )
)
```

- `foldername(name)[1]` = `'embarques'`
- `foldername(name)[2]` = expediente (`ELIMP00216`, etc.) ← contra el que validamos
- Cubre los dos esquemas de path actuales (wizard y `uploadDocumentoEmbarque`) porque ambos empiezan con `embarques/<expediente-o-id>/`. Para el path con `embarqueId` (UUID) usaremos también un OR contra `e.id::text`.

La policy final unificada usará:

```text
AND (
  has_role(super_admin)
  OR EXISTS (
    SELECT 1 FROM public.embarques e
    WHERE e.organization_id = current_user_org_id()
      AND (
        (storage.foldername(name))[2] = e.expediente
        OR (storage.foldername(name))[2] = e.id::text
      )
  )
)
```

Mismo predicado para SELECT (lectura) además del existente, asegurando consistencia.

### 2. Verificación post-migración

- Comprobar con `psql` que Valeria (operador, org `00000000-...001`) ahora puede insertar una fila simulada cumpliendo el `WITH CHECK`.
- Probar manualmente el upload desde la UI del embarque `ELIMP00216`.
- Verificar que el botón **Avanzar a Aduana** funciona una vez que se sube al menos el BL Master.

### 3. Changelog + versión

- Bumpear `APP_VERSION` a **8.208.0** (patch de seguridad/operativo).
- Entrada nueva en `src/content/changelog/v8/chunks/0.ts` y `changelogData.ts`: "Corrección: usuarios con rol operador no podían subir documentos a los embarques por una política de almacenamiento desalineada con la estructura de paths".

### 4. Documentación

- Anotar en `mem://audit/pendings` (o crear memoria nueva) que **las políticas de storage deben validar pertenencia vía la tabla de dominio, no vía el primer segmento del path**, ya que el path no incluye `organization_id`. Esto evita repetir el bug.

### Archivos a tocar

- **Migración nueva** (vía `supabase--migration`): drop & recreate 4 políticas del bucket `documentos`.
- `src/constants/appVersion.ts`
- `src/content/changelog/v8/chunks/0.ts`
- `src/content/changelogData.ts`
- `mem://audit/pendings` (o memoria nueva sobre storage RLS)

### Notas técnicas

- No se cambia el formato de los paths, así que no hay que migrar archivos existentes.
- Se mantiene el principio de aislamiento multi-tenant (el `EXISTS` verifica `e.organization_id = current_user_org_id()`).
- No se debilita la seguridad: un operador sigue sin poder tocar paths que no correspondan a un embarque de su organización.

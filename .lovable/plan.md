## Diagnóstico

El toast amarillo "Factura guardada pero el XML/PDF falló" lo dispara `useNuevaFacturaProveedorForm.sideEffects.ts` cuando `subirArchivosCfdiFactura` truena. La factura sí se guarda en la base de datos, lo que falla es la subida de archivos al bucket privado `facturas`. Hay **dos bugs combinados** que afectan exactamente a Isela:

### Bug 1 — Prefijo de ruta incorrecto (afecta a TODOS los usuarios)

`src/features/cxp/services/cfdiStorage.ts` arma la ruta como:

```text
cfdi/{organization_id}/{factura_id}/{archivo}
```

Pero la política RLS del bucket `facturas` (migración `20260516020347`) exige que el **primer segmento** sea el `organization_id`:

```sql
(storage.foldername(name))[1] = current_user_org_id()::text
```

Como el primer segmento es `"cfdi"` (no el UUID de la org), Supabase rechaza el INSERT con un error de RLS.

> Analogía: la portería del edificio sólo deja pasar a quien lleva en la solapa el número de departamento como primera credencial. Nosotros estamos entregando primero un gafete que dice "cfdi" y luego el número — el portero ni siquiera mira el segundo.

### Bug 2 — Rol `contador` no incluido (afecta SÓLO a contadores como Isela)

La misma política sólo permite INSERT/UPDATE en el bucket `facturas` a roles:

```text
admin · operador · super_admin
```

`contador` NO está en la lista, así que aunque arregláramos la ruta, Isela seguiría viendo el toast amarillo. Cualquier `admin_org` u operador no lo nota porque ellos sí pasan el segundo filtro — por eso nadie lo había reportado.

## Cambios propuestos

### 1. `src/features/cxp/services/cfdiStorage.ts`
Cambiar el prefijo de ruta para cumplir la convención de la política:

```text
// Antes
const base = `cfdi/${params.organizationId ?? "org"}/${params.facturaId}`;

// Después
const base = `${params.organizationId ?? "org"}/cfdi/${params.facturaId}`;
```

Las URLs nuevas se guardarán correctamente en `proveedor_facturas.archivo_xml_url / archivo_pdf_url`. Las facturas viejas (subidas a `cfdi/...`) seguirán fallando al descargar — son cero hoy porque ningún upload exitoso pasó la RLS, así que no hay migración de datos pendiente.

### 2. Nueva migración SQL — incluir rol `contador`
Agregar `contador` a las políticas `INSERT` y `UPDATE` del bucket `facturas` (no a DELETE, eso se queda sólo para admin). El rol `contador` es justamente quien captura facturas de proveedor, así que tiene sentido de negocio.

```sql
DROP POLICY "Org staff upload facturas" ON storage.objects;
CREATE POLICY "Org staff upload facturas"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'facturas'
  AND (storage.foldername(name))[1] = current_user_org_id()::text
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operador'::app_role)
    OR has_role(auth.uid(), 'contador'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
);
-- idem para UPDATE
```

### 3. Test de regresión
Agregar un test unitario simple en `src/features/cxp/services/__tests__/cfdiStorage.test.ts` que verifique que la ruta generada empieza con el `organizationId` (no con `"cfdi"`), para que el bug nunca regrese.

### 4. Versionado
- Bump `APP_VERSION` → `13.114.14`.
- Entrada en `CHANGELOG.md` describiendo el fix de RLS + ampliación de rol.

## Archivos a editar

- `src/features/cxp/services/cfdiStorage.ts` (1 línea)
- `supabase/migrations/<timestamp>_facturas_bucket_contador.sql` (nueva)
- `src/features/cxp/services/__tests__/cfdiStorage.test.ts` (nuevo)
- `src/constants/appVersion.ts`
- `CHANGELOG.md`

## Verificación post-deploy

1. Login como `contador` → crear factura de proveedor con XML+PDF → confirmar toast verde y archivos visibles desde el detalle.
2. Login como `admin_org` → mismo flujo → confirmar que sigue funcionando.
3. Revisar logs de Edge Function / Sentry para confirmar que ya no aparece "new row violates row-level security policy" sobre `storage.objects`.

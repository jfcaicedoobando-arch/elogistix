

## Bug: Estado de documentos permanece "Pendiente" después de subir archivo

### Causa raíz

Hay **dos rutas de subida** de documentos y solo una actualiza el estado correctamente:

1. **Desde detalle del embarque** (`useUploadDocumentoEmbarque`): Hace `UPDATE` con `estado: 'Recibido'` — funciona bien.
2. **Desde el wizard de creación** (`crear_embarque_completo` + `subirDocumentosEmbarque`): El archivo se sube a Storage y se pasa la ruta al RPC, pero la función SQL solo inserta `nombre` y `archivo` sin cambiar el `estado`, que queda en su valor por defecto `'Pendiente'`.

Datos reales del embarque actual confirman el problema:
- "Factura Comercial" tiene archivo pero estado = Pendiente
- "Packing List" tiene archivo pero estado = Pendiente

### Solución

Modificar la función SQL `crear_embarque_completo` para que, si el documento tiene un archivo adjunto, inserte el estado como `'Recibido'` en vez del default `'Pendiente'`.

**Cambio en la migración SQL** (1 línea en el loop de documentos):
```sql
-- Antes:
INSERT INTO documentos_embarque (embarque_id, nombre, archivo, organization_id)
VALUES (nuevo_id, doc->>'nombre', NULLIF(doc->>'archivo', ''), v_org_id);

-- Después:
INSERT INTO documentos_embarque (embarque_id, nombre, archivo, estado, organization_id)
VALUES (
  nuevo_id, doc->>'nombre', NULLIF(doc->>'archivo', ''),
  CASE WHEN NULLIF(doc->>'archivo', '') IS NOT NULL THEN 'Recibido'::estado_documento ELSE 'Pendiente'::estado_documento END,
  v_org_id
);
```

**Fix retroactivo** (datos existentes): Actualizar los documentos que ya tienen archivo pero estado incorrecto:
```sql
UPDATE documentos_embarque SET estado = 'Recibido' WHERE archivo IS NOT NULL AND estado = 'Pendiente';
```

### Archivos afectados
- 1 migración SQL (función `crear_embarque_completo`)
- 1 data fix para registros existentes
- `Changelog.tsx` — nueva entrada


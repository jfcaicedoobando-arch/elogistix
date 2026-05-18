## Diagnóstico

El usuario `valeria.zamora@elogistixshipping.com` (rol `operador` en Elogistix → `canEdit = true`) abre el embarque **ELIMP00216** y el tab **Documentos** muestra "Sin documentos registrados". No hay botón **Subir** porque ese botón se renderiza **por fila** en `TabDocumentos.tsx`, y la lista de filas viene de `documentos_embarque`. Si esa tabla está vacía para el embarque, no hay nada que adjuntar y el usuario queda bloqueado.

Verificado en BD:

- Existen **dos embarques con expediente `ELIMP00216`** (creados por Valeria con 1 minuto de diferencia, probablemente reintento tras el error RLS de la versión anterior):
  - `30525762-…` → tiene los 7 documentos sembrados (Bill of Lading Master/House, Packing List, Factura Comercial, Certificado de Origen, Ficha Técnica, Otros).
  - `18d1590b-…` → tiene **0 documentos** sembrados. Éste es el que Valeria está viendo en la captura.

Causa probable: durante el reintento de creación tras el fallo de subida de archivos (RLS bug de v8.207.0), el wizard envió `documentos: []` a `crear_embarque_completo` (por ejemplo si `getDocumentosChecklist(modo)` devolvió vacío para esa pasada). El RPC sólo inserta lo que recibe, así que el embarque quedó sin filas.

## Plan

### 1. UX: permitir agregar documentos desde el detalle (fix para todos los embarques sin checklist)

`src/components/embarque/TabDocumentos.tsx`:

- Agregar botón **"Agregar documento"** en el header de la tarjeta (visible sólo si `canEdit`).
- Al hacer clic abre un diálogo con:
  - `Select` con nombres del checklist estándar (`Bill of Lading (BL Master)`, `Bill of Lading (BL House)`, `Packing List`, `Factura Comercial`, `Certificado de Origen`, `Ficha Técnica`, `Otros`) + opción para nombre libre.
  - Input opcional de notas.
- Al confirmar, llama a una nueva mutación `useInsertDocumentoEmbarqueRow` que hace `insert into documentos_embarque { embarque_id, nombre, estado: 'Pendiente', notas }`.
- Cuando la tabla está vacía y `canEdit`, mostrar empty state con CTA "Agregar documento" en vez de sólo el texto.

Esto resuelve también casos futuros donde el operador necesite añadir un documento fuera del checklist estándar (mejora general).

### 2. Migración: reseed del checklist para el embarque afectado

Insertar las 7 filas faltantes para `18d1590b-a8ef-4c24-8c6d-e9d329acf1ee` (Valeria podrá subir archivos al instante sin esperar al deploy del paso 1).

```sql
INSERT INTO public.documentos_embarque (embarque_id, nombre, estado)
SELECT '18d1590b-a8ef-4c24-8c6d-e9d329acf1ee'::uuid, n, 'Pendiente'
FROM unnest(ARRAY[
  'Bill of Lading (BL Master)','Bill of Lading (BL House)','Packing List',
  'Factura Comercial','Certificado de Origen','Ficha Técnica','Otros'
]) AS n
WHERE NOT EXISTS (
  SELECT 1 FROM public.documentos_embarque d
  WHERE d.embarque_id = '18d1590b-a8ef-4c24-8c6d-e9d329acf1ee'::uuid AND d.nombre = n
);
```

### 3. Defensa en backend (opcional, recomendado)

Modificar `crear_embarque_completo` para que, si recibe `p_documentos = []` o `null`, siembre por default los nombres estándar del checklist según `tipo_operacion` (Importación/Exportación). Así un wizard que olvide enviar el array no deja al embarque sin filas. Lo dejo como sub-tarea separada para no mezclar fix con cambio de contrato del RPC.

### 4. Changelog y versión

- Bump a `8.209.0` en `src/constants/appVersion.ts`.
- Nueva entrada al inicio en `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts` describiendo: "Permitir agregar documentos al embarque desde el detalle aunque el checklist esté vacío + reseed manual de ELIMP00216".
- Recortar `recentChangelog` para mantener 10 entradas.

### Detalles técnicos

- Nombre canónico de la constante: ya existe `getDocumentosChecklist` en el dominio del wizard; reutilizar la lista por modo para el `Select` del diálogo.
- RLS: `documentos_embarque` ya tiene política que permite a `admin`/`operador` insertar para embarques de su organización, así que no se requiere cambio de policy.
- No tocar `src/integrations/supabase/types.ts` ni `src/integrations/supabase/client.ts`.

¿Procedo con la implementación tal cual o quieres que también investigue por qué se crearon dos embarques con el mismo `ELIMP00216` (parece faltar un `UNIQUE (expediente)` o el RPC no es idempotente ante doble click)?

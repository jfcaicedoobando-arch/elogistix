

## Plan: Alta de clientes vía CSF (Constancia de Situación Fiscal)

### Flujo propuesto

```text
┌─────────────────────────────────────────┐
│  Paso 1: Datos del Cliente              │
│                                         │
│  [Manual]  ←→  [Subir CSF]             │
│                                         │
│  Si CSF:                                │
│    1. Usuario sube PDF                  │
│    2. Se envía a edge function          │
│    3. AI extrae campos estructurados    │
│    4. Se pre-llenan los inputs          │
│    5. Usuario revisa y corrige          │
│                                         │
│  → Siguiente (paso 2: documentos)       │
└─────────────────────────────────────────┘
```

### Mapeo CSF → Campos del formulario

| Campo CSF | Campo formulario |
|---|---|
| Denominación/Razón Social | `nombre` |
| RFC | `rfc` |
| Código Postal | `cp` |
| Tipo Vialidad + Nombre Vialidad + Números + Colonia | `direccion` |
| Nombre de la Localidad / Municipio | `ciudad` |
| Nombre de la Entidad Federativa | `estado` |

Los campos `contacto`, `email` y `teléfono` no existen en el CSF, quedarán vacíos para llenado manual.

### Cambios técnicos

#### 1. Nueva edge function: `parse-csf`
- Recibe el PDF como FormData
- Extrae el texto del PDF (usa pdf-parse o lee el contenido como text)
- Envía el texto al modelo AI (Gemini 2.5 Flash vía Lovable AI) con un prompt estructurado pidiendo JSON con los campos: nombre, rfc, cp, direccion, ciudad, estado
- Retorna el JSON parseado

#### 2. Modificar `src/pages/Clientes.tsx`
- Agregar toggle entre modo "Manual" y "Subir CSF" en el paso 1
- En modo CSF: mostrar dropzone/botón de upload + estado de carga
- Al recibir respuesta, pre-llenar el formulario con los datos extraídos
- Los campos quedan editables para corrección
- El flujo al paso 2 no cambia

#### 3. UI del modo CSF
- Botón "Subir CSF (PDF)" con ícono de upload
- Indicador de procesamiento mientras AI extrae datos
- Toast de confirmación con "Datos extraídos — revisa la información"
- Si falla, toast de error y opción de llenar manualmente

### Archivos afectados
- **Nuevo**: `supabase/functions/parse-csf/index.ts`
- **Modificado**: `src/pages/Clientes.tsx` — agregar toggle y lógica de upload/parse


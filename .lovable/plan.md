
# Fix: Sanitización de paths en Supabase Storage

## Problema
El upload de documentos de embarque falla con `Invalid key` cuando el nombre del archivo o del documento contiene caracteres no permitidos por Supabase Storage (CJK, espacios, paréntesis, acentos, etc.).

Path actual generado:
```
embarques/ELIMP00180/Air Waybill (AWB)/1776874875004_提单 172-04513806.pdf
                     ^^^^^^^^^^^^^^^^^                  ^^^^^^
                     espacios + paréntesis              chinos
```

Supabase Storage solo acepta keys con caracteres ASCII seguros.

## Solución

### 1. Crear utilidad de sanitización: `src/lib/storageUtils.ts` (nuevo)
Función `sanitizeStorageKey(value)` que:
- Normaliza Unicode (NFD) y elimina diacríticos (acentos)
- Reemplaza caracteres no-ASCII (chinos, árabes, etc.) por `_`
- Reemplaza espacios y caracteres no permitidos `[^A-Za-z0-9._-]` por `_`
- Colapsa `_` repetidos
- Recorta `_` al inicio/final
- Preserva la extensión del archivo
- Limita longitud a 80 caracteres por segmento

Función `buildEmbarqueDocPath(expediente, docNombre, fileName)` que arma el path final ya sanitizado:
```
embarques/{expediente_sano}/{doc_sano}/{timestamp}_{file_sano}.{ext}
```

### 2. Aplicar en los 3 puntos de upload
- `src/services/embarqueServices.ts:45` (creación de embarque)
- `src/hooks/embarque/useEmbarqueMutations.ts` `useUploadDocumentoEmbarque` (carga posterior)
- Revisar `src/components/cliente/...` por si los documentos de onboarding del cliente sufren lo mismo y aplicar la misma utilidad ahí.

### 3. Tests unitarios: `src/lib/__tests__/storageUtils.test.ts`
Casos cubiertos:
- `Air Waybill (AWB)` → `Air_Waybill_AWB`
- `172-04513806_提单.pdf` → `172-04513806_.pdf` (extensión preservada)
- `Constancia Situación Fiscal.pdf` → `Constancia_Situacion_Fiscal.pdf`
- `documento  con   espacios.PDF` → `documento_con_espacios.PDF`
- `archivo!@#$%^&.docx` → `archivo_.docx`
- Nombres muy largos → truncados a 80 chars conservando extensión
- Extensiones múltiples (`.tar.gz`) → solo última extensión

### 4. Toast más claro
En `useEmbarqueDocumentosActions.ts` el catch ya usa `getErrorMessage(err)`. Mejorar para que cuando detecte `Invalid key` muestre: "El nombre del archivo contiene caracteres no permitidos. Renombra el archivo y vuelve a intentar." (defensa en profundidad por si algún día el sanitizador falla).

### 5. Changelog
Agregar entrada patch en `src/pages/Changelog.tsx`:
```
v8.41.1 - Fix: Sanitización de nombres de archivo
- Corrige error "Invalid key" al subir documentos con caracteres especiales (CJK, acentos, paréntesis, espacios).
- Aplica sanitización automática a paths de Storage en embarques y onboarding de clientes.
```

## Archivos afectados
| Archivo | Cambio |
|---|---|
| `src/lib/storageUtils.ts` | Nuevo: sanitización |
| `src/lib/__tests__/storageUtils.test.ts` | Nuevo: tests |
| `src/services/embarqueServices.ts` | Usar `buildEmbarqueDocPath` |
| `src/hooks/embarque/useEmbarqueMutations.ts` | Usar `buildEmbarqueDocPath` en `useUploadDocumentoEmbarque` |
| `src/hooks/embarque/useEmbarqueDocumentosActions.ts` | Mejorar mensaje de error |
| Documentos de cliente (onboarding) | Aplicar misma sanitización si construyen paths similares |
| `src/pages/Changelog.tsx` | Entrada v8.41.1 |

## Riesgos
- **Bajo**. Sanitizar solo afecta archivos nuevos. Archivos ya subidos con paths válidos no se tocan.
- Dos archivos con nombres distintos podrían colapsar al mismo path sanitizado (ej. `Factura.pdf` y `Factúra.pdf`), pero el prefijo `Date.now()` evita colisiones.

## Validación post-fix
- Subir manualmente un archivo con nombre chino → debe funcionar.
- Subir a un documento llamado `Air Waybill (AWB)` → debe funcionar.
- Correr `npm test` → 139+ tests verdes (los nuevos suman).

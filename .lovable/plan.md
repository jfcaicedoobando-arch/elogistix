# Mostrar BL y contenedores en la proforma

## Estado actual

- **BL Master**: ya aparece en el header (`ProformaHeader.tsx` línea 70) como "BL/MAWB".
- **BL House**: **NO** se muestra en ningún lado, pese a existir en `embarques.bl_house`.
- **Contenedores**: sólo se muestran como **encabezado de grupo** dentro de la tabla de conceptos, y **únicamente cuando hay 2+ contenedores** (`multiContenedor` requiere `idsUnicos.size >= 2`). Si la proforma cubre un único contenedor, su número/tipo no se ven en el PDF.

## Lo que voy a hacer

### 1. Header del PDF — sección "Datos del Embarque"
- Renombrar la entrada actual **"BL/MAWB"** → **"BL Master / MAWB"** (más explícito).
- Añadir **"BL House / HAWB"** justo debajo, sólo si `embarque.bl_house` existe.
- Añadir fila **"Contenedores"** con la lista completa, formato: `MSCU1234567 · 40HC, MSCU2345678 · 20GP`. Si hay >3 contenedores, resumir como `3 × 40HC + 1 × 20GP — MSCU1234567, MSCU2345678, …` para no romper el grid.
- Si no hay contenedores cargados (modo aéreo o sin asignar), la fila no se renderiza.

### 2. Data layer
- `fetchEmbarqueParaPdf` (`src/services/proforma/queries.ts`): agregar `bl_house` al `select` y un nested `embarque_contenedores(id, numero_contenedor, tipo_contenedor)`.
- `EmbarqueLite` (`src/pdf/documents/proformaShared.ts`): agregar `bl_house` al `Pick` y un campo opcional `contenedores?: { id; numero_contenedor; tipo_contenedor }[]`.

### 3. Consolidada
- `ProformaConsolidadaDocument` no renderiza `SeccionEmbarque` (cubre N embarques). **No se toca** — los contenedores ya aparecen agrupados por embarque cuando aplica.

### 4. Tests
- Ampliar `src/pdf/documents/__tests__/ProformaDocument.test.tsx`:
  - Caso con `bl_house` y 1 contenedor → ambos renderizan en el header.
  - Caso sin `bl_house` ni contenedores → no aparecen filas vacías.

### 5. Metadata
- `APP_VERSION` → `12.95.1`.
- `CHANGELOG.md`: entrada `[12.95.1]` describiendo BL House + lista de contenedores en header de proforma.

## Sección técnica (archivos tocados)

| Archivo | Cambio |
|---|---|
| `src/services/proforma/queries.ts` | `fetchEmbarqueParaPdf`: añadir `bl_house` y nested `embarque_contenedores` |
| `src/pdf/documents/proformaShared.ts` | `EmbarqueLite`: +`bl_house`, +`contenedores?` |
| `src/pdf/documents/ProformaHeader.tsx` | `meta` con BL Master/House; `SeccionEmbarque` con fila Contenedores |
| `src/pdf/documents/__tests__/ProformaDocument.test.tsx` | nuevos casos |
| `src/constants/appVersion.ts` | `12.95.1` |
| `CHANGELOG.md` | nueva entrada |

## Fuera de alcance

- No se cambian las **cabeceras de agrupamiento por contenedor** dentro de las tablas (`multiContenedor`) — siguen apareciendo igual cuando hay 2+.
- No se toca la proforma consolidada.
- No se modifica la factura ni la cotización (sólo proforma, como pidió el usuario).

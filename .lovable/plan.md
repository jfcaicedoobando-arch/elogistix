## Objetivo

Simplificar el paso 2 del modal "Nuevo Proveedor". En lugar del checklist de documentos, mostrar únicamente una sección de **Datos bancarios** con dos campos opcionales: banco (dropdown con bancos de México) y CLABE interbancaria.

## Cambios

### 1. Base de datos (migración)

Agregar dos columnas opcionales a `public.proveedores`:

- `banco TEXT NULL`
- `clabe TEXT NULL`

(Sin validación estricta de longitud; opcionales.)

### 2. Catálogo de bancos

Crear `src/constants/bancosMexico.ts` con la lista estándar de bancos mexicanos (BBVA, Santander, Banorte, Banamex/Citibanamex, HSBC, Scotiabank, Inbursa, Banco Azteca, BanBajío, Banregio, Afirme, Mifel, Multiva, Banco del Bajío, Banco Famsa, Banco Ve por Más, Compartamos, BanCoppel, Actinver, Intercam, Monex, CIBanco, Banca Mifel, Banco Base, Banco Sabadell, Nu México, Hey Banco, Klar, etc.).

### 3. Controller `useNuevoProveedorController.ts`

- Agregar `banco: ""` y `clabe: ""` a `EMPTY_PROVEEDOR_FORM`.
- Quitar la generación de `documentos` en `handleNext` (ya no aplica al paso 2; el checklist deja de mostrarse en este wizard).
- Mantener `handleSave` enviando `banco` y `clabe` como parte del insert (opcionales).
- Quitar exports innecesarios (`documentos`, `handleFileChange`) si dejan de usarse.

### 4. UI `NuevoProveedorDialog.tsx`

Reemplazar el bloque del paso 2 (`DocumentChecklist`) por una sección con:

- Encabezado "Datos bancarios" + nota "(opcional)".
- Select de **Banco** con opciones del catálogo.
- Input para **CLABE interbancaria** (texto, sin obligatoriedad).

Mantener los botones Atrás / Crear sin cambios.

### 5. Tests

Actualizar `useNuevoProveedorController.test.tsx` para reflejar los nuevos campos en `EMPTY_PROVEEDOR_FORM` y eliminar/ajustar aserciones de `documentos` si las hubiera.

### 6. Versionado

- `APP_VERSION` → `12.76.21`.
- Entrada en `CHANGELOG.md` describiendo la simplificación del paso 2.

## Notas

- Los datos bancarios son opcionales: el botón "Crear" sigue habilitado aunque queden vacíos.
- El `DocumentChecklist` permanece disponible para otros flujos (edición / detalle), solo se quita del wizard de alta.

La CLABE tiene que tener un validador de 18 digitos
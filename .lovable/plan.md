

# Formulario de Nuevo Proveedor en 2 pasos con documentos por origen

## Resumen
Convertir el diálogo de nuevo proveedor en un wizard de 2 pasos:
- **Paso 1:** Datos generales (campos actuales + nuevo dropdown "Nacional/Extranjero")
- **Paso 2:** Lista de documentos requeridos según si es Nacional o Extranjero, con opción de adjuntar archivo para cada uno

## Archivos a modificar

### 1. `src/data/types.ts`
- Agregar `origenProveedor?: 'Nacional' | 'Extranjero'` al interface `Proveedor`
- Agregar interface `DocumentoProveedor` con campos: `nombre`, `archivo?` (string/File name), `adjuntado` (boolean)

### 2. `src/components/NuevoProveedorDialog.tsx` — Reescritura principal
- Agregar estado `step` (1 o 2) y `origen` ('Nacional' | 'Extranjero')
- **Paso 1:** Campos actuales + dropdown Nacional/Extranjero (obligatorio)
- Botón "Siguiente" en vez de "Crear" (valida paso 1)
- **Paso 2:** Mostrar lista de documentos según origen:
  - **Nacional:** CIF, Opinión fiscal, Acta constitutiva, INE RL, Poder notarial, Comprobante de domicilio, Datos bancarios
  - **Extranjero:** Certificado de ID, Comprobante de domicilio, Documento que acredite su legalidad, Identificación del RL, Datos bancarios, Poder notarial del RL
- Cada documento: label + botón para "adjuntar" (input file) + indicador de estado
- Botones: "Atrás" para volver al paso 1, "Crear" para guardar
- Los documentos no serán obligatorios para crear (solo referencia), pero se mostrará cuáles faltan
- Al cerrar o crear, resetear paso a 1

### 3. `src/components/EditarProveedorDialog.tsx`
- Agregar campo dropdown Nacional/Extranjero
- No requiere wizard de 2 pasos (se puede agregar después si se desea)

## Nota técnica
Como no hay backend de almacenamiento de archivos, los archivos adjuntos se guardarán solo como nombres de referencia en memoria durante la sesión. Se mostrará un ícono de check cuando se "adjunte" un archivo.


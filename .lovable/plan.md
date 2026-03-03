

## Plan: Plantilla CSV y Carga Masiva de Embarques

Actualización respecto al plan anterior: **Peso (kg), Volumen (m³) y Piezas NO son obligatorios**. Solo aparecen como columnas opcionales sin asterisco.

---

### Archivos a crear/modificar (4 archivos)

**1. Nuevo: `src/lib/embarqueCsvTemplate.ts`**
- Función `descargarPlantillaCSV()` que genera CSV UTF-8 con BOM
- Encabezados con `*` para campos obligatorios
- Campos obligatorios: Modo de Transporte, Tipo de Operación, Cliente, Incoterm, Shipper, Consignatario, Descripción de Mercancía, Tipo de Carga, ETD, ETA
- Campos opcionales (sin `*`): Peso (kg), Volumen (m³), Piezas, y todos los campos condicionales por modo (puertos, navieras, BLs, etc.)
- Fila de ejemplo con un embarque marítimo
- Función `parsearCSVEmbarques(csvText, clientes)` que valida cada fila y retorna `{ validos, errores }`

**2. Nuevo: `src/components/embarque/CargaMasivaDialog.tsx`**
- Dialog para subir CSV, procesar, mostrar resultados (filas válidas/errores), y confirmar creación

**3. Modificar: `src/pages/Embarques.tsx`**
- Agregar botones "Descargar Plantilla CSV" y "Carga Masiva" junto a "Nuevo Embarque" (solo con `canEdit`)

**4. Modificar: `src/pages/Changelog.tsx`**
- Nueva entrada v4.3.0

### Validación del CSV
- Campos obligatorios no vacíos (Peso, Volumen y Piezas se aceptan vacíos)
- Enums validados contra valores existentes (modos, tipos, incoterms)
- Cliente matcheado por nombre contra tabla de clientes
- Fechas en formato YYYY-MM-DD
- Campos numéricos (cuando se llenan) deben ser numéricos


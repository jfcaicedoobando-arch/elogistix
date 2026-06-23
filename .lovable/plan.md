# Ola 3 — Wizards reales con FormDialogShell + FormDialogStepper

Alcance aprobado: **los tres** (BulkImport + Liquidación + ImportarLeadsCsv).

## Objetivo

Llevar los modales **multi-paso** al mismo lenguaje visual del resto del back-office: icon-tile en el header, stepper segmentado arriba del cuerpo, body scrolleable y footer sticky con acciones. Toda la lógica (hooks, mutaciones, parsing CSV) queda intacta — sólo cambia la cáscara.

## Trabajo por modal

### 1. `BulkImportDialog` (genérico) — el grande

Hoy maneja 4 estados internos (`upload → preview → committing → done`) cambiando el body a mano. Migración:

- Envolver en `FormDialogShell` con `icon=Upload`, `size="2xl"`.
- Mapear estados a 3 pasos visibles del `FormDialogStepper`:
  - **Paso 1 · Cargar archivo** (`upload`)
  - **Paso 2 · Revisar** (`preview`, `committing` muestra spinner dentro del paso 2)
  - **Paso 3 · Confirmar** (`done`)
- Mover los botones de `BulkImportFooter` al slot `footer` del shell. `BulkImportBody` se queda como está (sólo pierde el `DialogHeader` que ya no le toca).
- Beneficio en cascada: `ProveedoresImportDialog`, importador de clientes y cualquier otro consumidor heredan el nuevo look sin tocarse.

### 2. `ImportarLeadsCsvDialog` (CRM)

Tiene su propio hook `useImportarLeadsCsv` y vive aparte del `BulkImportDialog` genérico. No lo fusionamos (riesgo alto y fuera de alcance), pero le damos **el mismo look**:

- Envolver en `FormDialogShell` con `icon=UserPlus` (o `FileSpreadsheet`), `size="2xl"`.
- `FormDialogStepper` de 2 pasos: **Cargar → Revisar e importar**.
- Footer sticky con `Cancelar` + `Importar N leads`.
- Conservar `useImportarLeadsCsv`, validaciones y `notifySuccess/notifyError`.

### 3. `DialogGenerarLiquidacion` (Comisiones) — auditar y decidir

Revisión con el código en mano:

- Si el formulario actual (período + filtros + botón generar) se siente cómodo en un solo paso → **se queda como está** desde Ola 2, sólo se documenta la decisión en el CHANGELOG.
- Si tiene fricción real (ej. el usuario no entiende qué va a generarse antes de confirmar) → se parte en wizard de 2 pasos: **Definir período → Revisar comisiones a liquidar**, manteniendo el mismo `headerAside` con totales.

Criterio: no inflar UX por inflar. Power-of-10 manda.

## Reglas comunes (idénticas a Olas 1 y 2)

- Sólo presentación. Cero cambios en hooks, servicios, RLS, validaciones o atajos.
- Sin nuevos tokens de color.
- Confirmaciones cortas siguen como `AlertDialog`.
- Componentes ≤200 líneas; si algún wizard se infla, extraer pasos a archivos hermanos.

## Validación

- `tsgo` verde.
- Suite de tests verde (los de importación de proveedores/leads deberían seguir pasando sin tocarlos).
- Smoke visual en preview:
  1. Abrir importador de proveedores → cargar CSV de ejemplo → ver el stepper iluminar pasos 1→2→3.
  2. Abrir importador de leads (CRM) → mismo flujo.
  3. Abrir `DialogGenerarLiquidacion` y validar la decisión tomada.

## Entregables

- Bump a `13.128.0`.
- Entrada en `CHANGELOG.md` listando los 2-3 modales migrados y la decisión sobre Liquidación.
- Actualización de `mem://style/form-dialog-shell` añadiendo `BulkImportDialog` e `ImportarLeadsCsvDialog` a la lista de referencia de wizards migrados.

## Después de Ola 3 (fuera de alcance)

- Paneles de lectura (`TabCierre`, `EmbarquesEstadoDialog`) — no son formularios, se quedan.
- Wizards de página completa (cotización, embarques) — no son `Dialog`, no aplican al shell.
- Confirmaciones cortas — siguen como `AlertDialog`.

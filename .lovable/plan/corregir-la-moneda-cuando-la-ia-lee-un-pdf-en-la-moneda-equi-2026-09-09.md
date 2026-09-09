# Corregir la moneda cuando la IA lee un PDF en la moneda equivocada

## El caso

La nota de débito de AGUNSA/TSL (BL 799610430252) imprime los cargos en **USD** y el total en pesos ("Total: MXN 873", tipo de cambio 17.1092). La IA se queda con MXN. Hoy la moneda sólo se puede corregir en el paso 2 del asistente, lejos de donde se ve la lectura de la IA, así que parece que no hay forma de cambiarla.

Decisión de negocio confirmada: en documentos así, la moneda de la factura es **la de los cargos (USD)** y el tipo de cambio impreso sirve para convertir a pesos.

## Qué se va a hacer

### 1. Corregir la moneda desde el paso 1 (junto a la lectura de la IA)

- Cuando el documento se leyó con IA (PDF sin XML), aparece un bloque corto arriba de la tabla de conceptos: **"Moneda detectada"** con el selector MXN / USD / EUR y, si no es peso, el campo de tipo de cambio con el botón "Obtener DOF" que ya existe.
- Al cambiar la moneda se muestra un aviso claro: *los importes no se convierten solos; revisa que correspondan a la nueva moneda*. Así nadie asume una conversión que no ocurrió.
- Es el mismo campo del paso 2 (no se duplica estado): sólo se expone antes, donde el usuario está mirando.
- El desglose de un XML CFDI sigue intacto: este bloque no se muestra para facturas con XML, porque ahí la moneda es fiscal.

### 2. Que la IA acierte más seguido en facturas con dos monedas

- En la instrucción de lectura se agrega la regla: si el documento muestra un importe en moneda extranjera con su tipo de cambio y además el equivalente en pesos, la moneda de la factura es **la extranjera**, y el tipo de cambio impreso se devuelve como tipo de cambio.
- Cuando el documento tiene dos monedas, la lectura marca el caso como dudoso y el aviso del paso 1 pide confirmarlo antes de guardar.

## Qué NO cambia

- No se convierten importes automáticamente ni se tocan conceptos ya capturados.
- No se modifican facturas, pagos, costos ni datos existentes (incluido el embarque 329, ya corregido antes).
- Sin migraciones, sin tablas ni RPCs nuevas, sin dependencias nuevas.

## Detalles técnicos

- Nuevo componente `src/features/cxp/components/MonedaDetectadaIaCard.tsx` (< 200 líneas): recibe `moneda`, `tc`, `tcOrigen`, `onChange`, `onObtenerDof`, `dofLoading`; reutiliza `Select`, `NumericInput` y `TcOrigenHint` ya existentes.
- `_sections/PasoDocumento.tsx`: lo renderiza sólo si `ctl.pendingCfdi?.origen === "pdf_ia"`, cableado a `ctl.handleChange` / `ctl.obtenerDofManual` (ya expuestos por `useNuevaFacturaProveedorForm`). Sin estado nuevo en el hook.
- `supabase/functions/parse-invoice-pdf/extract.ts`: regla de moneda dual en el prompt + bandera `currency_ambigua` normalizada al resultado; `index.ts` la propaga. Requiere volver a desplegar la función.
- Regresiones mínimas (se ejecutan en GitHub Actions, no aquí): el bloque aparece sólo con origen `pdf_ia`, cambiar moneda actualiza `values.moneda` y limpia el origen del T/C, y normalización de moneda dual en `extract.ts`.
- Cierre: `APP_VERSION` + `CHANGELOG.md` + manifiesto, typecheck, lint focalizado y build. Sin publicar.

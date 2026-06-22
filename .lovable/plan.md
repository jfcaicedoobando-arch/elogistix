# Completar datos fiscales del cliente para CFDI 4.0

## Problema

La tabla `clientes` ya tiene las columnas `regimen_fiscal` y `uso_cfdi_default`, pero el wizard de alta y el diálogo de edición no las capturan. Resultado: cada factura nueva pide capturar régimen y uso CFDI a mano porque vienen vacíos del cliente.

Además, `parse-csf` ya devuelve `regimen_fiscal` de la Constancia de Situación Fiscal, pero el controller lo descarta.

## Alcance

Solo clientes nacionales (mexicanos). Captura mínima para que el módulo de timbrado deje de bloquearse.

## Cambios

### 1. Wizard "Nuevo Cliente" (paso 1)

Archivo: `src/features/cliente/hooks/useNuevoClienteController.ts` y el componente del paso 1.

- Agregar al estado `EMPTY_CLIENTE` los campos `regimen_fiscal: ""` y `uso_cfdi_default: ""`.
- En `handleCsfUpload`, mapear `datos.regimen_fiscal` al form (ya viene de la edge function).
- En el paso 1 de la UI, agregar dos `Select`:
  - **Régimen fiscal SAT** — usando el catálogo `src/constants/regimenFiscalSAT.ts`.
  - **Uso CFDI por defecto** — usando los usos vigentes en `src/constants/catalogosSAT.ts` (G03, P01, S01, etc.).
- Validación: para `isStep1Valid` agregar `regimen_fiscal` como obligatorio (uso CFDI puede quedar opcional con `G03` por defecto, a confirmar abajo).

### 2. Diálogo "Editar Cliente"

Archivo: `src/features/cliente/components/DialogEditarCliente.tsx` y su tipo `ClienteData` en `useClienteDetalleController.types.ts`.

- Agregar los mismos dos selects.
- Permitir corregir clientes existentes que tengan estos campos vacíos.

### 3. Servicio de creación / actualización

Archivo: `src/features/cliente/services/crud.ts`.

- Asegurar que `regimen_fiscal` y `uso_cfdi_default` viajen en el `insert` y `update`.
- Confirmar que `clienteInsertSchema` / `clienteUpdateSchema` aceptan ambos campos (revisar `src/lib/validation/mutationSchemas.ts`).

### 4. Importación CSV de clientes

Archivo: `src/lib/csv/importSchemaCliente.ts`.

- Agregar columnas opcionales `regimen_fiscal` y `uso_cfdi_default` a `CLIENTE_TEMPLATE_HEADERS` y al schema Zod.

### 5. Tests

- Actualizar `useNuevoClienteController.test.tsx` para cubrir el caso de CSF con régimen y el caso manual.

### 6. Changelog y versión

- `APP_VERSION` → `13.113.0`.
- Entrada en `CHANGELOG.md` describiendo la captura obligatoria de régimen fiscal y opcional de uso CFDI.

## Fuera de alcance

- Forma de pago / método de pago SAT (se capturan por factura, no por cliente).
- Migración masiva para llenar clientes históricos (se irán completando al editarlos o al timbrar).
- Clientes extranjeros (no aplican RFC/régimen SAT).

## Preguntas antes de implementar

1. ¿El **uso CFDI** debe ser obligatorio en el alta o lo dejamos opcional con `G03 – Gastos en general` por defecto? G03
2. Para los **clientes existentes** sin régimen, ¿quieres que aparezca una alerta visible en el detalle del cliente y/o un badge en el listado, o basta con que el módulo de facturación lo siga pidiendo al momento de timbrar? manejamos algo visible
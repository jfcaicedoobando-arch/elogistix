# Teclado y accesibilidad en todos los modales del ERP

## Qué se detectó

Hay **64 modales tipo formulario** en el ERP. Sólo **5** se comportan hoy como el modal de "Registrar pago" que acabamos de arreglar:

- **59** no tienen un `<form>` real: el botón de guardar es un `onClick`, así que **Enter no guarda**.
- **55** no enfocan el primer campo al abrir (el usuario tiene que tabular o dar clic).
- **~15** tienen etiquetas sin ligar a su campo (el lector de pantalla no las anuncia y el clic en la etiqueta no enfoca).
- **13** tienen fecha; todos ya usan el campo `DatePickerMx`, así que la mejora de captura por teclado (`1/3/2026`, `Alt+Flecha abajo`) **ya les llegó automáticamente**.

`FormDialogShell` hoy no ofrece nada para esto: sólo recibe el footer como contenido libre, y el patrón `<form id>` + botón `type="submit" form={id}` está copiado a mano dentro de facturación.

## Qué se va a construir

### 1. Un solo lugar que resuelva el patrón (base)

- `FormDialogShell` acepta `formId` y `onSubmit` opcionales: cuando se pasan, el cuerpo scrolleable se renderiza como `<form id>` real, y el footer sigue fuera (sticky) como hoy.
- Nuevo componente compartido `FormDialogFooter` (basado en el `FooterAcciones` que hoy vive en facturación): botones **Cancelar** (`type="button"`) y **Guardar** (`type="submit" form={formId}`), con estado `loading` y texto configurable. Reemplaza los footers copiados uno por uno.
- Nuevo hook `useAutoFocusPrimerCampo` (o prop `autoFocusFirstField` del shell) que enfoca el primer control habilitado al abrir, sin robar el foco si el modal abre en modo lectura.
- Comportamiento garantizado en todos: `Esc` cierra, `Enter` en un campo de texto guarda (respetando el botón deshabilitado), `Enter` en textarea sigue haciendo salto de línea, y el foco vuelve al botón que abrió el modal al cerrar.

### 2. Migración por olas (los 59 modales restantes)

- **Ola A — dinero y fechas (17 modales, prioridad alta):** Tesorería (movimiento manual, ejecutar pago, traspaso, programar pago), CxP (pago en lote, cerrar sin pago, cancelar, eliminar), anticipos de proveedor, comisiones (generar liquidación, registrar pago), facturación (cobro en lote, factura manual, timbrar, enviar CFDI), seguros de embarque.
- **Ola B — captura de catálogos y clientes (22 modales):** proveedor, contactos, editar cliente, organizaciones, usuarios, navieras, tarifas, rutas, presupuesto, portal e invitaciones.
- **Ola C — CRM, cotizaciones, auditoría y resto (20 modales):** convertir lead, nueva actividad, convertir prospecto, plantillas, asignar responsable, marcar revisados, bandejas, proformas, cobranza, operaciones.
- En cada modal: `<form>` + footer compartido, `autoFocus` en el primer campo, `id`/`htmlFor` en todas las etiquetas, y errores anunciados con `aria-invalid` + `aria-describedby`.
- Los diálogos de sólo confirmación (borrar, cancelar con motivo) reciben únicamente foco inicial y `Enter` sobre el campo de motivo — no se les fuerza un formulario donde no aplica.

### 3. Candado para que no vuelva a pasar

- Test de arquitectura `modales-form-submit.test.ts`: cualquier archivo con `FormDialogShell` y un botón de guardar debe declarar `formId`/`onSubmit`, y no debe tener `<Label>` sin `htmlFor`. Con lista de excepciones explícita para los diálogos de confirmación.
- Tests de interacción por ola (una muestra representativa por módulo): abre el modal, verifica foco inicial y que `Enter` dispara el submit.
- Un caso E2E de teclado que recorra un modal de Tesorería de punta a punta.

## Detalles técnicos

- Archivos base nuevos: `src/components/shared/FormDialogFooter.tsx` y `src/components/shared/utils/useAutoFocusPrimerCampo.ts`; cambio aditivo (props opcionales) en `src/components/shared/FormDialogShell.tsx` para no romper los 43 consumidores actuales.
- `DialogRegistrarPago` y `DialogRegistrarPagoParts` se refactorizan para consumir el footer compartido y quedar como referencia única del patrón.
- Los archivos `*.parts.tsx` no llevan el `<form>`: vive en el diálogo padre; los parts sólo reciben los `id` de los campos.
- Sin cambios de lógica de negocio, cálculos, IVA, RPCs ni permisos: es una migración de presentación y accesibilidad. Ningún archivo pasa de 200 líneas (se divide lo que crezca).
- Al cerrar cada ola: entrada en `CHANGELOG.md` y bump de `APP_VERSION`.

## Entrega sugerida

Ola A primero (es donde el usuario captura dinero y fechas todos los días), luego B y C. Si prefieres todo en un solo entregable, también se puede hacer corrido.

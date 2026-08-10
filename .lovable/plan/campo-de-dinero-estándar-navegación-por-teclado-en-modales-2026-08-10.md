# Campo de dinero estándar + navegación por teclado en modales

## Problema

En Tesorería (Registrar movimiento manual y Ejecutar pago programado) el campo de Importe/Monto es un `type="number"` atado directo a un número. Como el estado guarda `0`, el input muestra un `0` que "regresa" al intentar borrarlo y no acepta coma decimal ni separador de miles. El mismo patrón está repetido en ~14 campos de dinero de la app.

Ya existe `NumericInput` (input de texto amigable, permite vaciar), pero no formatea dinero: sin miles, sin decimales fijos, sin coma decimal, y no se usa en Tesorería.

## Qué se va a construir

### 1. `MoneyInput` (campo de dinero estándar)

Nuevo componente compartido, alineado a `docs/design-system.md`:

- Formato en vivo con separador de miles al escribir: `1234567.5` se ve `1,234,567.5`.
- El cursor se mantiene en su lugar al insertar/borrar (se recalcula la posición contando dígitos, no caracteres).
- Acepta coma decimal (`1234,50`) y la trata como punto; ignora cualquier otro carácter.
- Máximo 2 decimales; al salir del campo normaliza a `1,234.50`.
- Se puede borrar por completo: campo vacío = "sin valor" (no un `0` pegajoso). Placeholder `0.00`.
- Selección automática al enfocar, `inputMode="decimal"`, alineado a la derecha con `tabular-nums`, sin spinners.
- Sufijo opcional de moneda (MXN / USD) mostrado dentro del campo cuando el formulario ya conoce la divisa.
- Sin colores hardcodeados: solo tokens del sistema.

### 2. Aplicación en la app

- Tesorería: Importe del movimiento manual y Monto del pago programado (los reportados), más Saldo inicial de nueva cuenta.
- Resto de campos de dinero (CxP pago en lote y vincular conceptos, costeo: flete base, recargos, monto por día de demoras, CRM: monto estimado y valor real, conceptos de cotización) migran a `MoneyInput`.
- Los campos que NO son dinero (días, porcentajes, cantidades, score) se quedan como están o siguen usando `NumericInput`.

### 3. Navegación por teclado en los modales

Revisión y ajuste de `FormDialogShell` y los dos diálogos de Tesorería:

- Orden de tabulación natural: cuenta → fecha → tipo → concepto → referencia → importe → botones del footer.
- Foco inicial en el primer campo útil al abrir, y regreso del foco al botón que abrió el modal al cerrarlo.
- `Esc` cierra, `Enter` en un campo de texto envía el formulario (no cierra sin guardar); el envío respeta el estado deshabilitado.
- Anillo de foco visible en todos los controles, incluido el nuevo campo de dinero.
- Etiquetas correctamente asociadas (`id`/`htmlFor`) y errores anunciados con `aria-invalid` + `aria-describedby`.

## Detalles técnicos

- `src/components/shared/MoneyInput.tsx` (≤200 líneas) + helpers puros de parseo/formateo en `src/components/shared/utils/moneyInputFormat.ts` para poder testearlos aislados.
- El formateo de visualización reutiliza `Intl.NumberFormat("es-MX")`; los totales siguen usando `formatCurrency` de `src/lib/formatters/numbers.ts`. No se toca ninguna lógica de cálculo ni de IVA.
- Los diálogos usan `<form onSubmit>` para que Enter funcione; los primitivos Radix de `Dialog` ya manejan trampa de foco y `Esc`, no se reimplementan.
- Tests: unitarios de los helpers (coma decimal, miles, 2 decimales, campo vacío), interacción de `MoneyInput` (borrar el 0, posición del cursor) y un test de teclado por cada diálogo de Tesorería.
- Al cerrar: entrada en `CHANGELOG.md` y bump de `APP_VERSION`.

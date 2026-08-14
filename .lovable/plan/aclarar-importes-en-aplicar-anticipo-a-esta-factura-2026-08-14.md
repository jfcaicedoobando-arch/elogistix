# Aclarar importes en "Aplicar anticipo a esta factura"

## Problema

El modal sólo muestra una cifra suelta en el encabezado ("Factura FP-000xxx · saldo $X"). Como no dice de dónde sale ese número, parece el subtotal sin IVA, y al compararlo contra un anticipo que se pagó neto el usuario no sabe si va a quedar cubierto o no.

Verificación hecha antes de este plan: el número del modal ya se calcula sobre el **total** de la factura (total − pagos − notas de crédito), y en la base de datos los totales cuadran (0 facturas descuadradas de 153; el `total` ya viene neto de retenciones). En 71 de 153 facturas el total es igual al subtotal porque no tienen IVA (proveedor extranjero / exento), lo que refuerza la sensación de "me muestra el subtotal". Es decir: el cálculo es correcto, lo que falta es el desglose que lo demuestre.

## Solución

Agregar un desglose completo dentro del modal, en dos bloques comparables:

**Bloque "Esta factura"**
- Subtotal
- IVA (y IEPS si existe)
- Retenciones (en negativo)
- Total de la factura
- Ya pagado (pagos aplicados)
- Notas de crédito aplicadas
- **Saldo por pagar** (resaltado, con nota "neto de retenciones")

**Bloque "Anticipo seleccionado"**
- Monto original del anticipo y su moneda
- Ya aplicado a otras facturas
- Disponible
- Monto que se va a aplicar
- **Saldo de la factura después de aplicar** (resaltado, calculado en vivo mientras se teclea el monto)

Además:
- Renombrar la etiqueta a "Monto a aplicar (sobre el saldo por pagar)".
- Si el anticipo es en otra moneda, no mostrar la resta en vivo como definitiva: indicar que el servidor convierte al aplicar (se mantiene el aviso actual, se aclara que el saldo estimado es referencial).
- Quitar la cifra suelta del encabezado para que exista una sola fuente de verdad: el desglose.

## Detalles técnicos

- `AplicarAnticipoDesdeFacturaDialog.tsx` hoy recibe sólo `saldoFactura` y `monedaFactura`. Se extienden sus props con `subtotal`, `iva`, `ieps`, `retenciones`, `total`, `pagado`, `notasCredito` (todos ya presentes en `FacturaCxP` de `proveedorFacturas.types.ts`, así que no hace falta consulta nueva).
- `AnticipoDisponibleAviso.tsx` y `FacturaProveedorTabs.tsx` pasan el objeto `factura` (o los campos) hacia abajo; `FacturaProveedorTabs` ya tiene `f` completo.
- Nuevo componente presentacional `AplicarAnticipoResumen.tsx` con las dos columnas de importes, para no romper el límite de 200 líneas del archivo del modal.
- Nueva función pura `calcularSaldoDespuesDeAplicar()` en `src/features/anticipos-proveedor/domain/`, con pruebas unitarias (mismo importe, importe parcial, exceso, moneda distinta → resultado marcado como estimado).
- Formato con `formatCurrency` y moneda explícita en cada renglón; sin colores ni utilidades hardcodeadas (tokens del design system).
- Sin cambios de base de datos ni de lógica de aplicación del anticipo: sólo presentación.
- `CHANGELOG.md` + `APP_VERSION` → 13.622.0.

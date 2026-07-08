# TC DOF por fecha de emisión en captura de factura de proveedor

## Qué queremos

Cuando el usuario captura una factura de proveedor en moneda distinta a MXN (USD / EUR), el campo **Tipo de cambio a MXN** debe llenarse **solo**, con el TC DOF vigente en la **fecha de emisión** de la factura (no la de hoy). Así queda alineado con lo que el SAT exige para CFDI: la Publicación DOF vigente el día que se emitió el comprobante.

Ejemplo: si la factura fue emitida el 15/06/2025 en USD, el sistema jala el FIX del último día hábil anterior a esa fecha (que es la Publicación DOF vigente el 15/06/2025) y lo pega en el campo.

Analogía: hoy el sistema es un cajero que siempre te da el tipo de cambio del pizarrón del día. Vamos a hacer que primero revise qué día fue emitida la factura y te dé el tipo de cambio que estaba en el pizarrón **ese** día.

## Cómo se va a comportar el modal

1. Con **moneda = MXN**: sin cambios (el campo TC sigue oculto).
2. Cuando el usuario cambia a **USD** o **EUR**, o cuando cambia la **fecha de emisión** estando en USD/EUR, el sistema consulta Banxico automáticamente y llena el campo TC con el DOF de esa fecha. Toast discreto: `TC DOF 15/06/2025 · USD 17.2834`.
3. Debajo del campo TC aparece una línea pequeña con la fecha y la fuente aplicada: "DOF 15/06/2025 · Banxico SF43718". Si el usuario edita el TC a mano, esa línea cambia a "Capturado manualmente".
4. Al lado del campo TC hay un botón chiquito "Obtener DOF" para forzar la consulta (por si Banxico estaba caído la primera vez o cambió la emisión).
5. Si la factura viene de un **XML CFDI**, respetamos el TC que trae el XML (es dato legal del emisor). Igual mostramos el botón "Obtener DOF" por si el usuario lo quiere reemplazar.
6. Si la fecha de emisión es futura o inválida, no consultamos y dejamos el campo editable manualmente como hoy.
7. Si Banxico falla o la fecha es muy vieja y no hay dato, mostramos un aviso suave y dejamos el campo vacío para captura manual. No bloqueamos el guardado (la validación de "TC obligatorio si moneda≠MXN" ya existe).

Mismo comportamiento se aplica al modal de **editar factura de proveedor** para no dejar el editor "más tonto" que la captura.

## Detalles técnicos

### 1. Extender la edge `exchange-rates` para aceptar fecha histórica

Hoy la edge devuelve siempre el TC DOF vigente **hoy** con caché 12 h. Le vamos a agregar un parámetro opcional `fecha=YYYY-MM-DD` (por query string, para poder cachear en el borde por URL):

- Sin `fecha` → comportamiento actual (DOF de hoy, caché 12 h).
- Con `fecha=YYYY-MM-DD` → consulta SF43718 (USD) y SF46410 (EUR) en un rango de 10 días **hacia atrás desde `fecha`** y aplica el mismo `extraerPublicacionDof(data, fecha)` que ya existe (descartar filas con `filaIso >= fecha`).
- Cache en memoria por fecha (Map con key = `fecha`), TTL 30 días para fechas históricas (son inmutables) y 12 h para "hoy".
- SF46410 sigue usando `oportuno` cuando `fecha` es hoy; para fechas históricas también intenta rango, y si Banxico no da dato usa fallback como ahora.
- Contrato de respuesta invariante: `{ usdMxn, eurMxn, fechaAplicada?: string }`. `fechaAplicada` es la fecha de la fila que se usó (útil para mostrar en el hint "DOF 12/06/2025").

### 2. Servicio y hook

- `src/features/catalogos/services/index.ts` → `fetchExchangeRates(fecha?: string)` acepta el nuevo parámetro y lo pasa como query string a la edge. Sin `fecha`, se comporta igual que hoy (retrocompat total; no rompe consumers existentes: hooks de dashboard, cotizaciones, facturación de cliente).
- `src/features/facturacion/hooks/useBanxicoTipoCambio.ts` → agregar sobrecarga que acepta `fecha?: string` (para uso desde CxP; el módulo de facturación de cliente sigue igual porque siempre quiere el DOF de hoy). Alternativamente, hook nuevo `useTcDofPorFecha` para no arriesgar regresiones. Voto por hook nuevo dedicado.

### 3. Hook del formulario CxP

- `useNuevaFacturaProveedorForm` gana un efecto: cuando `values.moneda !== "MXN"` y `values.emision` es un ISO válido, dispara `useTcDofPorFecha` con debounce 250 ms. En `onSuccess` hace `handleChange("tc", String(tc))` y guarda `tcOrigen` (`"dof" | "cfdi" | "manual"`) en state local del hook para renderizar el hint.
- Cuando el usuario edita el campo TC a mano, `handleChange("tc", ...)` marca `tcOrigen = "manual"`.
- Cuando llega CFDI parseado con `tipo_cambio`, `tcOrigen = "cfdi"` y **no** dispara la consulta DOF (respetar dato legal).
- Reset del `tcOrigen` cuando el usuario cambia a MXN o abre el modal en blanco.

### 4. UI en `FacturaProveedorFormFields`

- Nuevo prop `tcOrigen` y `tcFechaAplicada` (opcionales).
- Debajo del `NumericInput` del TC:
  - `tcOrigen === "dof"` → `DOF {fechaAplicada} · Banxico SF43718` en `text-xs text-muted-foreground`.
  - `tcOrigen === "cfdi"` → `Del CFDI del proveedor`.
  - `tcOrigen === "manual"` → `Capturado manualmente`.
- Botón pequeño `Obtener DOF` (variant ghost, size sm) al lado del label, deshabilitado mientras `mutation.isPending`. Al hacer click fuerza el fetch y pisa `tcOrigen = "dof"`.

### 5. Réplica en el modal de edición

- Los mismos props (`tcOrigen`, `tcFechaAplicada`, botón "Obtener DOF") aplican tal cual en `DialogEditarFacturaProveedor` porque comparte `FacturaProveedorFormFields`. El `useEditarFacturaProveedorForm` gana el mismo efecto de auto-fetch.

### 6. Tests

- Unit: nueva rama de `fetchExchangeRates(fecha)` que arma la URL con `?fecha=...`.
- Unit: `useTcDofPorFecha` no dispara si `moneda === "MXN"`, si `emision === ""`, o si emision es fecha futura.
- Unit: helper del hook CxP marca `tcOrigen = "cfdi"` cuando `mapCfdiToValues` llenó el TC.
- Edge: `extraerPublicacionDof` ya está testeado; agregar caso "fecha histórica del 2024" con rango simulado.
- Regresión: `fetchExchangeRates()` sin argumento sigue funcionando idéntico (hooks existentes no cambian).

### 7. Changelog y versión

- Bump `APP_VERSION` a `13.219.0` (feature nueva).
- Entrada en `CHANGELOG.md` explicando el auto-fill de TC DOF por fecha de emisión, con la analogía del cajero.

## Fuera de alcance

- No tocamos el módulo de **facturación de cliente**: ahí siempre se emite hoy, el TC de hoy sigue siendo lo correcto. Sólo comparte la edge, que queda retrocompatible.
- No tocamos pagos a proveedor (el TC de pago sí es la fecha del pago, tema aparte).
- No cambiamos la política del CFDI: si el XML trae TC, gana el XML.


## Objetivo

En facturas **USD/EUR**, el tipo de cambio nace y permanece **vacío** hasta que el usuario lo capture manualmente o lo obtenga con el botón "Obtener TC DOF de hoy". El timbrado queda **bloqueado** mientras el TC sea nulo/cero. Facturas en **MXN** no se ven afectadas (TC siempre = 1, invisible).

Analogía: es el cinturón de seguridad — el auto no arranca hasta que suena el clic.

## Cambios

### 1. Base de datos (migración)
- En `public.facturas`, cambiar el default de `tipo_cambio` de `1` a `NULL` (la columna ya es nullable o se hará nullable si hace falta).
- **No** se tocan facturas existentes (ya timbradas o borradores viejos conservan su valor).
- El trigger/RPC que crea facturas desde proforma (`convertir_proforma_a_factura` o similar) se ajusta: si la moneda ≠ `MXN`, inserta `tipo_cambio = NULL`; si es `MXN`, inserta `1`.

### 2. Formulario de datos fiscales (`FacturaDatosFiscalesCard` + `DatosFiscalesForm`)
- `inicialesDatosFiscales`: para moneda ≠ MXN, si `factura.tipo_cambio` es null/0, el estado inicial es **vacío** (string `""`), no `1`.
- El input de TC acepta vacío sin auto-rellenar. El auto-save envía `tipo_cambio: null` cuando está vacío (o simplemente omite la escritura hasta que haya un valor válido > 0).
- **Banner rojo** dentro de la card cuando `moneda ≠ MXN && (tipo_cambio == null || tipo_cambio <= 0)`:
  > ⚠ Falta capturar el tipo de cambio del día. Usa "Obtener TC DOF de hoy" o escríbelo manualmente antes de timbrar.

### 3. Checklist de timbrado (`DialogTimbrarFactura` + test)
- Agregar una nueva regla al checklist fiscal: `tipo_cambio_valido` → `ok = moneda === "MXN" || (tipo_cambio && tipo_cambio > 0)`.
- Etiqueta: "Tipo de cambio del día capturado".
- Actualizar `DialogTimbrarFactura.checks.test.ts` con el caso extra (válido MXN, válido con TC>0, inválido con TC vacío/0 en USD).
- `puedeTimbrar` sigue siendo `checks.every(ok)`, así que bloquea el botón automáticamente.

### 4. Edge function `facturapi-emitir` (defensa en profundidad)
- Antes de armar el payload, si `factura.moneda !== "MXN"` y `!factura.tipo_cambio`, devolver error `422 tipo_cambio_requerido` con mensaje claro. Evita que un bug de UI llegue a FacturAPI con TC=1.

### 5. Versionado + Changelog
- `APP_VERSION` → `13.171.0` (feature menor, cambio de comportamiento visible).
- Entrada en `CHANGELOG.md`:
  > Facturas USD/EUR nacen sin tipo de cambio precargado. Se agrega banner y check obligatorio para forzar consulta del TC DOF del día antes de timbrar.

## Fuera de alcance
- No se modifican facturas ya timbradas ni sus TC históricos.
- No se toca la lógica de reportes/rentabilidad ni proformas (las proformas conservan su TC informativo).
- No se cambia el catálogo de FacturAPI ni la lógica de impuestos.

## Verificación
1. Crear proforma USD → convertir a factura → abrir detalle: campo TC vacío, banner rojo visible.
2. Intentar timbrar → checklist muestra ✗ "Tipo de cambio del día capturado", botón deshabilitado.
3. Click "Obtener TC DOF de hoy" → se llena y auto-guarda → banner desaparece → checklist en verde → timbrado habilitado.
4. Factura MXN → sin campo TC, sin banner, timbrado sin fricción (regresión).
5. Facturas viejas con TC=1 ya guardado → siguen funcionando (no se limpian retroactivamente).

¿Aplico este plan?

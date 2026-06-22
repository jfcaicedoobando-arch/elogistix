## Problema

El Paso 2 del wizard "Nuevo proveedor" sólo ofrece banco mexicano (lista `BANCOS_MEXICO`) y CLABE de 18 dígitos. Para proveedores **Extranjeros** (transferencias internacionales) esos campos no aplican: necesitan SWIFT/BIC, IBAN o account number, dirección del banco, etc.

Analogía: hoy el formulario es como un sobre con casilla "código postal mexicano". Si el destinatario vive en otro país, esa casilla estorba — hay que mostrar la dirección internacional en su lugar.

## Solución

Mostrar campos diferentes en Paso 2 según `origen_proveedor`:

**Si `Nacional`** (igual que hoy):
- Banco (select `BANCOS_MEXICO`)
- CLABE interbancaria (18 dígitos)

**Si `Extranjero`** (nuevo):
- Nombre del banco (texto libre)
- País del banco (texto libre)
- SWIFT / BIC (8 u 11 caracteres alfanuméricos)
- IBAN o número de cuenta (texto libre)
- ABA / Routing number (opcional, para EE.UU.)
- Dirección del banco (opcional, textarea)
- Banco intermediario y su SWIFT (opcionales, un solo input cada uno)
- Beneficiario (texto, default = nombre del proveedor)
- Referencia / notas para el pago (opcional)

Todo opcional — el wizard sigue permitiendo guardar sin datos bancarios.

## Cambios técnicos

### 1. Migración de base de datos
Agregar columnas nullable a `public.proveedores`:
- `banco_pais` text
- `swift_bic` text
- `iban` text
- `aba_routing` text
- `banco_direccion` text
- `banco_intermediario` text
- `banco_intermediario_swift` text
- `beneficiario` text
- `referencia_pago` text

(Reutilizamos `banco` como nombre del banco — funciona para nacionales e internacionales.)

### 2. Frontend
- **`useNuevoProveedorController.constants.ts`**: agregar los 9 campos al `EMPTY_PROVEEDOR_FORM`.
- **`NuevoProveedorStep2.tsx`**: split en dos sub-componentes (`Step2DatosNacional`, `Step2DatosInternacional`) y elegir según `c.form.origen_proveedor`. Mantener archivo ≤200 líneas.
- **`useNuevoProveedorController.ts`**: validar SWIFT con regex `/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/` (sólo si se capturó), y omitir la validación de CLABE cuando es extranjero.
- **`proveedoresCrud.ts`**: agregar los nuevos campos al `SELECT` constante.
- **`EditarProveedorDialog.tsx` + `useEditarProveedorController.ts`**: replicar los mismos campos condicionales para editar.
- **`ProveedorDatosBancariosCard.tsx`**: mostrar bloque internacional cuando el proveedor tenga SWIFT/IBAN, ocultando los campos vacíos.

### 3. Tests
Actualizar `useNuevoProveedorController.test.tsx` y `useEditarProveedorController.test.tsx` para cubrir:
- Extranjero sin CLABE pasa validación.
- SWIFT inválido bloquea guardado.

### 4. Versionado y changelog
- `APP_VERSION` → `13.105.0` (feat).
- Entrada `[13.105.0]` en `CHANGELOG.md` describiendo soporte de datos bancarios internacionales.

## Fuera de alcance
- No tocamos el módulo de Pagos (CxP). Hoy `pagos_proveedor` ya guarda monto/moneda/método/referencia sin validar contra los datos bancarios; eso sigue igual.
- No agregamos validación de IBAN por país (sólo formato libre).
- No migramos proveedores existentes — las columnas quedan en `NULL` y se llenan al editar.

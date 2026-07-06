
# Recordar datos generales por cliente al timbrar

## Objetivo
Que al timbrar una nueva factura para un cliente, los campos **Uso de CFDI**, **Forma de pago**, **Método de pago** y los **correos CC** del envío se prellenen automáticamente con lo usado la vez anterior, sin dejar de ser editables.

## Cómo funcionará (analogía)
Piensa en el navegador guardando lo que sueles escribir en un formulario: la próxima vez lo sugiere solo, pero puedes cambiarlo antes de enviar.

Regla de resolución (en este orden):
1. **Preferencia guardada** en la ficha del cliente (si existe).
2. **Última factura timbrada** del mismo cliente (si no hay preferencia).
3. Valor por defecto actual del sistema (G03 / 03 / PUE).

Al timbrar (o enviar) exitosamente, la preferencia se **actualiza automáticamente** con lo que se usó, para que la siguiente vez ya venga cargada.

## Alcance
Campos que se recordarán:
- Uso de CFDI
- Forma de pago
- Método de pago
- Correos CC del envío por email

Fuera de alcance: serie, moneda, conceptos.

## Cambios

### 1. Base de datos (migración)
Agregar a `public.clientes`:
- `forma_pago_default text`
- `metodo_pago_default text`
- `email_cc_default text[]` (lista de correos)

(Ya existe `uso_cfdi_default`; se reutiliza.)

Nueva función SQL `obtener_defaults_facturacion_cliente(p_cliente_id uuid)` (SECURITY DEFINER, respetando `organization_id`) que devuelve `{uso_cfdi, forma_pago, metodo_pago, cc_emails}` aplicando el orden: preferencia del cliente → última factura timbrada → null.

### 2. Timbrado (`DialogTimbrarFactura.tsx`)
- Al abrir, llamar al RPC anterior y sembrar los `useState` con esos valores en vez de solo `cliente.uso_cfdi_default ?? 'G03'`.
- Tras timbrado exitoso, un `UPDATE` a `clientes` guardando los tres campos usados como nuevos defaults.

### 3. Envío por email (`useEnvioDocumentoForm.ts` / `EnviarDocumentoDialog.tsx`)
- Precargar `ccManual` (o marcados) con `email_cc_default` del cliente si existe; si no, con los CC de la última factura enviada (ya hay `useDestinatariosSugeridos` para proformas — replicar patrón para facturas).
- Tras envío exitoso, guardar los CC finales en `clientes.email_cc_default`.

### 4. UX
- Los campos permanecen totalmente editables; sin badge extra (se mantiene la UI actual).
- No se toca la lógica de negocio del timbrado ni del envío; solo el valor inicial y una escritura de preferencias al finalizar.

### 5. Versionado
- `APP_VERSION` → bump patch.
- Entrada en `CHANGELOG.md`.

## Archivos previstos
- Migración SQL nueva.
- `src/features/facturacion/services/datosFiscalesCliente.ts` (nuevo lector con fallback).
- `src/features/facturacion/components/DialogTimbrarFactura.tsx` (hidratación + guardado post-timbrado).
- `src/hooks/emails/useEnvioDocumentoForm.ts` (precarga CC).
- `src/features/facturacion/services/mutations/enviarFacturaEmail.ts` (persistir CC al éxito).
- `src/constants/appVersion.ts`, `CHANGELOG.md`.

## Riesgos / notas
- El guardado post-éxito se hace en `UPDATE` simple; si falla no rompe el flujo (silent-catch con log).
- RLS: la escritura a `clientes` ya está permitida a usuarios de la organización.

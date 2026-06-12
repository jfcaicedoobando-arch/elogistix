## Agregar método de pago SPID (USD)

SPID (Sistema de Pagos Interbancarios en Dólares) es el equivalente de SPEI pero para transferencias en USD dentro de México. Lo agrego al catálogo de métodos de pago a proveedor.

### Cambios

1. **`src/components/cxp/pagoProveedorHelpers.ts`**
   - Agregar `"SPID"` a `METODOS_NACIONAL` (después de `SPEI`).
   - Agregar `"SPID"` a `METODOS_EXTRANJERO` (al inicio, antes de "Transferencia internacional"), ya que SPID también aplica para pagos USD a beneficiarios.
   - En `referenciaHint`: agregar caso `"SPID"` → `"Clave de rastreo SPID (clave única)"`.
   - Default `defaultMetodo` se mantiene (SPEI nacional, Transferencia internacional extranjero).

2. **`CHANGELOG.md`** + **`src/constants/appVersion.ts`**
   - Bump a `12.93.1`, entrada: "Agregado método de pago SPID (USD) en pagos a proveedor".

### Notas
- No requiere migración de BD: `metodo_pago` es texto libre.
- El diálogo de la captura (`Registrar pago a proveedor`) ya consume `metodosFor(origen)`, así que SPID aparece automáticamente.

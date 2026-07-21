## Objetivo

Cuando el usuario sube un XML de CFDI en el diálogo "Nueva factura de proveedor":

1. Mostrar una **vista previa** de los conceptos extraídos del XML antes de confirmar.
2. Al guardar la factura, **persistir automáticamente los conceptos** como líneas en `proveedor_facturas_conceptos` (hoy sólo se guardan totales agregados).

Alcance limitado a captura de facturas de proveedor vía XML (CxP). No modifica captura manual ni edición posterior.

---

## Flujo propuesto

```text
Usuario sube XML
   → parse-cfdi-xml devuelve cfdi.conceptos (ya funciona)
   → procesarCfdiParsed valida cuadre (ya funciona)
   → NUEVO: se guardan conceptos en el estado del hook
   → NUEVO: DialogNuevaFacturaProveedor muestra tabla "Conceptos del CFDI"
             (descripción, cantidad, importe, IVA, IEPS) — solo lectura
   → Usuario revisa/confirma resto del formulario y da "Registrar"
   → runSubmit crea la factura (como hoy)
   → NUEVO: tras crear, se hace bulk-insert en proveedor_facturas_conceptos
             con concepto_costo_id = NULL (la vinculación a conceptos_costo
             sigue siendo manual mediante los "vínculos" ya existentes)
```

### Coexistencia con vínculos existentes

Hoy `vincularSafe` inserta filas en `proveedor_facturas_conceptos` **solo** cuando el usuario vincula un concepto de costo del embarque. Esas filas llevan `concepto_costo_id` poblado.

Los nuevos registros del CFDI son distintos: representan las **líneas fiscales del XML** y llevarán `concepto_costo_id = NULL`. Ambos tipos conviven en la misma tabla — es exactamente el diseño actual (la columna ya es nullable).

Para evitar duplicados cuando el usuario también vincula un concepto de costo del embarque al mismo importe: las líneas del CFDI son informativas (con `concepto_costo_id = NULL`) y las vinculadas son adicionales. Se documenta en comentario del código.

---

## Cambios técnicos

### 1. Tipos y estado del hook

- `src/features/cxp/hooks/useNuevaFacturaProveedorForm.cfdi.ts`: agregar `conceptos: CfdiConceptoParsed[]` (+ `cantidad` y `clave_unidad` si el parser los devuelve — validar) al `ProcesarCfdiResult` ok.
- `src/features/cxp/hooks/useNuevaFacturaProveedorForm.ts`:
  - Nuevo estado `cfdiConceptos: CfdiConceptoParsed[]`.
  - `handleCfdiParsed` guarda los conceptos.
  - `reset()` los limpia.
  - Exportarlos en el retorno del hook.

### 2. Parser (verificar cantidad/clave_unidad)

- `supabase/functions/parse-cfdi-xml/parser.ts` y `parseCfdi.types.ts`: si aún no exponen `cantidad` y `clave_unidad`, agregarlos al tipo `CfdiConceptoParsed` y al parser. (La tabla destino tiene ambas columnas.) Redesplegar edge function.

### 3. Nueva UI de vista previa

- Nuevo componente `src/features/cxp/components/CfdiConceptosPreview.tsx` (≤200 líneas):
  - Tabla compacta con columnas: Descripción, Cantidad, Importe, IVA, IEPS.
  - Fila total al pie.
  - Se muestra sólo cuando `mode === "cfdi"` y hay conceptos.
- `DialogNuevaFacturaProveedor.tsx`: renderizarlo después de `CargaCfdiSection` y antes del bloque de datos generales.

### 4. Persistencia en submit

- `src/features/cxp/hooks/useNuevaFacturaProveedorForm.sideEffects.ts`: nueva función `insertarConceptosCfdi({ facturaId, organizationId, conceptos })` que hace bulk-insert en `proveedor_facturas_conceptos` con `concepto_costo_id: null`. Envolver en try/catch al estilo `uploadCfdiSafe` (falla no revierte la factura, sólo agrega warning al toast final).
- `src/features/cxp/hooks/useNuevaFacturaProveedorForm.submit.ts`: llamar `insertarConceptosCfdi` cuando `pendingCfdi` existe y hay conceptos.
- Pasar `cfdiConceptos` desde el hook al `runSubmit`.

### 5. Tests

- Unit test para `insertarConceptosCfdi` (mock Supabase): valida payload correcto y captura de errores sin lanzar.
- Test en `useNuevaFacturaProveedorForm.test.tsx`: tras `handleCfdiParsed`, `cfdiConceptos` queda poblado; tras `reset()` queda vacío.
- Test de parser: si se agregan `cantidad`/`clave_unidad`, extenderlo (regresión).

### 6. Changelog y versión

- Bump `APP_VERSION` (`13.303.67`) y entrada en `CHANGELOG.md`.

---

## No hace

- No cambia RLS ni schema (la tabla ya existe, columnas ya nullable, GRANTs ya presentes).
- No auto-vincula a `conceptos_costo`. El matching sugerido sigue siendo manual mediante `SugerirEmbarqueBlock` / vínculos.
- No modifica la edición posterior de la factura (`useEditarFacturaProveedorForm`). Si quieres editar/agregar conceptos después, lo hacemos en una segunda fase.
- No toca el flujo de captura manual (sin XML).

---

## Preguntas abiertas

Ninguna bloqueante. Si prefieres que la vista previa sea **editable** (permitir corregir descripciones/importes antes de guardar) en lugar de solo lectura, dímelo y lo ampliamos — pero eso rompe la garantía fiscal del XML original. NO
## Auditoría visual — vista `/facturacion/:id`

### Sobre la Serie: sí, la quitamos
Tienes razón. En `supabase/functions/facturapi-emitir/index.ts` el flujo real es:

```
serieTimbrada = fapiJson.series ?? ctx.serie
numero = `${serieTimbrada}${folio}`
```

**FacturAPI es la fuente de verdad** para serie y folio; lo que mandamos es solo un "hint" opcional. Si el tenant configuró una única serie en su cuenta de FacturAPI (caso normal), teclearla aquí solo introduce riesgo de discrepancia. Un input libre de 5 letras además permite escribir cualquier cosa ("XXX", "TEST") sin validar contra las series realmente dadas de alta. **Se elimina.** Si en el futuro un tenant maneja varias series, se agrega un `Select` alimentado por la tabla `factura_series`.

### Información duplicada detectada

| # | Dato | Aparece en | Veces |
|---|---|---|---|
| 1 | **Total** | Header (grande a la derecha) + `FacturaResumenCard` (tarjeta destacada) | 2 |
| 2 | **Moneda** | Header (junto al total) + `FacturaResumenCard` | 2 |
| 3 | **Cliente** | Header (subtítulo) + `FacturaResumenCard` | 2 (aceptable: uno identifica, otro linkea) |
| 4 | **Expediente** | Header (subtítulo) + `FacturaResumenCard` | 2 |
| 5 | **Notas** | `FacturaResumenCard` (readonly) + `FacturaDatosFiscalesCard` (Textarea editable) | 2 |
| 6 | **Checklist fiscal** (RFC/CP/Régimen/…) | `FacturaFiscalCheckAlert` banner + `FacturaDatosFiscalesCard` lista + `DialogTimbrarFactura` lista | 3 |
| 7 | **Uso CFDI / Forma pago / Método pago** | `FacturaDatosFiscalesCard` (editar) + `DialogTimbrarFactura` (editar) | 2 |
| 8 | **Serie** | Ambos lugares anteriores | 2 (además, la elimino) |

### Información pendiente que falta para timbrar cómodo

Datos que sí van en el CFDI/PDF pero no se ven en la pantalla:
- **Emisor**: razón social, RFC y régimen del tenant que va a emitir (importante en multi-tenant/multi-emisor).
- **Receptor completo readonly**: RFC, CP, régimen fiscal, uso CFDI por defecto. Hoy solo se infieren desde el checklist.
- **Uso CFDI / Forma / Método de pago en formato legible** (ej. "G03 – Gastos en general"), no solo el código.
- **Días de crédito** en formato legible, no solo dentro del formulario.
- **Datos post-timbrado**: UUID fiscal, folio, serie asignada, fecha de timbrado, links a PDF/XML (hoy sí hay descarga pero no se ven los identificadores).
- **Fecha de emisión y vencimiento** ya están, correcto.
- **Sustituye a / Sustituida por** cuando hay reemplazo CFDI 04.

### Design language

El resto del proyecto (proformas, cotizaciones) usa `PageContainer` + header en `flex` + `CardTitle text-lg`. Aquí ya está así, pero el **orden actual es confuso**: el editor fiscal aparece antes que el resumen, y no hay separación entre datos de identificación, de la contraparte, y de configuración de timbrado.

---

## Plan de cambios

### 1. Nueva sección "Datos generales" (renombrar `FacturaResumenCard`)
Quitar duplicados con el header:
- Eliminar campos: **Moneda** (ya va con el total en header), **Cliente**, **Expediente** (ya están en el subtítulo). Mantener como links solo si el usuario los pide de vuelta.
- Mantener: Emisión, Vencimiento, Tipo de cambio (si aplica), Referencia BL, Proforma origen, Sustituye a.
- Agregar: **Días de crédito**, **Uso CFDI legible**, **Forma de pago legible**, **Método de pago legible** (readonly, muestran lo que se timbrará).
- Mover **Notas** aquí (readonly). Quitar la caja de notas del form editable — se edita desde el editor de conceptos/notas del borrador, no en la "config de timbrado".
- Quitar el bloque Subtotal/IVA/Total; se mueven a una card propia (ver #5).

### 2. Nueva card "Emisor" (readonly)
Muestra: razón social, RFC, régimen fiscal del tenant/organización que va a timbrar. Se lee de `emisor.ts` / configuración del tenant. Útil en multi-tenant y da claridad al usuario ("¿desde qué empresa estoy timbrando?").

### 3. Nueva card "Receptor" (unifica el checklist)
Reemplaza `FacturaFiscalCheckAlert` + la lista de checks dentro de `FacturaDatosFiscalesCard`.
Grid con: Cliente (link), RFC, CP, Régimen fiscal, Uso CFDI por defecto. Cada campo con un ícono ✓/✗ inline si falta. Botón **"Editar cliente"** que lleva a `/clientes/:id` cuando algo falta. Solo se muestra el banner rojo arriba si hay campos faltantes; si todo está ok, la card se ve limpia.

### 4. Renombrar `FacturaDatosFiscalesCard` → "Configuración de timbrado"
Sólo cuando es borrador editable. Contenido reducido:
- **Elimina Serie** (FacturAPI la asigna).
- **Elimina checklist** (vive ahora en card "Receptor").
- **Elimina Notas** (viven en "Datos generales").
- Deja: Uso CFDI, Forma de pago, Método de pago, Días de crédito, Tipo de cambio (solo si moneda ≠ MXN).
- Botón "Guardar cambios".

### 5. Nueva card "Totales"
Bloque grande con Subtotal / IVA / Total y el desglose por moneda (si aplica). Reemplaza el bloque que estaba enterrado al final de `FacturaResumenCard`.

### 6. Nueva card "Timbrado" (solo si `estado !== 'Borrador'`)
UUID fiscal, folio, serie asignada, fecha de timbrado, con botones para copiar UUID y descargar PDF/XML. Da confirmación visual de que la factura ya vive en el SAT.

### 7. Simplificar `DialogTimbrarFactura`
Como la card "Configuración de timbrado" ya edita los campos, el diálogo pasa a ser **confirmación**:
- Muestra un resumen readonly de lo que se va a timbrar (Emisor → Receptor, Uso CFDI, Forma/Método, Total).
- Checklist compacto (sin duplicar edición).
- Checkbox "Enviar CFDI por email" (queda).
- Sin inputs — todos los cambios se hacen en la card antes de abrir el diálogo.
- Se **elimina el input Serie** de aquí también.

### 8. Housekeeping
- Bump `APP_VERSION` a `13.164.3`.
- Entrada en `CHANGELOG.md`.
- Actualizar tests que asumen "Serie" como campo (buscar en `DialogTimbrarFactura.checks.test.ts`, `helpers_test.ts` — se dejan como están porque validan lo que llega al backend, pero se remueve el input UI).

### Fuera de alcance
- Cambios en edge functions de FacturAPI (siguen aceptando `serie` como opcional — no rompe nada).
- Cambios en el PDF/XML.
- Multi-serie con `Select` desde `factura_series` (queda para cuando algún tenant lo necesite).
- Timeline horizontal (Borrador → Emitida → Pagada) — se puede agregar en una iteración posterior si lo pides.

### Detalle técnico
- Nuevos componentes en `src/features/facturacion/components/detalle/`: `FacturaEmisorCard.tsx`, `FacturaReceptorCard.tsx`, `FacturaTotalesCard.tsx`, `FacturaTimbradoCard.tsx`.
- Renombrar `FacturaResumenCard.tsx` → `FacturaDatosGeneralesCard.tsx`.
- Renombrar `FacturaDatosFiscalesCard.tsx` → `FacturaConfigTimbradoCard.tsx` y podar campos.
- Actualizar `FacturaDetalleEditableSections.tsx` para orquestar el nuevo orden.
- Actualizar `DialogTimbrarFactura.tsx` a modo confirmación.
- Reutilizar `formatCurrency`, `formatDate`, `USOS_CFDI_SAT`, `FORMAS_PAGO_SAT`, `METODOS_PAGO_SAT` para los "legibles".

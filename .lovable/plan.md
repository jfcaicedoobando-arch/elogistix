
# Plan: Factura manual sin proforma (v13.93.0)

## Contexto

Hoy **toda factura nace de una proforma** (que a su vez nace de un embarque). Isela necesita poder emitir un CFDI suelto para casos como:

- Anticipos de cliente
- Servicios extra fuera de embarque (asesoría, almacenaje suelto, gastos administrativos)
- Refacturaciones / ajustes manuales

**Analogía:** hoy sólo puedes "facturar un viaje terminado". Queremos un botón "facturar otro cargo" para cobros que no son un embarque completo.

## Alcance

### 1. UI — Botón "Nueva factura manual"

- En `/facturacion` (dashboard) → botón primario arriba a la derecha: **"+ Nueva factura"** con menú:
  - "Desde proforma aprobada" (flujo actual, lleva a tab "Por timbrar")
  - "Factura manual (sin embarque)" → abre wizard nuevo
- También botón en tab "1. Por timbrar" (empty state).
- Visible solo si `canEmitirFactura` (admin / contador).

### 2. Wizard `DialogNuevaFacturaManual` (3 pasos)

1. **Cliente y datos fiscales** — selector de cliente existente; auto-llena RFC / régimen / CP / uso CFDI default. Validación: cliente debe tener datos fiscales completos.
2. **Conceptos** — tabla editable (descripción, cantidad, precio unitario, clave SAT producto/servicio, clave unidad). Mínimo 1 concepto. Cálculo en vivo de subtotal, IVA (vía `useTasaIVA`), total. Moneda MXN o USD.
3. **Condiciones de pago** — serie, forma de pago, método (PUE/PPD), días de crédito, fecha de emisión.

Botón final: **"Guardar borrador"** (queda en "Por timbrar") o **"Guardar y timbrar"** (llama `facturapi-emitir`).

### 3. Backend / DB

- Nueva migración: hacer `proforma_id` y `embarque_id` **nullables** en `facturas` (si no lo son ya). Agregar columna `origen` (`'proforma' | 'manual'`, default `'proforma'`).
- Nueva tabla `factura_conceptos_manuales` (id, factura_id FK cascade, descripcion, cantidad, precio_unitario, clave_sat_producto, clave_sat_unidad, importe). RLS + GRANT estándar multi-tenant.
- Servicio nuevo `crearFacturaManual()` en `src/features/facturacion/services/facturaManual.ts`: inserta factura + conceptos, idempotente.
- Edge function `facturapi-emitir` ya existe — ajustar para que si `factura.origen === 'manual'` lea conceptos de la nueva tabla en vez de la proforma.

### 4. Listados

- Tabs "Por timbrar" y "Emitidas" muestran facturas manuales con badge **"Manual"** junto al número, sin columna de expediente (queda vacía o muestra "—").
- Filtro adicional en "Emitidas": chip "Solo manuales".

### 5. Permisos y auditoría

- Solo `canEmitirFactura` puede crear/timbrar.
- Cada acción registra en `bitacora_actividad` con tipo `factura_manual_creada` / `factura_manual_timbrada`.

### 6. Changelog y versión

- Bump `APP_VERSION` → `13.93.0`.
- Entrada en `CHANGELOG.md` raíz.

## Lo que NO cambia

- Flujo proforma → factura (sigue siendo el camino principal y recomendado).
- Cancelación, REP, notas de crédito, cobranza: reutilizan la misma factura, no importa el origen.
- Permisos de otros roles.
- Cálculos financieros (IVA dinámico, USD/MXN, `currency.js`).

## Riesgos

- **Conceptos SAT:** Isela debe conocer la clave SAT producto/servicio. Mitigación: combobox con búsqueda + último usado por cliente como sugerencia.
- **Falta de embarque** rompe reportes de rentabilidad por embarque. Mitigación: las facturas manuales se excluyen del reporte de rentabilidad y aparecen en una sección aparte "Cargos sin embarque".
- **FacturAPI:** ya soporta emitir CFDI desde JSON arbitrario, no requiere cambios de configuración.

## Detalles técnicos (referencia)

```text
src/features/facturacion/
├── components/
│   ├── DialogNuevaFacturaManual.tsx        (nuevo, wizard 3 pasos)
│   └── BotonNuevaFactura.tsx               (nuevo, dropdown del dashboard)
├── hooks/
│   └── useCrearFacturaManual.ts            (nuevo)
├── services/
│   └── facturaManual.ts                    (nuevo, CRUD)
└── routes/Facturacion.tsx                  (modificado, integra botón)

supabase/migrations/
└── <ts>_factura_manual.sql                 (nullable FKs + tabla conceptos + RLS/GRANTs)

supabase/functions/facturapi-emitir/
└── index.ts                                (rama por origen)
```

## Pregunta antes de implementar

Hay **un detalle de negocio** que necesito confirmar contigo antes de empezar: ¿la factura manual debe seguir requiriendo **cliente registrado en la BD**, o también permitir capturar RFC/datos fiscales libres (cliente "ocasional")? Lo más limpio y consistente con el resto del sistema es **siempre desde cliente registrado** — si necesitas facturar a alguien nuevo, primero lo das de alta en Clientes. Voy con esa opción salvo que prefieras lo contrario.

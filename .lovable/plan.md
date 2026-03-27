

# Plan: Generar Data Demo para Demo Logistics MX

## Situación actual
La organización "Demo Logistics MX" (ID: `05ac6723...`) tiene:
- **2 clientes**, **4 proveedores**, **2 embarques**, **3 cotizaciones**, **2 facturas**
- Usuario jorge.quintana@expertdata.io tiene rol global `viewer` pero rol org `admin`

**Problema**: El rol global es `viewer`, lo que bloquea operaciones CRUD vía RLS. Necesita ser actualizado a `admin` o `operador` para poder insertar data.

## Plan de ejecución

### Paso 1 — Corregir rol global del usuario
Actualizar `user_roles` de `viewer` a `admin` para jorge.quintana para que las políticas RLS permitan CRUD.

### Paso 2 — Crear 6 clientes nuevos (8 total)
Empresas mexicanas realistas con datos completos:

| Cliente | RFC | Ciudad | Sector |
|---------|-----|--------|--------|
| Plásticos Industriales de Querétaro | PIQ250101 | Querétaro | Manufactura |
| Textiles La Moderna | TLM250201 | Puebla | Textil |
| Electrónica Avanzada del Norte | EAN250301 | Monterrey | Electrónica |
| Agroexport del Bajío | AEB250401 | León | Agroindustria |
| Químicos Especializados MX | QEM250501 | CDMX | Química |
| AutoPartes Centrales | APC250601 | Aguascalientes | Automotriz |

### Paso 3 — Crear 3 proveedores nuevos (7 total)
| Proveedor | Tipo |
|-----------|------|
| Maersk Line México | Naviera |
| DHL Global Forwarding | Agente |
| Almacenadora del Puerto | Almacén |

### Paso 4 — Crear ~25 embarques con workflow coherente
Distribución por estado que refleje operación real:

| Estado | Cantidad | Fechas ETD/ETA |
|--------|----------|----------------|
| Cerrado | 4 | Ene-Feb 2026 |
| EIR | 2 | Feb 2026 |
| Entregado | 3 | Feb-Mar 2026 |
| En Aduana | 2 | Mar 2026 |
| Arribo | 3 | Mar 2026 (algunos con demora >7 días) |
| En Tránsito | 5 | Mar-Abr 2026 |
| Confirmado | 6 | Abr-May 2026 |

- Modos: ~15 Marítimo, ~5 Aéreo, ~3 Terrestre, ~2 Multimodal
- Tipos: ~18 Importación, ~5 Exportación, ~2 Nacional
- Cada uno con 2-4 conceptos de venta y 2-5 conceptos de costo (para generar profit)
- Rutas realistas: Shanghai→Manzanillo, Shenzhen→CDMX, Houston→Monterrey, etc.

### Paso 5 — Crear 5 cotizaciones adicionales (8 total)
En distintos estados: 2 Borrador, 1 Enviada, 1 Aceptada, 1 Rechazada

### Paso 6 — Crear 6 facturas adicionales (8 total)
Vinculadas a embarques cerrados/entregados: 2 Pagada, 2 Emitida, 1 Vencida, 1 Borrador

### Paso 7 — Registrar en bitácora
Insertar entradas de actividad para las operaciones principales del usuario.

### Paso 8 — Verificar vía browser
Navegar Dashboard, Embarques, Clientes y Cotizaciones para confirmar que la data se muestra correctamente y que los KPIs tienen sentido.

## Detalle técnico
- Toda la data se inserta con `organization_id = '05ac6723-1b76-47ba-8f64-2f70a82e77a3'`
- Los embarques se crean vía la RPC `crear_embarque_completo` para generar expedientes automáticos
- Las facturas se insertan directamente con folios secuenciales `DLM-F003` a `DLM-F008`
- Los conceptos de venta/costo usan monedas USD y MXN con tipos de cambio realistas (~17.2-17.8)


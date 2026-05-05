## Rediseño tab "Proyección" estilo Cierre Mensual

Transformar el resumen actual de 4 tarjetas en un **bloque visual tipo "CIERRE [MES]"** con 3 tarjetas grandes (Facturado, Pendiente, Proyectado), cada una mostrando embarques + USD + MXN. La tabla de detalle gana columnas de Venta USD + Venta MXN.

### 1. Lógica de dominio (`src/lib/domain/proyeccionFacturacion.ts`)

Agregar tracking de USD en paralelo al MXN existente:

- `FilaProyeccion`: añadir `venta_usd: number` y `costo_usd: number`.
- `GrupoProyeccion`: añadir `ventaUsd`, `costoUsd`, `profitUsd`.
- `KpisProyeccion`: añadir `ventaProyUsd`, `ventaFacturadaUsd`, `ventaPendienteUsd`, `costoTotalUsd`, `profitProyUsd`.
- `agruparPorExpediente` y `calcularKpisProyeccion`: sumar también las versiones USD.

### 2. Servicio (`src/services/facturas/proyeccion.ts`)

- Calcular `venta_usd` y `costo_usd` usando `convertirAUSD` con el TC del embarque, en paralelo a la conversión MXN existente. Sin nuevas queries.

### 3. UI (`src/components/facturacion/TabProyeccion.tsx`)

**Header (sin cambios):** selector de mes + botón Exportar CSV.

**Bloque "Cierre [Mes Año]"** — reemplaza la grid de 4 KPIs por 3 tarjetas grandes:

```text
┌─ CIERRE ABRIL 2026 ────────────────────────────────────────┐
│                                                            │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│ │ ✅ FACTURADO │ │ ⏳ PENDIENTE │ │ 📈 PROYECTADO (mes)  │ │
│ │              │ │              │ │                      │ │
│ │ Embarques: 7 │ │ Embarques: 5 │ │ Embarques: 12        │ │
│ │ USD $12,500  │ │ USD $8,700   │ │ Venta USD $21,200    │ │
│ │ MXN $85,000  │ │ MXN $39,500  │ │ Venta MXN $124,500   │ │
│ │              │ │              │ │ Costo MXN $XXX       │ │
│ │              │ │              │ │ Profit $XXX (XX%)    │ │
│ └──────────────┘ └──────────────┘ └──────────────────────┘ │
│                                                            │
│  Progreso facturación: ████████░░  58% (7/12)              │
└────────────────────────────────────────────────────────────┘
```

Detalles visuales:
- Card contenedora con título "Cierre [Mes Año]" en mayúsculas.
- 3 tarjetas internas con borde lateral de color (verde / ámbar / azul) e ícono grande superior.
- Tipografía amplia para los números (text-2xl, tabular-nums).
- Barra de progreso `Progress` debajo mostrando avance (facturados/total).
- Tarjeta Profit incluye margen en %, color rojo si negativo / ámbar si <10% / verde si ≥10%.
- Mantener nota informativa: *"Montos en MXN convertidos al TC del embarque. USD muestra los conceptos en su moneda original sumados (sin convertir)."* — aclaración: en realidad convertimos a USD usando TC del embarque para totales mixtos; ajustar texto a lo que hacemos: *"USD y MXN calculados con el TC propio de cada embarque."*

**Filtros:** sin cambios (cliente, operador, estado).

**Tabla de detalle** — nuevas columnas según el formato pedido:
- Expediente · Cliente · Operador · ETA · Cont. · **Venta USD** · **Venta MXN** · Costo (MXN) · Profit (MXN) · % · Estado
- Mantener orden por ETA, click → embarque.

### 4. Export CSV

Añadir columnas `Venta USD`, `Costo USD`, `Profit USD` junto a las MXN existentes.

### 5. Cambios menores

- Importar `Tooltip` y un `Badge` de moneda si hace falta resaltar USD vs MXN.
- Bump de versión a `v8.117.4` y entrada en changelog (`v8/chunks/0.ts` y `changelogData.ts`).

### Archivos a editar

- `src/lib/domain/proyeccionFacturacion.ts` — campos USD en interfaces, agrupación y KPIs.
- `src/services/facturas/proyeccion.ts` — calcular `venta_usd` / `costo_usd`.
- `src/components/facturacion/TabProyeccion.tsx` — nuevo bloque "Cierre", columnas USD en tabla, export CSV ampliado.
- `src/constants/appVersion.ts`, `src/content/changelog/v8/chunks/0.ts`, `src/content/changelogData.ts`.

### Notas

- Sin cambios de DB ni RLS.
- Sin nuevas queries: USD se deriva del mismo `conceptos_venta`/`conceptos_costo` ya cargados, usando `convertirAUSD` con `tipo_cambio_usd` / `tipo_cambio_eur` del embarque.
- La tab "Proyección" sigue siendo la primera tab de Pre-Facturación.


# Plataforma Operativa para Agente de Carga (México)

Sistema completo en español para gestionar embarques, facturación, clientes y proveedores.

---

## Fase 1: Estructura Base y Navegación

- Configurar tema de colores (azul marino #1B2B4B, acento #2563EB, fondo #F8FAFC) y fuente Inter
- Crear layout principal con sidebar de navegación (Dashboard, Embarques, Facturación, Clientes, Proveedores, Reportes)
- Configurar rutas para todos los módulos
- Crear datos mock completos: 15 embarques, 8 clientes, 10 proveedores, 10 facturas con datos realistas mexicanos

## Fase 2: Dashboard Principal

- KPIs en cards: Embarques Activos, Por Cerrar, Facturas Pendientes, Gastos por Liquidar
- Tabla de embarques recientes con badges de estado por color
- Gráfica de embarques por modo (Marítimo/Aéreo/Terrestre) últimos 6 meses con Recharts
- Panel de alertas del día: documentos faltantes, fechas críticas (ETA, free days)

## Fase 3: Módulo de Embarques

- **Lista de embarques**: tabla con filtros por modo, estado, cliente y fecha; búsqueda y paginación; badges de color por estado (Cotización → Confirmado → En Tránsito → Llegada → En Proceso → Cerrado)
- **Wizard de 4 pasos para nuevo embarque**:
  - Paso 1: Datos generales (modo, tipo, cliente, shipper, consignatario, mercancía, peso, volumen, incoterm)
  - Paso 2: Datos de ruta dinámicos según modo (puertos/aeropuertos, navieras/aerolíneas, BL/AWB, contenedores, ETD/ETA)
  - Paso 3: Checklist de documentos según modo con estado por documento (Pendiente/Recibido/Validado)
  - Paso 4: Costos y pricing con tablas de venta y costo, cálculo automático de utilidad y margen

## Fase 4: Ficha de Embarque (Detalle)

- **Tab Resumen**: datos generales, timeline visual del estado con fechas, botones de acción
- **Tab Documentos**: lista con semáforo (rojo/amarillo/verde), subir/reemplazar
- **Tab Costos**: tablas de venta y costo, resumen financiero, estado de liquidación por proveedor
- **Tab Facturación**: facturas generadas para el embarque, botón generar factura
- **Tab Notas y Actividad**: feed de actividad y notas internas

## Fase 5: Facturación y Liquidación

- **Lista de facturas** con filtros por estado, cliente, fecha, moneda
- **Generar factura** desde embarque: pre-carga de conceptos de venta, selección de moneda, tipo de cambio, vista previa profesional con datos fiscales, IVA 16%, descarga PDF
- **Liquidación de gastos**: lista de cuentas por pagar a proveedores, marcar como pagado con fecha y referencia

## Fase 6: Clientes y Proveedores

- **Clientes**: catálogo con RFC, dirección, contacto; historial de embarques; saldo pendiente
- **Proveedores**: catálogo por tipo (naviera, aerolínea, transportista, agente aduanal, terminal); historial de gastos

## Fase 7: Reportes

- Embarques por período con gráficas por modo
- Rentabilidad por embarque, cliente y operador
- Cuentas por cobrar y por pagar
- Top clientes por volumen e ingresos


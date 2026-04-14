

## Widget: Cargas Activas por Cliente — Dashboard Principal

### Concepto

Una **tabla ranked compacta** (no gráfico) que muestre los clientes ordenados por número de embarques activos, con números grandes y claros para tomar decisiones rápido. Cada fila incluye:

- Nombre del cliente
- Número total de embarques activos (grande, bold)
- Mini desglose por estado con chips de color (ej: 3 En Tránsito, 2 Arribo)
- Barra de proporción inline sutil para contexto visual
- Click en fila navega a `/clientes/{id}`

### Ubicación

Se inserta en el Dashboard principal (`Dashboard.tsx`) entre las alertas/próximos arribos y la tabla de profit, dentro de una Card titulada **"Cargas activas por cliente"**.

### Datos

Se agrega una nueva sección al RPC `dashboard_stats()` que agrupa embarques activos por `cliente_id` + `cliente_nombre`, contando por estado real. Esto evita queries adicionales del frontend.

### Plan de acción

| Paso | Descripción |
|------|------------|
| 1 | **Migración SQL**: Agregar sección `cargas_por_cliente` al RPC `dashboard_stats()` — agrupa activos por cliente con conteo por estado |
| 2 | **Hook**: Parsear la nueva sección en `useDashboardData.ts` |
| 3 | **Componente**: Crear `CargasActivasClienteCard.tsx` — tabla compacta con números prominentes, chips de estado y barras inline |
| 4 | **Dashboard**: Insertar el componente en `Dashboard.tsx` |
| 5 | **Changelog**: Entrada v8.9.0 |

### Diseño visual (mockup)

```text
┌─────────────────────────────────────────────────────┐
│  📦 Cargas activas por cliente                      │
├──────────────┬───────┬──────────────────────────────┤
│ Cliente ABC  │  12   │ ██████████ 5 Tránsito 4 Arr. │
│ Importadora  │   8   │ ██████░░░░ 3 Conf. 5 Aduana  │
│ Comercial X  │   3   │ ██░░░░░░░░ 2 Tránsito 1 Arr. │
└──────────────┴───────┴──────────────────────────────┘
```


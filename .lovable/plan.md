
# Mejorar los estatus de facturas de proveedor (CxP)

## Diagnóstico: hoy hay 4 "estatus" mezclados

Analogía: hoy el semáforo tiene cuatro colores encendidos a la vez y el usuario no sabe cuál mirar.

En la BD y la UI conviven cuatro dimensiones que se muestran revueltas en un solo chip:

| Dimensión | Dónde vive hoy | Valores actuales | Problema |
|---|---|---|---|
| Ciclo de vida | `proveedor_facturas.estado` (enum) | Borrador, Vigente, Pagada (y Cancelada) | Mezcla "pagada" con el ciclo administrativo |
| Captura | `estado_captura` (text) | pendiente_xml, capturada, conciliada, pagada | Duplica "pagada" con `estado`; nadie lo mira |
| Aprobación | `estado_aprobacion` (enum) | pendiente, aprobada, rechazada | No se muestra en la lista |
| Vencimiento | Derivado en `clasificar()` | Vigente / Por vencer / Vencida / Pagada / Sin saldo | Se pisa con el ciclo de vida y con aprobación |
| SAT | `uuid_estatus_sat` | Vigente, Cancelado, No Encontrado, Error | Vive aparte, aunque es crítico |

Consecuencias observadas:
- El chip `EstatusCxP` muestra "Vigente" a una factura **rechazada** o **cancelada en SAT** → falso positivo.
- "Sin saldo" y "Pagada" conviven sin criterio claro (una factura saldada 100% por NC queda "Sin saldo").
- "Por vencer" sólo cubre 3 días, insuficiente para tesorería.
- No hay estatus para "En cancelación" ni "Rechazada" en la lista.

## Propuesta: separar en 3 ejes + 1 estatus resumen

Un chip por eje en el detalle, y un solo **chip primario derivado** en la tabla que sigue una regla de prioridad clara.

```text
Eje 1  CICLO       Borrador → Vigente → Pagada → Cancelada
Eje 2  APROBACIÓN  Pendiente → Aprobada / Rechazada
Eje 3  PAGO        Sin pagar → Parcial → Saldada  (+ Vencida / Por vencer)
Extra  SAT         Vigente / Cancelado / No verificado
```

### Regla de prioridad para el chip primario (tabla)

```text
1. Cancelada            (estado = Cancelada)         → gris
2. Rechazada            (aprobacion = rechazada)     → rojo
3. Borrador             (estado = Borrador)          → ámbar suave
4. Pendiente aprobación (aprobacion = pendiente)     → ámbar
5. SAT cancelado        (uuid_estatus_sat=Cancelado) → rojo (badge extra)
6. Pagada               (estado = Pagada)            → verde
7. Vencida              (dias > 0 y saldo > 0)       → rojo
8. Por vencer           (0 ≥ dias ≥ -7)              → ámbar
9. Parcial              (0 < pagado < total)         → azul
10. Vigente             (default)                    → neutro
```

Cambios respecto a hoy:
- Ventana "Por vencer" pasa de 3 → **7 días** (configurable).
- Nuevo estatus **Parcial** (pagos aplicados pero no saldada).
- Se elimina **"Sin saldo"** como categoría separada: si el saldo llegó a 0 vía NC, se muestra **Saldada** y en el detalle se ve que fue por NC.
- Chips independientes visibles en el detalle: **Aprobación** y **SAT** siempre.
- Filtros CxP se dividen en dos selects: **Estatus** (los 10 de arriba) y **Aprobación** (pendiente/aprobada/rechazada).

### Limpieza de columnas duplicadas

- `estado_captura` se **deprecia**: nadie lo consume en UI y duplica `estado` + `origen_carga`. Se deja la columna, se para de escribir, se retira del tipo TS.
- `estado` gana un valor faltante que la UI ya asume: `Cancelada` (verificar que el enum ya lo tenga; si no, agregarlo).

## Alcance de la implementación

Frontend:
1. Nuevo tipo `EstatusCxP` con los 10 valores anteriores + helper `clasificarFactura(f)` que aplica la prioridad.
2. Nuevo `<CxpEstatusChip />` con colores tokens (`bg-destructive`, `bg-warning`, `bg-primary`, `bg-muted`).
3. Detalle de factura: agregar chips separados `AprobacionChip` y `SatChip` junto al header.
4. `CxpFiltros`: separar filtro de estatus y filtro de aprobación; ampliar opciones.
5. `cxpKpis`: recalcular "Vencidas" y "Por vencer 7d" con la nueva regla; agregar KPI "Pendientes de aprobación".

Backend (migración corta):
1. Añadir valor `Cancelada` a `estado_proveedor_factura` si no existe.
2. Comentar `estado_captura` como deprecated.
3. Índice parcial `(organization_id, estado, fecha_vencimiento)` para acelerar el nuevo filtro (si falta).

Fuera de alcance (para no crecer el cambio):
- Rediseño visual del módulo (ya cerrado en v13.303.98).
- Migrar reportes de contabilidad que consumen `estado_captura`.

## Preguntas antes de codear

1. ¿Ventana "Por vencer" en 7 días o prefieres 5 / 10?
2. ¿Mostramos el chip de SAT siempre en la lista o solo en el detalle?
3. ¿"Rechazada" debe seguir contando en el saldo/aging o excluirse (hoy cuenta)?

Confírmame estas tres y ajusto el plan antes de pasar a build.

## Diagnóstico

La factura **YA-1610** de Yassen Eventos:
- `fecha_emision` = 04/06/2026, `fecha_vencimiento` = 04/06/2026 (mismo día, `dias_credito` = 0)
- `estado` = **Pagada**, `total` = $34,320, `saldo` = $0
- Hoy es 12/06/2026 → 8 días desde la fecha de vencimiento

El badge de estatus muestra "Pagada" correctamente, pero la columna **"Días vencido"** muestra **8 en rojo** porque se calcula sólo a partir de `fecha_vencimiento - hoy`, ignorando el estado de la factura.

**Causa raíz** (`src/services/cxp/proveedorFacturas.ts`):

```ts
const dv = diasVencido(f.fecha_vencimiento);
// ...
dias_vencido: Math.max(0, dv),   // <-- no considera estado === 'Pagada'
```

Una factura ya pagada no debe contar días vencidos. El mismo bug afecta los KPIs (`facturas_vencidas`, `vencido_mxn`, `vencido_usd`): aunque la función `clasificar()` sí filtra por saldo > 0 antes de sumar, el indicador visual de la fila confunde al operador.

## Fix propuesto

Una sola edición en `src/services/cxp/proveedorFacturas.ts`:

1. En el mapeo de cada factura, forzar `dias_vencido = 0` cuando `estado === "Pagada"` o `saldo <= 0`:
   ```ts
   const yaSaldada = f.estado === "Pagada" || saldo <= 0.01;
   const dv = yaSaldada ? 0 : diasVencido(f.fecha_vencimiento);
   // ...
   dias_vencido: Math.max(0, dv),
   ```

2. (Refuerzo defensivo) En `src/components/cxp/cxpColumns.tsx`, la celda "Días vencido" mostrará `—` cuando estatus = "Pagada" / "Sin saldo", para que aunque el dato venga mal nunca se vea un número rojo en una factura pagada.

## Changelog / versión

- Bump `APP_VERSION` → `12.81.1` (patch).
- Entrada en `CHANGELOG.md`: `fix(cxp): "Días vencido" ya no muestra valor en facturas pagadas (Yassen YA-1610 mostraba 8 días aunque estado=Pagada)`.

## Fuera de alcance

- No se tocan KPIs (ya filtran por saldo).
- No se cambia ninguna RPC ni el schema.
- No se modifica la lógica de pagos.

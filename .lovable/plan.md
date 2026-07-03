## Propuesta

Reemplazar el `ToggleGroup` "Todas / Facturadas" por una **barra de filtros homologada al patrón de `/embarques`**, que ya es el design language de la app: buscador + selects primarios en línea + botón "Filtros" (sheet) con secundarios + chips de filtros activos debajo.

### Cómo se verá (desktop)

```text
[🔎 Buscar…                     ] [Estado ▾] [Cliente ▾] [ Filtros (N) ]
[chip: Aceptadas ✕] [chip: 01/06 – 31/07 ✕] [Limpiar todo]
```

En móvil se colapsa a `[🔎 Buscar] [Filtros (N)]` y todo se abre en el sheet — mismo patrón que embarques.

### Filtros propuestos

Primarios (siempre visibles en desktop, como selects):
1. **Estado** — un solo select con todos los estados reales de la proforma, unificando `estado_proforma` + `estado_cliente`:
   - Todas
   - Pendiente cliente (esperando respuesta)
   - Aceptada por cliente
   - Rechazada
   - Facturada
2. **Cliente** — select con los clientes que tienen proformas (mismo patrón que embarques).

Secundarios (en el sheet "Filtros"):
3. **Operador** — quien generó la proforma.
4. **Rango de fecha de emisión** — `Desde` / `Hasta` usando `DatePickerMx` (formato mexicano, ya estándar). Con presets rápidos: **Hoy · Últimos 7 días · Mes actual · Mes anterior · Personalizado**.
5. **Origen de aceptación** (opcional, sólo si es útil): Portal cliente / Respuesta manual.

Chips debajo con X individual + botón "Limpiar todo", exactamente como embarques.

### Por qué esto es lo mejor para el usuario

- **Un solo lugar para el estado**: hoy hay un toggle que sólo distingue Todas/Facturadas, pero las badges de la tabla muestran 4 estados (Pendiente cliente / Aceptada / Rechazada / Facturada). El usuario ve estados en la tabla que no puede filtrar — el filtro Estado unificado cierra esa brecha.
- **Fecha con presets** cubre el 90% de los casos ("cierre del mes", "últimos 7 días") sin obligar a abrir dos date pickers.
- **Chips activos** dan feedback visual inmediato de qué está filtrado y permiten quitar filtros uno por uno — un patrón que el usuario ya conoce de `/embarques`.
- **Homologación**: el usuario aprende el patrón una vez y lo reusa en toda la app.

### Cambios técnicos

1. Extender `useTabProformasState.ts`: agregar `filtroCliente`, `filtroOperador`, `fechaDesde`, `fechaHasta`, y ampliar `FiltroEstadoProforma` a `"todas" | "pendiente" | "aceptada" | "rechazada" | "facturada"`. El derivador `filtered` cruza `estado_proforma` + `estado_cliente` con la misma lógica de prioridad que ya usa `estadoRank()` en `proformasColumns.tsx` (single source of truth: extraer a un helper `getEstadoUnificado(p)`).
2. Nuevo componente `ProformasFiltros.tsx` en `src/features/facturacion/components/`, gemelo estructural de `EmbarquesFiltros.tsx`, con sub-componentes `ProformasFiltrosCampos.tsx` y `ProformasFiltrosChips.tsx` (reusa `mobileFilterSheet`, `SearchInput`, `DatePickerMx`).
3. Actualizar `TabProformas.tsx`: quitar el `ToggleGroup` + `SearchInput` sueltos, sustituir por `<ProformasFiltros … />`.
4. Actualizar `useTabProformasController.ts` para exponer los nuevos setters y las listas derivadas (`clientes`, `operadores`).
5. Tests: actualizar `useTabProformasState.test.tsx` con los nuevos filtros; test nuevo para el helper `getEstadoUnificado`.
6. Bump `APP_VERSION` a `13.147.0` (feature nueva de UI) + entrada en `CHANGELOG.md`.

### Fuera de alcance

- No se toca la lógica de conversión a factura ni la selección múltiple.
- No se cambian columnas ni badges de la tabla.
- No se agrega export/persistencia de filtros en URL (posible follow-up).

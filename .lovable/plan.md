## Objetivo
Mejorar la tarjeta "Embarques Relacionados" del detalle de embarque para hacerla más informativa y consolidar la vista del BL Master.

## Cambios

### 1. Query — `src/services/embarque/queries.ts` (`fetchEmbarquesRelacionados`)
- Quitar `shipper` del select (ya no se muestra).
- Agregar `peso_kg`, `volumen_m3`, `piezas`.
- **Importante**: ya no excluir el embarque actual (`.neq('id', embarqueId)`) — ahora se incluye toda la lista para resaltar el actual y permitir totales correctos.
- Select final: `'id, expediente, bl_house, contenedor, tipo_contenedor, peso_kg, volumen_m3, piezas, estado'`.

### 2. Hook — `src/hooks/embarque/useEmbarquesRelacionados.ts`
- Conservar firma; ya no excluir el actual desde el query (se hace solo si no hay agrupación). Se pasa el `embarqueId` para marcar la fila actual en UI.

### 3. Tarjeta — `src/components/embarque/TabResumen.tsx`
- **Encabezado**: mostrar BL Master destacado y resumen agregado: `N contenedores · Peso total kg · Volumen total m³ · Piezas totales`.
- **Columnas nuevas** (en orden): Expediente · BL House · Contenedor · Peso · Volumen · Piezas · Estado.
- **Quitar**: columna Shipper.
- **Fila del embarque actual**: resaltar con fondo `bg-accent/10` y badge "Actual" junto al expediente; deshabilitar `onRowClick` para esa fila (ya estás ahí).
- **Totales**: usar `<TableFooter>` o una fila final con `font-semibold` mostrando sumas de Peso/Volumen/Piezas.
- Ocultar la tarjeta si solo existe 1 embarque (el actual) y no hay BL Master compartido — preservar comportamiento actual de no mostrar nada cuando no hay relacionados.

### 4. Mockup ASCII

```text
┌─ Embarques del BL Master: 034G528714 ──────────────────────┐
│ 3 contenedores · 18,450 kg · 67.20 m³ · 240 piezas         │
├──────────┬─────────┬──────────────┬───────┬───────┬────┬──┤
│ Exped.   │ BL House│ Contenedor   │ Peso  │ Vol   │ Pz │..│
├──────────┼─────────┼──────────────┼───────┼───────┼────┼──┤
│ EXP-101▸ │ HBL-A   │ MSCU1234567  │ 6,000 │ 22.40 │ 80 │..│
│●EXP-102  │ HBL-B   │ TCNU9876543  │ 6,200 │ 22.40 │ 80 │  │ ← Actual
│ EXP-103▸ │ HBL-C   │ MSKU5555555  │ 6,250 │ 22.40 │ 80 │..│
├──────────┴─────────┴──────────────┼───────┼───────┼────┼──┤
│                          Totales: │18,450 │ 67.20 │240 │  │
└────────────────────────────────────┴───────┴───────┴────┴──┘
```

### 5. Changelog + bump patch
- `src/constants/appVersion.ts`: `8.129.2` → `8.129.3`.
- Nueva entrada patch en `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts`: "Embarques Relacionados: tabla mejorada con peso/volumen/piezas, totales y fila destacada del embarque actual; quitada columna Shipper".

## Notas técnicas
- Suma usando `Number()` con fallback a 0 para evitar NaN cuando un campo viene null.
- Formateo de peso/volumen/piezas con `formatNumber` ya importado (kg sin decimales, m³ con 2).
- Render condicional del badge "Actual" comparando `r.id === embarque.id`.
- Si solo hay 1 fila (el actual) y todos sus hermanos del BL Master no existen, no renderizar la tarjeta (mantener comportamiento previo: `relacionados.length > 1` o que existan otros además del actual).
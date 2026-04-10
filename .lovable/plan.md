

## Agrupar embarques por expediente en el portal

**Problema**: Cuando un cliente tiene múltiples contenedores bajo el mismo expediente, aparecen como tarjetas sueltas sin relación visual.

**Solución**: Agrupar los embarques filtrados por expediente. Si un expediente tiene 2+ embarques, se muestra dentro de una tarjeta contenedora con el nombre del expediente como encabezado y las tarjetas individuales (contenedores) anidadas. Los expedientes con un solo embarque se muestran como hasta ahora.

### Resultado visual

```text
┌─ ELIMP00149 · 3 contenedores ──────────────┐
│  ┌─ ELIMP00149 - WHSU6049365 ────── 🟢 ─┐  │
│  └───────────────────────────────────────┘  │
│  ┌─ ELIMP00149 - WHSU5494746 ────── 🟡 ─┐  │
│  └───────────────────────────────────────┘  │
│  ┌─ ELIMP00149 - TCNU7281435 ────── 🟢 ─┐  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘

┌─ ELIMP00150 - MSKU1234567 ──────── 🔵 ─┐
└─────────────────────────────────────────┘
```

### Cambios en `src/pages/portal/PortalEmbarques.tsx`

1. **Agrupar embarques filtrados por expediente** con un `useMemo` que crea un `Map<string, embarque[]>` ordenado por fecha del primer embarque del grupo.

2. **Renderizar grupos**: Iterar sobre los grupos en lugar de la lista plana.
   - Si el grupo tiene 1 embarque: renderizar la tarjeta individual como actualmente.
   - Si tiene 2+: envolver en un `Card` con borde punteado y fondo `bg-muted/30`, encabezado con el expediente, icono de modo y conteo de contenedores. Las tarjetas internas se renderizan dentro.

3. No se requieren cambios en hooks ni queries.

### Cambio en `src/pages/Changelog.tsx`
- Entrada v8.0.7

### Archivos a modificar
- `src/pages/portal/PortalEmbarques.tsx` (agrupamiento + render)
- `src/pages/Changelog.tsx`


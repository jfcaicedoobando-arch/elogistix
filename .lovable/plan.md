

## Colapsar/expandir grupos y mejoras UX en "Mis Embarques"

### Cambios en `src/pages/portal/PortalEmbarques.tsx`

1. **Importar** `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` de `@/components/ui/collapsible` y `ChevronDown` de lucide-react.

2. **Grupos colapsables**: Envolver los grupos multi-contenedor con `<Collapsible defaultOpen>`. El encabezado del grupo se convierte en `CollapsibleTrigger` con un icono `ChevronDown` que rota 180° al abrir (`data-[state=open]:rotate-180`). Las tarjetas internas van dentro de `CollapsibleContent`.

3. **Resumen en encabezado del grupo**: Junto al conteo de contenedores, mostrar un mini-resumen de estados del grupo (badges pequeños con conteo por estado) visible siempre, para que el usuario sepa qué hay dentro sin expandir.

4. **Mejoras UX generales**:
   - Tarjetas individuales: aumentar ligeramente el padding y hacer las fechas ETD/ETA de `text-[10px]` a `text-xs` para mejor legibilidad.
   - En la tarjeta del grupo colapsado, mostrar la ruta del primer embarque como subtítulo para dar contexto.
   - Hover en el trigger del grupo: `cursor-pointer` con transición suave.

### Resultado visual

```text
┌─ ▼ ELIMP00149 · 3 contenedores · 🟢2 🟡1 ─┐
│  Shanghái → Manzanillo                       │
│  ┌─ ELIMP00149 - WHSU6049365 ────── 🟢 ─┐   │
│  └───────────────────────────────────────┘   │
│  ┌─ ELIMP00149 - WHSU5494746 ────── 🟡 ─┐   │
│  └───────────────────────────────────────┘   │
│  ┌─ ELIMP00149 - TCNU7281435 ────── 🟢 ─┐   │
│  └───────────────────────────────────────┘   │
└──────────────────────────────────────────────┘

┌─ ▶ ELIMP00148 · 2 contenedores · 🔵2 ──────┐
│  Ningbo → Lázaro Cárdenas                    │
└──────────────────────────────────────────────┘
```

### Cambio en `src/pages/Changelog.tsx`
- Entrada v8.0.8

### Archivos a modificar
- `src/pages/portal/PortalEmbarques.tsx`
- `src/pages/Changelog.tsx`




## Plan: Layout fijo header/footer para formularios wizard

### Problema
`NuevoEmbarque.tsx` y `EditarEmbarque.tsx` usan un layout plano (`space-y-6 max-w-4xl mx-auto`) donde los botones de navegación se desplazan con el contenido. `NuevaCotizacion.tsx` ya tiene el patrón correcto con header fijo, contenido scrolleable y footer fijo.

### Páginas a refactorizar

| Página | Estado actual | Cambio |
|---|---|---|
| `NuevoEmbarque.tsx` | Layout plano, botones inline | Migrar a header/content/footer fijo |
| `EditarEmbarque.tsx` | Layout plano, botones inline | Migrar a header/content/footer fijo |
| `Layout.tsx` | `main` con `p-6` | Eliminar padding para que las páginas wizard controlen su propio espaciado |

### Estructura destino (idéntica a NuevaCotizacion)

```text
┌─────────────────────────────────┐
│ Header fijo (flex-none)         │
│  ← Botón Back | Título          │
│  StepIndicator                  │
│  border-b bg-background p-4     │
├─────────────────────────────────┤
│ Contenido scrolleable           │
│  flex-1 overflow-y-auto p-4     │
│  max-w-4xl mx-auto              │
│  (Steps 1-4 renderizados aquí) │
├─────────────────────────────────┤
│ Footer fijo (flex-none)         │
│  border-t bg-background p-4     │
│  Cancelar/Anterior | Siguiente  │
└─────────────────────────────────┘
```

### Cambios específicos

1. **`Layout.tsx`** — Cambiar `main` de `p-6` a padding condicional. Dado que otras páginas dependen del padding, la solución más limpia es que las páginas wizard usen márgenes negativos (`-m-6`) para contrarrestar el padding del main y tomar el control completo del viewport.

2. **`NuevoEmbarque.tsx`** — Reestructurar el JSX:
   - Contenedor externo: `flex flex-col h-[calc(100vh-4rem)] -m-6`
   - Header fijo con título + StepIndicator
   - Contenido scrolleable con los 4 pasos
   - Footer fijo con botones Cancelar/Anterior + Siguiente/Crear Embarque

3. **`EditarEmbarque.tsx`** — Mismo patrón:
   - Contenedor externo con flex column y altura calculada
   - Header fijo con título (incluye expediente) + StepIndicator
   - Contenido scrolleable con los 3 pasos
   - Footer fijo con botones Cancelar/Anterior + Siguiente/Guardar Cambios
   - Skeleton de carga adaptado al nuevo layout

4. **`NuevaCotizacion.tsx`** — Agregar `-m-6` al contenedor para consistencia con el padding del Layout.

5. **`Changelog.tsx`** — Nueva entrada v4.28.1.

### Notas técnicas
- `h-[calc(100vh-4rem)]` descuenta el header del Layout (h-16 = 4rem).
- `-m-6` contrarresta el `p-6` del `<main>` en Layout.tsx, permitiendo que el wizard ocupe todo el espacio disponible.
- No se modifica `Layout.tsx` para evitar afectar las demás páginas.


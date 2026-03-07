

## Fix: Columna Origen → Destino en EmbarquesActivosTable (v4.30.2)

### Problema
Los embarques guardados con el formato viejo (`"Manzanillo — Manzanillo, México"`) producen `"Manzanillo — Manzanillo"` al hacer `.split(",")[0]`.

### Solución
Mejorar la lógica de extracción del nombre corto para manejar ambos formatos (viejo y nuevo):

**`src/components/dashboard/EmbarquesActivosTable.tsx`** — Crear helper que limpie el nombre:
```typescript
function shortName(raw: string) {
  // Formato nuevo: "Manzanillo, México (MXZLO)" → "Manzanillo"
  // Formato viejo: "Manzanillo — Manzanillo, México" → "Manzanillo"
  return raw.split(/[,—]/)[0].trim();
}
```

Aplicar también en **`src/pages/Embarques.tsx`** si la columna ruta tiene la misma lógica.

### Archivos
1. `src/components/dashboard/EmbarquesActivosTable.tsx` — Usar `shortName` helper
2. `src/pages/Embarques.tsx` — Verificar y aplicar si aplica
3. `src/pages/Changelog.tsx` — Entrada v4.30.2


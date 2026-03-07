

## Fix: Puerto duplicado en PortSelect (v4.30.1)

### Causa raíz

En `src/components/PortSelect.tsx`, línea 16, la función `formatPort` repite `port.name` dos veces:

```typescript
// BUG actual:
return `${port.name} — ${port.name}, ${port.country}`;
// Resultado: "Manzanillo — Manzanillo, México"
```

### Corrección

Cambiar el formato a `Nombre, País (Código)`:

```typescript
function formatPort(port: { code: string; name: string; country: string }) {
  return `${port.name}, ${port.country} (${port.code})`;
}
// Resultado: "Manzanillo, México (MXZLO)"
```

### Archivos a modificar
1. **`src/components/PortSelect.tsx`** — Corregir `formatPort` (línea 16)
2. **`src/pages/Changelog.tsx`** — Entrada v4.30.1


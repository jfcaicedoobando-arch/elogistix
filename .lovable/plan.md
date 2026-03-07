

## Formato de fecha con hora en Cotizaciones (v4.30.4)

### Cambio único en `src/pages/Cotizaciones.tsx`

Reemplazar `formatDate(c.created_at)` en la columna "Fecha" por:

```typescript
new Date(c.created_at).toLocaleString('es-MX', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})
```

Resultado: `05/03/2026, 14:35`

Se elimina la dependencia de `formatDate` de helpers (si no se usa en otro import del archivo).

### Archivos
1. **`src/pages/Cotizaciones.tsx`** — Columna "Fecha" (~línea 68)
2. **`src/pages/Changelog.tsx`** — Entrada v4.30.4


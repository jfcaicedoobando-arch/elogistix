

## Fix: Ordenar estados de embarque en el dashboard del portal

**Problema**: La distribución de estados en el dashboard del portal ordena los estados por cantidad (mayor a menor), no por el orden lógico del ciclo de vida del embarque.

**Solución**: Ordenar usando el array `ESTADOS_EMBARQUE` de `embarqueConstants.ts` que ya define el orden correcto: Confirmado → En Tránsito → Arribo → En Aduana → Entregado → EIR → Cerrado.

### Cambio en `src/pages/portal/PortalDashboard.tsx`

- Importar `ESTADOS_EMBARQUE` desde `@/data/embarqueConstants`
- Cambiar el `.sort()` en `estadoDistribucion` (línea 68) para ordenar según el índice en `ESTADOS_EMBARQUE` en lugar de por conteo

```ts
// Antes
return Object.entries(counts).sort((a, b) => b[1] - a[1]);

// Después
return Object.entries(counts).sort((a, b) => {
  const idxA = ESTADOS_EMBARQUE.indexOf(a[0] as any);
  const idxB = ESTADOS_EMBARQUE.indexOf(b[0] as any);
  return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
});
```

### Actualizar `src/pages/Changelog.tsx`

- Agregar entrada con la corrección del orden de estados.




## Mejorar diseño de tarjetas de embarque en el portal

### Problema
Las tarjetas actuales son compactas y planas — muestran expediente, ruta, ETD/ETA, tipo y badge de estado en una sola línea horizontal. Falta información visual que el cliente valora (naviera/aerolínea, tipo de servicio, contenedor destacado) y la jerarquía visual es débil.

### Solución
Rediseñar `EmbarqueCard` con un layout más rico y estructurado:

```text
┌──────────────────────────────────────────────────┐
│  🚢  ELIMP00149 - WHSU6049365        🟢 En Tránsito │
│      Shanghai → Manzanillo                           │
│                                                      │
│  📅 ETD: 15/03/26    📅 ETA: 02/04/26               │
│  🏢 Hapag-Lloyd      📦 FCL 40'     🔧 P2P          │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 65%                  │
└──────────────────────────────────────────────────┘
```

### Cambios concretos en `EmbarqueCard` (`PortalEmbarques.tsx`)

1. **Layout de dos filas principales**: Fila superior con expediente/contenedor + badge de estado. Fila inferior con ruta en texto ligeramente más grande.

2. **Fila de metadatos enriquecida**: Debajo de la ruta, mostrar hasta 3 chips/tags informativos:
   - Naviera o aerolínea (`e.naviera` o `e.aerolinea` o `e.transportista`)
   - Tipo (`e.tipo`, ej. "FCL 40'")
   - Tipo de servicio (`e.tipo_servicio`, ej. "P2P") si existe

3. **Barra de progreso temporal**: Una barra delgada que muestra el progreso estimado entre ETD y ETA basado en la fecha actual (sólo si ambas fechas existen). Esto le da al cliente una noción visual inmediata de "dónde va" su carga.

4. **Icono de modo más prominente**: Usar un fondo con color semántico sutil según el modo (azul para marítimo, sky para aéreo, amber para terrestre) en lugar del gris neutro actual.

5. **Hover mejorado**: Agregar una flecha `→` sutil que aparece al hacer hover para indicar que la tarjeta es clickeable.

### Datos disponibles (ya en la query)
Los campos `naviera`, `aerolinea`, `transportista`, `tipo_servicio`, `contenedor`, `tipo` ya se obtienen en `usePortalEmbarques` — no se requieren cambios en hooks.

### Cálculo de progreso temporal
```typescript
const calcProgress = (etd: string, eta: string) => {
  if (!etd || !eta) return null;
  const start = parseISO(etd).getTime();
  const end = parseISO(eta).getTime();
  const now = Date.now();
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
};
```

### Changelog
- Entrada v8.0.9 en `src/pages/Changelog.tsx`

### Archivos a modificar
- `src/pages/portal/PortalEmbarques.tsx` — rediseño de `EmbarqueCard`
- `src/pages/Changelog.tsx` — nueva entrada


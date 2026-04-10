

## Mejorar diseño de tarjetas de embarque en el portal

### Cambios en `src/pages/portal/PortalEmbarques.tsx`

Rediseñar `EmbarqueCard` para mostrar más información visual sin progress bar:

```text
┌──────────────────────────────────────────────────┐
│  🚢  ELIMP00149 - WHSU6049365          🟢 En tránsito │
│                                                        │
│  📍 Shanghái → Manzanillo    FCL 40'                   │
│  🚢 Hapag-Lloyd              Servicio: P2P             │
│                                                        │
│  📅 ETD: 15/03/26     📅 ETA: 12/04/26                │
└──────────────────────────────────────────────────┘
```

Cambios específicos:

1. **Layout de dos filas** en lugar de una sola línea compacta:
   - Fila 1: Expediente + contenedor (bold) con badge de estado alineado a la derecha
   - Fila 2: Ruta con icono `MapPin`, tipo (FCL/LCL/Aéreo) como badge outline
   - Fila 3: Naviera/aerolínea/transportista con icono correspondiente + tipo de servicio si existe
   - Fila 4: ETD y ETA con mejor espaciado e iconos `CalendarClock`

2. **Incluir campos adicionales** ya disponibles en la query: `naviera`, `aerolinea`, `transportista`, `tipo_servicio`.

3. **Mejoras visuales**:
   - Icono de modo más grande en un círculo con color de fondo sutil según modo (azul marítimo, celeste aéreo, ámbar terrestre)
   - Badge de estado más prominente con `variant="default"` y colores semánticos
   - Borde izquierdo de color según estado (`border-l-4`) para identificación rápida
   - Hover con sombra más marcada y ligero scale

### Cambio en `src/pages/Changelog.tsx`
- Entrada v8.0.9

### Archivos a modificar
- `src/pages/portal/PortalEmbarques.tsx` — rediseño de EmbarqueCard
- `src/pages/Changelog.tsx`


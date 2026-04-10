

## Mejorar la carta "Estado de Embarques" en el portal

**Problema**: La barra de progreso (Progress) muestra proporciones como 12 de 68 que no comunican nada útil al cliente. No es un "progreso" — es una distribución.

**Solución**: Reemplazar las barras de progreso individuales por un diseño más claro:

### Cambio en `src/pages/portal/PortalDashboard.tsx` (líneas 143-157)

Reemplazar cada fila de estado con:
- Badge de color con el nombre del estado (ya existe)
- El conteo numérico en texto visible (ya existe)
- **Eliminar el `<Progress>`** de cada fila
- **Agregar una barra horizontal apilada** al final del bloque que muestre visualmente la proporción de todos los estados juntos (como un solo bar chart horizontal con segmentos de colores)
- Debajo de la barra, mostrar el total: "68 embarques activos"

Resultado visual:
```text
┌─────────────────────────────────────┐
│  Estado de Embarques                │
│                                     │
│  🟢 En tránsito          32        │
│  🟡 Documentación        18        │
│  🔵 Reservado            12        │
│  🟠 Arribo                6        │
│                                     │
│  ████████████▓▓▓▓▓▓░░░░░▒▒▒        │
│  68 embarques activos               │
└─────────────────────────────────────┘
```

### Cambio en `src/pages/Changelog.tsx`
- Entrada v8.0.6

### Archivos a modificar
- `src/pages/portal/PortalDashboard.tsx` — reemplazar Progress por barra apilada
- `src/pages/Changelog.tsx` — nueva entrada


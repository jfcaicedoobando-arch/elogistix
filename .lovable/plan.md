

## Agrupar embarques por expediente en el portal

**Objetivo**: Cuando un expediente tiene múltiples contenedores, agruparlos visualmente bajo un encabezado común para que el cliente identifique fácilmente que pertenecen al mismo embarque.

### Diseño visual

```text
┌─────────────────────────────────────────────┐
│ 🚢 ELIMP00149  ·  3 contenedores           │
│   Shanghai → Manzanillo  ·  Importación     │
├─────────────────────────────────────────────┤
│  ├─ WHSU6049365   ETD 10/03  ETA 15/04  🟢 │
│  ├─ WHSU5494746   ETD 10/03  ETA 15/04  🟡 │
│  └─ TCKU7283910   ETD 12/03  ETA 17/04  🟢 │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 🚢 ELIMP00150                               │
│   Veracruz → Houston  ·  Exportación        │
├─────────────────────────────────────────────┤
│  └─ (sin contenedor)  ETD 05/04  ETA 12/04 🔵│
└─────────────────────────────────────────────┘
```

- Expedientes con un solo embarque se muestran como tarjeta simple (sin encabezado de grupo).
- Expedientes con múltiples embarques se agrupan bajo un encabezado con el nombre del expediente, cantidad de contenedores, ruta y tipo.
- Cada contenedor se muestra como una fila compacta dentro del grupo, enlazada a su detalle.

### Cambios técnicos

**`src/pages/portal/PortalEmbarques.tsx`**
1. Después de filtrar, agrupar los embarques por `expediente` usando un `Map<string, embarque[]>`.
2. Si un grupo tiene 1 embarque → renderizar la tarjeta actual sin cambios.
3. Si un grupo tiene 2+ embarques → renderizar una `Card` contenedora con:
   - Encabezado: icono de modo + expediente + badge `N contenedores` + ruta + tipo.
   - Lista interna: cada embarque como un `Link` con contenedor, ETD, ETA y badge de estado, separados por `border-t`.
4. Actualizar el contador de resultados para reflejar grupos vs embarques individuales.

**`src/pages/Changelog.tsx`** — Entrada v8.1.0 (minor, nueva funcionalidad visual).

### Archivos a modificar
- `src/pages/portal/PortalEmbarques.tsx`
- `src/pages/Changelog.tsx`


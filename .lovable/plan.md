## Problema

En la tabla de "Auditoría operativa", la columna **Detalle** de los hallazgos de documentos muestra la lista de documentos dos veces:

1. Como parte del texto: `"Documentos faltantes para estado Confirmado: Factura Comercial, Packing List"`
2. Justo debajo, como badges: `[Factura Comercial] [Packing List]`

Esto pasa en las reglas `docs_faltantes` y `docs_pendientes_avanzado`, que son las únicas que llenan el campo `documentos_faltantes`.

## Causa

`HallazgoTabla.tsx` (línea 66-73) siempre pinta `h.detalle` completo y además renderiza los badges de `h.documentos_faltantes`. El texto ya contiene la misma lista que los badges.

## Solución

Ajustar sólo el renderizado en `src/features/auditoria/components/HallazgoTabla.tsx` (una analogía: es como si la etiqueta del paquete dijera dos veces lo mismo — quitamos la repetición sin tocar el paquete).

Cuando el hallazgo trae `documentos_faltantes` con elementos:
- Mostrar únicamente el **prefijo** del detalle (todo lo que va antes de los dos puntos), p.ej. `"Documentos faltantes para estado Confirmado:"`.
- Debajo, los badges como hoy.

Cuando no hay `documentos_faltantes` (resto de reglas), el detalle se muestra completo, sin cambios.

Implementación puntual:

```tsx
const tieneBadges = h.documentos_faltantes && h.documentos_faltantes.length > 0;
const textoDetalle = tieneBadges
  ? h.detalle.split(":")[0] + ":"   // sólo el prefijo
  : h.detalle;
```

## Alcance

- **Archivo tocado**: `src/features/auditoria/components/HallazgoTabla.tsx` (sólo el `cell` de la columna `detalle`).
- **Sin cambios** en el RPC, tipos, ni otros módulos.
- **CHANGELOG.md** + bump `APP_VERSION` a `13.288.2`.

## Verificación

- Typecheck (`bunx tsgo`).
- Revisar visualmente `/auditoria` que en pestaña "Documentos" el detalle no repite la lista.
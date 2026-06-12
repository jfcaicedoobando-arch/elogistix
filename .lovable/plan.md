# Salto de página condicional antes de Conceptos en PDF de proforma

## Estrategia

Usar `minPresenceAhead` de `@react-pdf/renderer` para **no forzar** salto de página, sino reservar un espacio mínimo. Si los conceptos no caben con dignidad en la página actual, react-pdf los empuja a la siguiente automáticamente; si caben holgados, se quedan donde están y no se desperdicia papel.

El `minPresenceAhead` se aplica a un wrapper `<View>` que envuelve el título "Conceptos" + la primera sección de tabla, evitando que el título quede huérfano en la página anterior con la tabla en la siguiente.

## Cambios

### 1. `src/pdf/documents/ProformaDocument.tsx`
Envolver el bloque de Conceptos en un `View` con `minPresenceAhead`:

```tsx
<View minPresenceAhead={140}>
  <Text style={styles.h3}>{multiContenedor ? "Conceptos por Contenedor" : "Conceptos"}</Text>
  <SeccionMonedaPdf grupos={grupos} moneda="USD" ... />
  <SeccionMonedaPdf grupos={grupos} moneda="MXN" ... />
</View>
```

El valor `140` ≈ alto de encabezado de tabla + 2 filas. Si quedan menos de 140pt libres antes del footer, el wrapper salta de página completo.

`TotalesBox` queda fuera del wrapper para que también pueda saltar por su cuenta si los conceptos consumen toda la hoja siguiente.

### 2. `src/pdf/documents/ProformaConsolidadaDocument.tsx`
Mismo tratamiento: envolver el bloque equivalente (título + tabla consolidada) en un `View` con `minPresenceAhead={140}`.

### 3. Tests
Los tests actuales validan presencia de texto en el render, no paginación. No requieren cambio — `minPresenceAhead` no afecta el `textContent` final.

### 4. Metadata
- `APP_VERSION` → `12.95.2`
- `CHANGELOG.md`: entrada `[12.95.2]` explicando el salto condicional.

## Por qué `minPresenceAhead` y no `break`

| Opción | Comportamiento | Veredicto |
|---|---|---|
| `break` en el `View` | Siempre fuerza nueva página | Descartado (desperdicia papel) |
| `wrap={false}` | Mantiene el bloque junto, lo salta entero si no cabe — pero si el bloque mismo es más alto que una página rompe el render | Riesgoso con multi-contenedor |
| `minPresenceAhead={N}` | Salta sólo si quedan menos de N pt — y el contenido interno sigue pudiendo paginarse normalmente | ✅ Elegido |

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `src/pdf/documents/ProformaDocument.tsx` | Wrapper `<View minPresenceAhead={140}>` alrededor del título + secciones de moneda |
| `src/pdf/documents/ProformaConsolidadaDocument.tsx` | Mismo wrapper sobre su bloque de conceptos |
| `src/constants/appVersion.ts` | `12.95.2` |
| `CHANGELOG.md` | nueva entrada |

## Fuera de alcance

- No se cambian fuentes, márgenes ni estilos del PDF.
- No se modifica la factura ni la cotización.
- No se ajusta el comportamiento de los grupos por contenedor (ya tienen `wrap={false}` propio).

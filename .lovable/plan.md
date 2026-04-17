

## v8.13.4 — Columna "Contenedor" en lista de embarques

### Cambio único

Agregar columna **"Contenedor"** en la tabla principal de `/embarques` (página `Embarques.tsx`), inmediatamente después de **BL Master**.

### Detalle

| Archivo | Cambio |
|---------|--------|
| `src/pages/Embarques.tsx` | Insertar nueva columna entre `bl` (BL Master, línea 143) y `cliente` (línea 144). Mostrar `e.contenedor` en font-mono; si es nulo, mostrar `-` en muted. Ancho `w-[130px]`. |
| `src/data/changelogData.ts` | Entrada v8.13.4 |

### Snippet de la nueva columna

```tsx
{ 
  key: "contenedor", 
  header: "Contenedor", 
  width: "w-[130px]", 
  className: "text-xs font-mono",
  render: (e) => e.contenedor || <span className="text-muted-foreground">-</span>
}
```

### Sin cambios en backend

- El campo `contenedor` ya viene en `EMBARQUE_LIST_COLUMNS` del query.
- Ya existe en el tipo `EmbarqueRow` (tabla `embarques`).
- Ya está incluido en el export CSV (línea 224).


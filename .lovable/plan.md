

# Agregar columna "Tipo Contenedor" a la tabla de Embarques

## Cambio

**`src/pages/Embarques.tsx`:**
- Agregar columna "Contenedor" en la tabla entre "Destino" y "ETD"
- Mostrar el valor de `tipoContenedor` del embarque (ej: `20'`, `40'`, `40'HC`), o `'-'` si no aplica (aéreo/terrestre)

Un solo archivo, un solo cambio.


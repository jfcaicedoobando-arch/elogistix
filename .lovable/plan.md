# Auditoría UI/UX — Pendientes detectados (v8.99.16)

Tras recorrer Dashboard, Embarques, Cotizaciones, Clientes, Operaciones y la vista mobile (375px), quedaron varios detalles de pulido. Ningún bug bloqueante, todo es polish.

## Hallazgos

### 1. Página 404 en inglés
`/dashboard` (y cualquier ruta inválida) muestra "Oops! Page not found / Return to Home". Viola la regla de localización mexicana del proyecto.

### 2. Teléfonos con lada de 3 dígitos mal formateados
`formatPhoneMx` siempre toma 2 dígitos como lada. Resultado visible en Clientes:
- `+52 4422170696` → muestra `+52 (44) 2170-6966` (incorrecto)
- Esperado: `+52 (442) 170-6966` para ladas 3-dígitos (Querétaro 442, Puebla 222, Cancún 998, etc.)

México usa lada de 2 dígitos solo en CDMX (55), MTY (81) y GDL (33); el resto son 3 dígitos.

### 3. Conector "Y" no se baja a minúscula en nombres
Cliente "Entera Salud Animal Y Nutricion S.A. de C.V" debería leer "Entera Salud Animal y Nutrición…". Falta agregar variantes mayúsculas al matcher de conectores (`Y`, `E`, `De`, etc.) — actualmente solo se compara en minúsculas tras `cleaned.toLowerCase()`, pero el guard `idx > 0` se cumple. **Verificar:** el bug real es que el dataset envía "Y" con acentos perdidos, y `processToken` sí lo baja. Validar en código si hace falta extender la lista o si el formatter lo maneja correctamente y es puramente data.

### 4. Header de página rebasa en mobile (375px)
En `/embarques` el botón "+ Nuevo Embarque" se corta por la derecha porque el header se mantiene en una sola fila. Aplica también a Cotizaciones y Clientes. Hay que apilar verticalmente (`flex-col` en `<sm`, `flex-row` en `≥sm`) y dar `w-full` a botones primarios en mobile.

### 5. Cotizaciones: vigencia inconsistente y filas de altura variable
- Algunas filas muestran badge "3d · 30/04/2026" y otras (mismo estado Borrador) solo "31/05/2026" sin badge. La regla actual marca solo cotizaciones que vencen en ≤3 días, pero se aplica también a Borrador/Aceptada/Rechazada cuando ya no aplica vencer.
- Columna "Origen → Destino" envuelve a 3 líneas y descompone la altura. Necesita `truncate` con tooltip.
- Esperado: el badge de vigencia solo debe aparecer en estado **Enviada** (donde la vigencia importa). Para Borrador/Aceptada/Rechazada, mostrar solo la fecha.

### 6. Embarques: cliente truncado sin tooltip
"Rollos y Etiquetas..." se corta sin `title` ni tooltip. Misma columna en Cotizaciones tiene el mismo problema con "Quimcelt Powder Coa...". Agregar `title={cliente}` o `<Tooltip>` al span truncado.

### 7. Pantallas de error/empty muy básicas
"Embarque no encontrado" en `/embarques/:id` inválido muestra solo texto y un botón. Mejorar con icono (`PackageX`), título grande y subtexto explicativo, alineado al estilo del resto de la app.

### 8. Operadores en Operaciones sin acentos
"Alan Hernandez", "Magali Reynoso", "Juanluis Martinez", "Valeria Zamora" — derivados de email así que es esperado, pero podemos:
- Detectar si en `usuarios` hay un `nombre_completo` poblado y usarlo en vez de derivar del email.

### 9. "México" sin acento en Clientes
Ciudad mostrada "Mexico, CDMX". Probable que venga así del catálogo. Aplicar un mini-diccionario de correcciones comunes (`Mexico → México`, `Queretaro → Querétaro`, `Yucatan → Yucatán`, `Nuevo Leon → Nuevo León`, etc.) dentro del helper de display.

## Plan de Trabajo (v8.99.16)

1. **NotFound.tsx**: Traducir a español ("404 — Página no encontrada", "Volver al inicio") y mejorar layout con icono.
2. **`formatPhoneMx`**: Aceptar ladas de 3 dígitos. Lista corta de ladas de 2 dígitos (`55`, `81`, `33`); el resto se formatea como `(NNN) NNN-NNNN`.
3. **Headers mobile**: Crear helper de layout en `Cotizaciones.tsx`, `Embarques.tsx`, `Clientes.tsx` para apilar título + acciones (`flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`).
4. **Cotizaciones**:
   - Restringir badge de vigencia a estado `enviada`.
   - Truncar "Origen → Destino" con tooltip nativo, max 1 línea.
   - Agregar `title` al cliente truncado.
5. **Embarques**: Agregar `title` al span de cliente en `embarqueColumns.tsx`.
6. **Helper `correctSpanishPlace`** en formatters: aplicar a ciudad/estado en `Clientes.tsx` y `ClienteDetalle.tsx`.
7. **OperadorCard**: Si llega `nombre_completo`, usarlo; fallback a `nombreDesdeEmail`.
8. **NoEncontrado genérico**: Componente compartido `EmptyState` con icono + mensaje + acción, reutilizable en detalles vacíos.
9. **Changelog**: Agregar entrada v8.99.16 documentando cada punto.

## Detalles Técnicos

```ts
// formatPhoneMx (nuevo)
const LADAS_2_DIGITOS = new Set(["55", "81", "33"]);
function splitLada(local: string): [string, string] {
  if (LADAS_2_DIGITOS.has(local.slice(0, 2))) return [local.slice(0,2), local.slice(2)];
  return [local.slice(0,3), local.slice(3)];
}
// Resultado: (442) 217-0696 / (55) 1234-5678
```

```ts
// correctSpanishPlace
const ACENTOS_LUGARES: Record<string,string> = {
  "mexico": "México", "queretaro": "Querétaro",
  "yucatan": "Yucatán", "nuevo leon": "Nuevo León",
  "michoacan": "Michoacán", "atizapan": "Atizapán",
  "san andres cholula": "San Andrés Cholula",
};
```

```tsx
// Header responsivo (patrón a aplicar)
<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <div>{titulo + subtitulo}</div>
  <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">{botones}</div>
</div>
```

## Archivos a Modificar

- `src/pages/NotFound.tsx`
- `src/lib/formatters/index.ts`
- `src/components/empty/EmptyState.tsx` (nuevo)
- `src/pages/embarques/Embarques.tsx` (header)
- `src/pages/cotizaciones/Cotizaciones.tsx` (header + vigencia + truncate)
- `src/pages/clientes/Clientes.tsx` (header + corrección de lugar)
- `src/pages/clientes/ClienteDetalle.tsx`
- `src/components/embarque/embarqueColumns.tsx` (tooltip cliente)
- `src/components/operaciones/OperadorCard.tsx` (preferir nombre_completo)
- `src/pages/embarques/EmbarqueDetalle.tsx` (usar EmptyState)
- `src/content/changelog/v8/chunks/0.ts`

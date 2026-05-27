
## Problema

En "Nueva Cotización" → carga consolidada (LCL) y aérea, la tabla de dimensiones usa `<Input type="number">` con `value={dim.campo}` (número crudo). Esto causa:

1. **No se puede borrar el `0`**: el estado siempre es un número, así que al presionar Delete/Backspace el valor vuelve a renderizarse como `0`. Al teclear `1` el usuario ve `01` (porque escribe antes del 0 que no se borró, o porque el navegador concatena).
2. **Flechas spinner** arriba/abajo que nadie usa y ocupan espacio.
3. **Scroll del mouse** sobre el input cambia el valor accidentalmente (bug típico de `type="number"`).
4. Al hacer foco, no se selecciona el contenido, por lo que hay que borrar manualmente.

Afecta a:
- `src/components/cotizacion/SeccionMercanciaMaritimeLCL.tsx` (LCL)
- `src/components/cotizacion/SeccionMercanciaAerea.tsx` (Aérea)

## Solución

Crear un componente compartido `NumericInput` reutilizable y usarlo en ambas tablas. Características:

- **Estado de string interno**: permite vacío mientras se edita; emite `onChange(number)` al padre cuando es válido (vacío → `0`).
- **`type="text"` con `inputMode="decimal"`**: teclado numérico en móvil, sin spinners, sin scroll-to-change.
- **`pattern`** que acepta solo dígitos y un punto decimal opcional (configurable: `integer` vs `decimal`).
- **Auto-select on focus**: al hacer foco selecciona todo el contenido para que el usuario teclee y reemplace directamente.
- **Sin leading zero**: al perder foco se normaliza (`01` → `1`, `` → `0`, `.5` → `0.5`).
- **Alineado a la derecha** (números) y `tabular-nums` para que se vea ordenado.

## Cambios

1. **Nuevo**: `src/components/shared/NumericInput.tsx` — wrapper sobre `<Input>` con la lógica anterior. Props: `value: number`, `onChange: (n: number) => void`, `decimals?: boolean`, `min?`, `step?` (solo informativo), `className?`, `aria-label?`.

2. **Editar** `SeccionMercanciaMaritimeLCL.tsx`: reemplazar los 4 `<Input type="number">` (piezas, alto, largo, ancho) por `<NumericInput>`. `piezas` → `decimals={false}`; las demás `decimals`.

3. **Editar** `SeccionMercanciaAerea.tsx`: idem.

4. **CSS opcional**: las flechas se eliminan automáticamente al cambiar a `type="text"`. No se requiere modificar `index.css`.

5. **Bitácora**:
   - `src/constants/appVersion.ts` → `12.0.0-rc.11`.
   - `CHANGELOG.md` → entrada `## [12.0.0-rc.11]` describiendo el fix de inputs de dimensiones (cotizaciones LCL y aérea).

## Detalles técnicos

```tsx
// NumericInput.tsx (esencia)
const [text, setText] = useState(value === 0 ? "" : String(value));

useEffect(() => {
  // sincronizar si el padre cambia el valor externamente
  if (Number(text || 0) !== value) setText(value === 0 ? "" : String(value));
}, [value]);

const re = decimals ? /^\d*\.?\d*$/ : /^\d*$/;

<Input
  type="text"
  inputMode={decimals ? "decimal" : "numeric"}
  value={text}
  onFocus={(e) => e.currentTarget.select()}
  onChange={(e) => {
    const v = e.target.value;
    if (re.test(v)) {
      setText(v);
      onChange(v === "" || v === "." ? 0 : Number(v));
    }
  }}
  onBlur={() => {
    const n = text === "" || text === "." ? 0 : Number(text);
    setText(n === 0 ? "" : String(n)); // normaliza "01" → "1"
    onChange(n);
  }}
  className="h-8 text-right tabular-nums"
/>
```

Esto resuelve borrar el `0`, quita spinners, evita scroll accidental y mejora la UX de captura rápida.

## Fuera de alcance

No se cambia la lógica de cálculo (`volumen_m3`, `peso_volumetrico_kg`) ni la estructura de datos. Solo el componente de captura. Si apruebas, después podemos replicar `NumericInput` en otros formularios numéricos (montos, cantidades) en un PR separado.

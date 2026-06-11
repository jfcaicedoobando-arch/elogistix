## Problema

En `CosteoTarifas.tsx` el botón "Duplicar" llama a `setInitial(...)` y abre el diálogo `TarifaForm`. Pero dentro de `TarifaForm`:

```ts
const [form, setForm] = useState<TarifaInput>(() => buildInitialForm(initial));
```

El inicializador de `useState` sólo corre la **primera vez** que se monta el componente. Como `TarifaForm` permanece montado entre aperturas (sólo cambia `open`), los nuevos valores de `initial` que llegan al duplicar nunca se aplican al estado interno → el formulario aparece vacío/con los valores previos.

Además, `duplicar()` está pasando `recargos: []`, descartando los recargos de la tarifa original.

## Cambios

1. **`src/features/costeo/components/TarifaForm.tsx`**
   - Agregar `useEffect` que reconstruya `form` con `buildInitialForm(initial)` cada vez que `open` pase a `true` (y se incluya `initial` en las dependencias). Cleanup no aplica.
   - Esto garantiza precarga al duplicar y reset al abrir para "Nueva tarifa".

2. **`src/features/costeo/routes/CosteoTarifas.tsx`** (función `duplicar`)
   - Mapear también `t.recargos` al payload `initial` (concepto, monto, moneda, etc.) para que la duplicación clone los recargos reales en vez de dejarlos vacíos. Verificar la forma exacta de `t.recargos` antes de mapear.

3. **Changelog / versión**
   - Bump `APP_VERSION` a `12.77.7` en `src/constants/appVersion.ts`.
   - Entrada en `CHANGELOG.md` raíz: "Fix: el botón Duplicar de tarifas marítimas ahora precarga el formulario con los datos (y recargos) de la tarifa origen."

## Fuera de alcance

- No se tocan validaciones ni servicios de tarifas.
- No se renombra ni reestructura `TarifaForm`.
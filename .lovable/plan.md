## Contexto

En `/facturacion` cada tab de bandeja (Embarques sin factura, Proformas listas, Por timbrar, etc.) muestra un ícono ℹ️ con un tooltip explicativo. Los `hint` son textos largos (~150–230 caracteres), por ejemplo:

> "Embarques cuyo contenedor ya llegó (ETA ≤ hoy) y aún no tienen CFDI. Necesitan factura para tener la papelería completa al cruzar aduana. Puede que falte generar la proforma o convertirla a factura."

El tooltip está renderizado en `src/features/facturacion/components/bandejas/BandejaTabs.tsx:114` con:

```tsx
<TooltipContent side="bottom" className="max-w-[240px] text-xs">{d.hint}</TooltipContent>
```

**Problema:** 240 px + `text-xs` obliga a que el texto se apile en muchas líneas muy angostas, y en combinación con `overflow-hidden` del `TooltipContent` base + el espacio vertical disponible que Radix reporta (`--radix-popper-available-height` ≈ 340 px en pantallas chicas), las últimas líneas quedan cortadas. En laptops (viewport 1081×675, que es el caso del usuario) el efecto es peor.

## Cambio

Un solo archivo, sin lógica:

**`src/features/facturacion/components/bandejas/BandejaTabs.tsx` (línea 114)** — cambiar el className del `TooltipContent`:

- `max-w-[240px]` → `max-w-sm` (384 px) para que el texto quepa en 4–6 líneas cómodas.
- `text-xs` → `text-xs leading-relaxed` para respirar entre renglones.
- Añadir `whitespace-normal` explícito (defensivo, evita que un ancestor con `whitespace-nowrap` lo rompa).
- Añadir `collisionPadding={12}` al `<TooltipContent>` para que Radix reubique el tooltip si se sale por debajo del viewport.

Resultado esperado: el hint completo se lee de un vistazo, con el mismo look & feel del resto de tooltips.

## Fuera de alcance

- No se toca `src/components/ui/tooltip.tsx` (afectaría a toda la app).
- No se cambian los textos de los `hint`.
- No se toca ningún tooltip fuera de la barra de bandejas de facturación.

## Verificación

1. Abrir `/facturacion` y hacer hover sobre el ℹ️ de cada tab: el texto completo debe verse sin cortes.
2. Reducir el viewport a 1081×675 (el del usuario) y repetir en la última pestaña de la derecha (que suele colisionar con el borde): el tooltip debe reposicionarse arriba o desplazarse dentro del viewport.
3. `bunx vitest run src/features/facturacion` → sin regresiones.

## Registro

Bump patch de `APP_VERSION` + entrada breve en `CHANGELOG.md` ("Tooltips de bandejas de facturación: ancho ampliado para leer el hint completo").

## Analogía

Es como si la etiqueta explicativa de cada bandeja estuviera pegada en un post-it demasiado angosto: cabía el título, pero las últimas líneas se doblaban hacia atrás y no se veían. Le damos un post-it un poco más ancho y con más aire entre renglones — sin cambiar el mensaje ni el estilo del resto de la app.

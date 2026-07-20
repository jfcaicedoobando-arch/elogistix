## Decisión

En **marítimo**, el paso 1 (Mercancía) deja de pedir peso, volumen y piezas. Esos totales se **calculan en vivo** sumando lo capturado por contenedor en el paso 2. En **aéreo / terrestre** se mantiene el comportamiento actual (totales en el paso 1), porque ahí no hay lista de contenedores donde desglosar.

## Cambios

### 1. `BloqueMercancia.tsx` (paso 1)
- Leer `modo` y `contenedores` del form context.
- Si `modo === 'Marítimo'`: **ocultar** los tres inputs (`pesoKg`, `volumenM3`, `piezas`) y en su lugar renderizar una tarjeta readonly compacta:
  > **Totales calculados** — `12,500 kg · 45.2 m³ · 100 pzs`
  > _Se calculan automáticamente desde los contenedores del paso 2._
- Si aún no hay contenedores con datos: mostrar hint `Captura los contenedores en el paso 2 para calcular totales.`
- Si `modo !== 'Marítimo'`: renderizar los inputs como hoy.

### 2. Sincronización automática (nuevo `useEffect` en `StepDatosRuta.tsx` o helper en `useEditarEmbarqueWizard`)
- Cuando `modo === 'Marítimo'` y `contenedores` cambie, hacer `setValue('pesoKg', suma)`, `setValue('volumenM3', suma)`, `setValue('piezas', suma)` con `{ shouldDirty: true, shouldValidate: true }`.
- Suma tolerante a strings/nulos (mismo estilo que `SeccionContenedoresReadonly`).
- Así el valor persistido en DB (`embarque.peso_kg`, `volumen_m3`, `piezas`) queda coherente y el resto de la app (Resumen, reportes, PDF) sigue funcionando sin cambios.

### 3. Validación `embarqueWizardSchemas`
- Si `modo === 'Marítimo'`: los campos `pesoKg`, `volumenM3`, `piezas` dejan de ser requeridos en el step 1 (la validación de paso 2 ya exige al menos un contenedor con datos válidos vía `validarContenedoresFCL`).
- En aéreo/terrestre: se mantiene la validación actual (requeridos > 0).
- Ajustar los tests de `embarqueWizardSchemas` correspondientes.

### 4. Cotización → embarque (herencia)
- Los mappers `embarqueCotizacion.ts` que precargan `pesoKg`/`volumenM3`/`piezas` desde la cotización siguen igual: en marítimo, en cuanto se agregan contenedores, la suma sobrescribe esos valores. En aéreo/terrestre se preservan como hoy.

## Diagrama

```text
                ┌────────────── PASO 1 (Mercancía) ─────────────┐
Marítimo   →   │ Descripción · Tipo carga · [Totales readonly] │
                └───────────────────────────────────────────────┘
                              ▲ suma en vivo
                ┌────────────── PASO 2 (Contenedores) ──────────┐
                │ Fila 1: nº · tipo · peso · volumen · piezas   │
                │ Fila 2: nº · tipo · peso · volumen · piezas   │
                └───────────────────────────────────────────────┘

Aéreo/Terrestre → paso 1 sigue con los tres inputs editables (sin lista de contenedores).
```

## Verificación

- **Playwright 1280×1800** en `/embarques/<id>/editar` (embarque marítimo): el paso 1 ya no muestra los tres inputs; muestra la tarjeta de totales. Al editar peso/volumen/piezas en un contenedor del paso 2 y volver al paso 1, los totales reflejan la suma. Screenshots antes/después.
- Segundo run con un embarque aéreo: los tres inputs siguen presentes en paso 1.
- Test unitario nuevo: al setear `contenedores`, `pesoKg`/`volumenM3`/`piezas` del form se actualizan a la suma.
- Test de esquema: en marítimo, un form sin `pesoKg` no falla si hay contenedores válidos.
- CI: `lint`, `typecheck`, `vitest run` (para el archivo `embarqueWizardSchemas.test.ts` y el nuevo).

## Changelog

- `APP_VERSION` → `13.303.33`.
- Entrada breve: "Embarques marítimos: peso/volumen/piezas totales se calculan automáticamente desde los contenedores; ya no se capturan dos veces."

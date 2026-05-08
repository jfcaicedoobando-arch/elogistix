# Validar naviera desde catálogo con SCAC en el formulario de embarques

## Diagnóstico

- `NavieraSelect` ya guarda el **código SCAC** (no el nombre), pero no impide que llegue un valor manual/heredado.
- El embarque legado tenía `naviera = "ZIM"` porque en el catálogo el SCAC estaba mal capturado (3 letras). Ya se corrigió a `ZIMU`, pero faltan defensas para que esto no vuelva a pasar.
- El edge function `terminal49-create-tracking` actualmente busca en `navieras.name`, cuando el formulario guarda `navieras.code`. Eso también hay que alinearlo.

## Pasos

1. **Validación en el catálogo (capturar SCAC correcto)**
   - En el formulario de gestión de navieras (Configuración → Catálogos): exigir que `code` sea exactamente 4 letras A–Z (regex `^[A-Z]{4}$`), uppercase automático, mensaje claro "El SCAC debe tener 4 letras".
   - Mismo check en migración: trigger de validación o `CHECK (code ~ '^[A-Z]{4}$')` en `navieras`.

2. **Validación en el wizard de embarque (StepDatosRuta)**
   - Reforzar el zod `embarqueWizardSchemas`:
     - Para modo Marítimo, `naviera` debe cumplir `^[A-Z]{4}$` (forma SCAC).
     - Mensaje: "Selecciona una naviera del catálogo (SCAC válido)".
   - En `NavieraSelect`: detectar valor que no exista en el catálogo y mostrar badge rojo "SCAC no válido" debajo, con CTA "Corregir en catálogo de navieras".
   - Pequeña ayuda visual: mostrar el SCAC con tooltip "Standard Carrier Alpha Code (4 letras) usado para tracking automático".

3. **Alinear el edge function con el dato real**
   - `terminal49-create-tracking`: buscar primero por `navieras.code = embarque.naviera`, luego fallback por `name ILIKE`.
   - Mensaje de error más útil cuando no exista: incluir el valor recibido y enlace a "Configuración → Navieras".

4. **Sanear datos existentes (one-shot)**
   - Detectar embarques con `naviera` que no matchee ningún `code` del catálogo y proponer corrección. Por ahora solo emitir un reporte read-only en consola/log; no autocambiar datos sin revisión.

5. **Changelog + versión patch**

## Detalles técnicos

```ts
// embarqueWizardSchemas.ts (modo Marítimo)
naviera: z.string().trim().regex(/^[A-Z]{4}$/, "Selecciona una naviera del catálogo (SCAC de 4 letras)")
```

```ts
// NavieraSelect: marcar invalid si value no está en data
const isInvalid = !!value && !navieras.some(n => n.code === value);
```

```sql
-- Migración (validación a nivel DB)
ALTER TABLE public.navieras
  ADD CONSTRAINT navieras_code_scac_format CHECK (code ~ '^[A-Z]{4}$') NOT VALID;
-- NOT VALID para no romper filas históricas; nuevas inserts/updates sí se validan.
```

## Fuera de alcance

- Migrar masivamente embarques históricos con naviera mal capturada (se hace caso por caso).
- Rediseño visual del select.

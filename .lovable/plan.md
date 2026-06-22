## Objetivo

Agregar un paso más al checklist de cierre de embarques: validar que cada contenedor (FCL marítimo) tenga capturadas su **fecha de descarga** y su **fecha de devolución**.

## Contexto

- Las columnas `fecha_descarga` y `fecha_devolucion` ya existen en `embarque_contenedores`.
- El checklist se calcula en el RPC `validar_cierre_embarque` (última versión en migración `20260621020654_...sql`). Cada regla agrega un objeto al JSONB `checks` y opcionalmente bloquea `puede_cerrar`.
- La UI (TabCierre + `cierreCheckMeta.ts` + `cierreCheckFormatters.ts`) renderiza cada regla con etiqueta, responsable, formato de detalle y botón de acción.

## Cambios

### 1. Migración SQL — actualizar `validar_cierre_embarque`
Agregar una regla nueva **solo para `Marítimo` + `tipo_carga ILIKE 'FCL%'`**, justo después del check `contenedores_datos_completos`:

```sql
SELECT COUNT(*), COALESCE(array_agg(id), ARRAY[]::uuid[])
  INTO v_cont_sin_fechas, v_cont_fechas_ids
FROM embarque_contenedores
WHERE embarque_id = p_embarque_id AND deleted_at IS NULL
  AND (fecha_descarga IS NULL OR fecha_devolucion IS NULL);
v_ok := (v_cont_sin_fechas = 0); v_puede := v_puede AND v_ok;
v_checks := v_checks || jsonb_build_array(jsonb_build_object(
  'regla','contenedores_fechas_completas','ok',v_ok,
  'detalle', jsonb_build_object('contenedores_sin_fechas', v_cont_sin_fechas, 'ids', v_cont_fechas_ids)));
```

Es **bloqueante** (afecta `puede_cerrar`), igual que las demás reglas operativas.

### 2. `src/features/embarques/utils/cierreCheckFormatters.ts`
Agregar `fmtContenedoresFechas` que lea `contenedores_sin_fechas` y devuelva `"N contenedor(es) sin fecha de descarga o devolución"`.

### 3. `src/features/embarques/utils/cierreCheckMeta.ts`
Registrar la nueva entrada en el mapa `META`:

```ts
contenedores_fechas_completas: {
  label: "Fechas de descarga y devolución capturadas",
  responsable: "Operador",
  ruta: rutaContenedores, // reutiliza ?tab=resumen&focus=contenedores&ids=...
  ctaLabel: "Ir a Resumen",
  formatDetalle: fmtContenedoresFechas,
},
```

### 4. Tests
Actualizar `TabCierre.rules.test.ts` y `cierreCheckMeta.test.ts` si tienen snapshot de reglas reconocidas, para incluir la nueva clave.

### 5. Versionado y changelog
- Bump `APP_VERSION` (patch).
- Entrada en `CHANGELOG.md` (root) describiendo la nueva regla del checklist.

## Notas

- La regla aplica únicamente a embarques **marítimos FCL** (mismo gate que el check existente de peso/volumen). Para LCL, aéreo y terrestre la regla se omite.
- No se requieren cambios en formularios: ya existe la captura de ambas fechas en `embarque_contenedores`.

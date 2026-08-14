# Arreglo: la vigencia del PDF no respeta la fecha que captura el usuario

## Qué está pasando (confirmado con datos)

Revisé la cotización del reporte, `COT-2026-0174`:

| Campo guardado | Valor |
| --- | --- |
| Validez propuesta (lo que capturó el usuario) | 21/08/2026 |
| Días de vigencia | 7 |
| **Fecha de vigencia (la que sale en pantalla y en el PDF)** | **29/08/2026** |

Creada el 14/08/2026. `29/08` = fecha de creación + **15 días**, que es el valor por omisión del sistema.

La causa: la fecha de vigencia sólo se calcula **al crear** la cotización. En ese primer guardado del Paso 1 todavía no había una validez propuesta, así que se usó el default de 15 días. Después el usuario capturó 21/08/2026 y el sistema guardó bien la "validez propuesta" y los "7 días"… pero **nunca recalculó la fecha de vigencia**, que quedó congelada en 29/08.

Analogía: es como una etiqueta de caducidad que se imprime cuando abres el expediente. Si luego cambias la fecha real de caducidad en la ficha interna, la etiqueta pegada en el sobre sigue diciendo lo viejo — y la etiqueta es justo lo que se imprime en el PDF.

No es un caso aislado: **27 de 176 cotizaciones** tienen la fecha de vigencia distinta a la validez propuesta capturada.

## Qué voy a hacer

1. **Una sola fuente de verdad**: si el usuario captura una validez propuesta, esa fecha *es* la vigencia. Ya no se recalcula sumando días.
2. **Regla en la base de datos** (aplica al crear y al editar, sin importar desde qué pantalla): al guardar una cotización, si viene validez propuesta se sincroniza la fecha de vigencia con ella y los "días" se derivan de la diferencia contra la fecha de emisión. Si no hay validez propuesta, se mantiene el comportamiento actual (emisión + días, default 15).
3. **Corrección de datos históricos**: alinear las 27 cotizaciones desalineadas (solo las que tienen validez propuesta capturada; no se toca ninguna ya aceptada/convertida en su lógica de negocio, sólo la fecha mostrada).
4. **Limpieza en el cliente**: el guardado del Paso 1 deja de derivar `vigencia_dias` desde `Date.now()` (cálculo frágil que cambia según la hora del día) y manda la fecha capturada; la actualización deja de poder dejar la vigencia desincronizada.
5. **Coherencia en pantalla y PDF**: la tarjeta "Datos Generales" y el PDF muestran la misma fecha; si validez propuesta y vigencia coinciden se deja de repetir el dato dos veces con valores distintos.

## Detalle técnico

- Migración: función trigger `public._cotizaciones_sync_vigencia()` en `BEFORE INSERT OR UPDATE` de `public.cotizaciones`:
  - si `NEW.validez_propuesta IS NOT NULL` → `NEW.fecha_vigencia := NEW.validez_propuesta` y `NEW.vigencia_dias := GREATEST(1, NEW.validez_propuesta - COALESCE(NEW.created_at::date, CURRENT_DATE))`;
  - si es `NULL` → `NEW.fecha_vigencia := COALESCE(NEW.fecha_vigencia, fecha_base + COALESCE(NEW.vigencia_dias,15))`.
  - Se respeta el estándar de fechas del proyecto (día local MX, sin `toISOString`).
- Backfill en la misma migración: `UPDATE cotizaciones SET fecha_vigencia = validez_propuesta WHERE validez_propuesta IS NOT NULL AND validez_propuesta <> fecha_vigencia AND deleted_at IS NULL`.
- Cliente:
  - `src/features/cotizacion/domain/mappers/cotizacion.ts`: `vigenciaDias()` deja de usar `Date.now()`; se calcula contra el día local MX (`hoyMx`) y sólo como valor informativo.
  - `src/features/cotizacion/services/mutations/crear.ts`: cuando `validez_propuesta` viene, `fecha_vigencia` se toma de ella en lugar de `hoy + dias`.
  - `src/features/cotizacion/services/mutations/update.ts`: si el payload trae `validez_propuesta`, incluir `fecha_vigencia` alineada (el trigger es la red de seguridad).
  - `CotizacionDatosGeneralesCard.tsx` y `src/pdf/documents/CotizacionDocument.tsx` / `src/generators/cotizacion/datosGenerales.ts`: no mostrar dos fechas contradictorias.
- Tests: caso de regresión "crear sin validez → editar agregando validez ⇒ `fecha_vigencia` = validez" en los tests de mappers/mutations, y prueba RLS/SQL del trigger en `supabase/tests/`.
- `CHANGELOG.md` + `APP_VERSION` (13.616.0).

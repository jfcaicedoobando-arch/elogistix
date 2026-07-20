## Objetivo
Eliminar el "escape hatch" que permite a algunos roles crear embarques sin cotización vinculada. Regla dura post-cambio: **todo embarque nuevo nace de una cotización aceptada**, sin importar el rol. Los embarques legacy sin cotización siguen intactos (159/219 en BD).

## Analogía
Hoy la app tiene un botón secreto "Nuevo embarque desde cero" que sólo ven los gerentes — como una puerta trasera al almacén. Vamos a tapiar esa puerta: todos, incluso el jefe, entran por la puerta principal (empezando desde una cotización aceptada).

## Cambios

1. **Permiso — `src/hooks/shared/usePermissions.ts`**
   - Borrar la constante `CREAR_EMBARQUE_LIBRE` y la propiedad `canCrearEmbarqueLibre` del objeto retornado.

2. **Ruta wizard — `src/features/embarques/routes/NuevoEmbarque.tsx`**
   - Quitar el import y el `useEffect` del guard.
   - Nuevo guard simple: si NO llega con `cotizacionPrevinculadaId` en `location.state`, `toast` "Selecciona primero una cotización aceptada" y `navigate("/cotizaciones", { replace: true })`.

3. **Listado — `src/features/embarques/routes/Embarques.tsx`**
   - Quitar el botón "Nuevo embarque" (ya no hay entrada libre al wizard). Deja el botón sólo para acciones que sigan aplicando; si el único CTA era ese, el bloque se elimina completo.
   - Alternativa (a validar en implementación al leer el archivo): reemplazarlo por un CTA "Nueva cotización" que lleve a `/cotizaciones/nueva`. Si la página ya lo tiene en otro lado, sólo se elimina.

4. **Wizard hook — `src/features/embarques/hooks/useNuevoEmbarqueWizard.ts`**
   - Quitar `usePermissions()` y la variable `canCrearEmbarqueLibre`.
   - `requiereCotizacion` pasa a ser siempre `true` en la llamada al validador.
   - El chequeo `if (!canCrearEmbarqueLibre && !cotVinc.cotizacionVinculada?.id)` queda como `if (!cotVinc.cotizacionVinculada?.id)`.
   - Actualizar deps de `useCallback`.

5. **Validador — `src/features/embarques/domain/embarqueWizardStepValidator.ts`**
   - `requiereCotizacion` deja de ser opcional; validación de step 1 siempre exige `cotizacionVinculadaId`. Se elimina la rama "sin requerimiento" y su test asociado.

6. **StepDatosGenerales — `src/features/embarques/components/StepDatosGenerales.tsx`**
   - Quitar `usePermissions()` y derivar `requiereCotizacion = true`. El banner "Cotización requerida" ya no depende del rol.

7. **BloqueVinculacion — `src/features/embarques/components/secciones/BloqueVinculacion.tsx`**
   - Eliminar la prop `requiereCotizacion` y la rama que renderiza el label como "opcional". Siempre se rotula "Vincular cotización Aceptada (obligatorio)" y aplica estilo `text-destructive` si falta.

8. **Header detalle — `src/features/embarques/components/EmbarqueDetalleHeader.tsx`**
   - Se conserva el badge "Sin cotización vinculada" (aplica a legacy). Sólo actualizar el `title` a "Embarque legacy sin cotización vinculada (creado antes de la política tarifa-first)".

9. **Tests**
   - `useNuevoEmbarqueWizard.test.tsx`: eliminar mock `canCrearEmbarqueLibre: true` (ya no existe).
   - `embarqueWizardStepValidator.test.ts`: eliminar el caso "requiereCotizacion=false (admin) no exige cotización" y consolidar los dos casos restantes en tests que asumen la regla dura.

10. **No BD**
    - `embarques.cotizacion_id` queda **nullable** — hay 159 embarques legacy que rompería un `NOT NULL`. La regla se enforcea sólo en frontend + en el flujo de creación. Los RPCs actuales (`crear_embarque_borrador_core`) ya reciben un `cotizacion_id` obligatorio desde el flujo cotización→embarque, así que no hay cambio de contrato.

11. **Versión y changelog**
    - `APP_VERSION` → `13.303.26`.
    - `CHANGELOG.md`: entrada `## [13.303.26]` explicando que se cerró el escape hatch, mencionando que datos legacy quedan intactos y que la política queda alineada con la memoria `wizard-cotizacion-flujo`.

## Fuera de alcance
- No se migran ni se "adoptan" los 159 embarques legacy a cotizaciones ficticias.
- No se toca la creación desde el detalle de una cotización (`/cotizaciones/:id → Generar embarque`), que ya es el único camino válido.
- No se cambia RLS ni RPCs.

## Riesgos
- Si algún gerente confiaba en el botón libre para un caso de rescate, deja de tenerlo. Se documenta en el changelog para que operaciones sepa que ahora *tienen* que crear una cotización primero (aunque sea mínima) antes del embarque.

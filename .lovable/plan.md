# Arreglar el error "Cotización — Modo: requerido." en Paso 1

## Qué pasó (diagnóstico verificado)

La cotización se guardó sin el campo **Modo de transporte**. Es como intentar sellar un pedido de embarque sin decir si va por barco, avión o camión: la base de datos lo rechaza al final del proceso.

Lo confirmé leyendo el código:

- `COTIZACION_FORM_DEFAULTS` arranca con `modo: ""` (también `tipo`, `incoterm`, `descripcionMercancia`, `origen`, `destino` vacíos).
- La validación previa al guardado (`validatePaso1` en `handlePaso1Crm.ts`) sólo revisa cliente/prospecto, ruta terrestre y tarifa marítima. **No revisa modo, tipo, incoterm, descripción, origen ni destino.**
- Por eso el formulario deja avanzar y el error aparece hasta el boundary de mutación (`cotizacionDraftInputSchema`), que devuelve el texto técnico "Cotización — Modo: requerido." dentro de un toast rojo genérico "Error al guardar datos generales".

Es decir: no es un bug de datos ni de permisos, es una validación que llega demasiado tarde y con un mensaje que no le dice al usuario qué hacer.

## Qué se va a construir

1. **Validar antes de guardar.** Agregar los campos obligatorios del borrador (modo, tipo, incoterm, descripción de la mercancía, origen, destino) a la validación del Paso 1, de modo que al presionar "Continuar" se marquen en rojo los campos faltantes, con desplazamiento y foco a la sección correspondiente, sin llamar a la base de datos.
2. **Mensajes claros en español MX.** Textos tipo "Selecciona el modo de transporte." en lugar de "Modo: requerido.", siguiendo el catálogo de mensajes existente.
3. **Resumen único.** Un solo toast "Revisa los campos marcados" con la lista breve de lo que falta, en vez del error técnico.
4. **Red de seguridad intacta.** El schema de mutación no se toca: sigue siendo la última barrera. Y si aun así llegara un error del backend, se conserva el marcado inline actual (`marcarErroresGuardadoPaso1`).

## Detalles técnicos

- Nuevo schema en `src/features/cotizacion/domain/schemas/wizardPasos.ts`: `datosGeneralesSchema` con los seis campos requeridos y mensajes del catálogo.
- `validatePaso1` (`hooks/wizard/handlePaso1Crm.ts`) encadena el nuevo validador **primero**, antes de cliente/prospecto/terrestre/marítimo.
- `scrollToErrorSection.ts`: extender `campoParaErrorPaso1` y `seccionParaErrorPaso1` para los nuevos mensajes (sección "datos generales" / "ruta").
- Tests unitarios: casos de campo faltante por cada uno de los seis campos en los tests existentes de `handlePaso1Crm` / `useCotizacionWizardSteps`.
- `CHANGELOG.md` + bump de `APP_VERSION` (patch).

## Fuera de alcance

No se cambian defaults del formulario (poner "Marítimo" por default adivinaría por el usuario) ni el layout del Paso 1.

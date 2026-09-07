# Arreglo: "Moneda: requerido" al guardar el Paso 1 de una cotización nueva

## Qué está pasando

En `/cotizaciones/nueva`, si al llegar al Paso 1 ya hay contenido económico (una tarifa que pre-llenó costos internos, o renglones de venta con importe), el sistema decide a propósito **no** enviar la moneda del encabezado, para no reinterpretar dinero ya capturado. Esa protección tiene sentido al *editar* una cotización que ya tiene moneda guardada, pero en una cotización **nueva** no hay moneda previa que proteger: el guardado se queda sin moneda y la validación responde "Cotización — Moneda: requerido." (error reportado por valeria.zamora, versión 13.823.190).

## Qué se va a corregir

Al guardar por primera vez (cotización sin identificador todavía), la moneda del encabezado nunca queda vacía. Se determina así:

1. Si sólo hay renglones con importe en una moneda (sólo MXN o sólo USD), se usa esa.
2. Si hay ambas monedas o ninguna con importe, se usa la moneda de la oportunidad vinculada y, si no hay, USD.

Al **editar** una cotización existente, el comportamiento actual no cambia: si ya hay importes capturados, la moneda guardada se respeta y no se toca.

## Alcance

- Sólo el armado del Paso 1 del asistente de cotizaciones y su regla de moneda.
- No se cambian importes, conceptos, costos, IVA, tipo de cambio, permisos, RLS, base de datos ni el vínculo con el CRM.
- No se publica.

## Detalle técnico

- `src/features/cotizacion/domain/mappers/cotizacion.ts`: `monedaPaso1` recibe el contexto de creación/edición y, en creación, resuelve siempre un valor; se agrega la derivación por moneda dominante de los renglones capturados (helper puro en el mismo dominio, sin nuevos módulos).
- `src/features/cotizacion/hooks/wizard/useCotizacionWizardForm.ts`: `buildPaso1Data` pasa `esNuevo` (`!cotizacionId`) y las monedas con contenido (`conceptosUSD`, `conceptosMXN`, `costosInternos`) al mapper.
- `src/features/cotizacion/domain/cotizacionSinImportes.ts`: se reutiliza `conceptoTieneContenido` / `costoTieneContenido` para saber qué moneda trae importes; no se altera `esBorradorSinImportes`.
- Regresiones focalizadas preparadas (no ejecutadas localmente) en `src/features/cotizacion/domain/mappers/__tests__/cotizacionBuildPaso1.test.ts`: creación con sólo MXN, sólo USD, mixto, sin importes, y edición con importes (moneda omitida como hoy).
- Bump patch en `src/constants/appVersion.ts` + entrada en `CHANGELOG.md`. Validación local únicamente typecheck y ESLint focalizado; CI/RLS quedan para GitHub Actions.

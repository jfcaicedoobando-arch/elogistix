# Homologar y mejorar los timelines del detalle de embarque

## Situación actual

Hoy hay **tres** representaciones distintas del avance/eventos de un embarque, cada una con su propio criterio:

| Dónde | Componente | Qué muestra | Fuente de verdad |
|---|---|---|---|
| Tab Resumen | `EstadoProgresoCard` | "Paso 2 de N" + N barritas planas | `ESTADOS_EMBARQUE` (lista de estados del enum) |
| Tab Tracking | `TrackingFasesTimeline` | Stepper con 8 fases, emoji y fecha | `calcularFasesEmbarque` (fases canónicas) |
| Tab Tracking / Portal | `TrackingEventTimeline` / `TrackingPublicoTimeline` | Bitácora de eventos con punto y línea | tabla de eventos |

Problemas:

- Resumen y Tracking pueden contar pasos distintos (barritas por estado vs. 8 fases canónicas), así que el "avance" no coincide entre pestañas.
- Estilos duplicados: dos timelines de eventos con el mismo markup copiado (interno y portal) y dos lenguajes visuales de progreso (barras vs. círculos).
- Los emojis (⚓ 🛃 📦 🏁) se ven inconsistentes con el resto de la app, que usa iconos Lucide.
- Fases sin fecha muestran "—" sin distinguir "pendiente" de "sin dato", y no se ve si una fase va retrasada respecto a ETA.

## Objetivo

Un solo lenguaje visual de línea de tiempo, con una sola fuente de verdad de fases, en dos densidades: compacta (Resumen) y completa (Tracking / Portal).

## Qué se va a construir

### 1. Componente único de fases: `FasesEmbarqueStepper`

Nuevo componente compartido en `src/features/embarques/components/tracking/`, alimentado **siempre** por `calcularFasesEmbarque`, con dos variantes:

- `variant="compacta"` → una sola fila: estado actual + siguiente + rail de 8 nodos pequeños con tooltip (fase + fecha). Reemplaza el contenido de `EstadoProgresoCard` en el tab Resumen, conservando la altura reducida actual y el `data-testid="estado-progreso"` (hay tests y E2E que dependen de él).
- `variant="completa"` → stepper horizontal en escritorio y vertical en móvil, como el actual del tab Tracking, pero mejorado (abajo). Reemplaza `TrackingFasesTimeline`.

Resultado: Resumen y Tracking siempre muestran el mismo número de fases y la misma fase actual.

### 2. Mejoras visuales del stepper

- Iconos Lucide por fase (`FileText`, `CheckCircle2`, `Ship`/`Plane`/`Truck` según modo, `Anchor`, `Landmark`, `PackageCheck`, `FileCheck2`, `Flag`) en lugar de emojis; el icono de tránsito cambia según `modo`.
- Tres estados visuales claros y consistentes con los tokens del sistema: **completada** (relleno accent + check), **actual** (relleno accent + halo animado suave), **pendiente** (contorno tenue, sin relleno).
- Conector con relleno progresivo (el tramo hacia la fase actual se pinta a la mitad) en lugar de salto binario.
- Fechas: "dd MMM" en escritorio con tooltip de fecha completa; las fases futuras con ETA muestran la fecha en tono tenue con prefijo "est.", y las sin dato dicen "Pendiente" en vez de "—".
- Señal de riesgo: si la fase actual es tránsito/arribo y la ETA ya pasó sin llegada real, el nodo actual toma el color de advertencia y aparece el mismo texto que ya usa el banner de ETA vencida (sin duplicar la lógica: se reutiliza el cálculo existente del tab Tracking, elevado a un helper compartido).
- Fase actual con `aria-current="step"` y el `progressbar` accesible que ya existe.
- Scroll horizontal contenido en pantallas medianas para que las 8 fases no se aplasten (probado a 1366×768 y 1920×1080).

### 3. Timeline de eventos unificado

- Extraer un componente `TimelineEventoItem` + contenedor `TimelineLista` en `tracking/`, y usarlo tanto en `TrackingEventTimeline` (interno) como en `TrackingPublicoTimeline` (portal), eliminando el markup duplicado. El interno sigue mostrando el usuario responsable; el público no.
- Mejoras: agrupar eventos por día con un encabezado tenue de fecha, punto más grande para el evento más reciente con etiqueta "Último", icono Lucide por tipo de evento (mismo mapa de iconos que el stepper) y línea vertical alineada al centro del punto.
- Estados vacío y de carga siguen usando `EmptyStateInline`.

### 4. Consistencia de contenedores

Tarjetas con el mismo título y jerarquía en ambas pestañas: "Avance del embarque" (stepper) y "Línea de tiempo" (eventos), con el mismo `CardHeader` compacto ya usado en el módulo.

## Detalles técnicos

- Fuente de verdad única: `src/features/embarques/domain/embarqueFases.ts`. `EstadoProgresoCard` deja de calcular su propio índice con `ESTADOS_EMBARQUE`; `TabResumen` pasa el objeto de fases (los campos que necesita ya están en `EmbarqueRow`).
- El mapa fase → icono vive en `embarqueFases.ts` como identificador de icono (string), y el componente resuelve el componente Lucide, para que el dominio quede libre de UI.
- `isArribado` / `isEtaVencida` se mueven de `TabTracking.tsx` a `domain/embarqueFases.ts` (o helper vecino) y se importan en ambos lados: nada de duplicar reglas de fecha. Se mantiene el parseo local `YYYY-MM-DD` que ya arregla el desfase de zona horaria.
- Sin cambios de base de datos, de RLS ni de consultas.
- Componentes nuevos por debajo de 200 líneas; sin colores hardcodeados (solo tokens `accent`, `muted`, `warning`, `border`).
- Tests: unitarios del mapeo fase→icono/estado y de la variante compacta (mismo conteo de fases que la completa para un embarque dado); se actualizan los tests existentes de `EstadoProgresoCard` y `TrackingFasesTimeline` a los nuevos componentes; el E2E de pestañas de detalle sigue verde por conservar los `data-testid`.
- `CHANGELOG.md` + `APP_VERSION` al cierre.

## Fuera de alcance

- Cambiar la lógica de negocio de estados o transiciones del embarque.
- Nuevas fases o campos de fecha en la base de datos.
- Rediseñar el resto del tab Resumen (tarjetas de datos, partes, contenedores).

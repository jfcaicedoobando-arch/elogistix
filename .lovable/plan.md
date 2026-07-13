# Auditoría UX/UI — Wizard de Cotización

Me puse en los zapatos del asesor comercial que cotiza 10-30 embarques al día. Lo bueno primero: el wizard **ya es funcional** (4 pasos, sidebar de progreso, tarifa-first en marítimo, atajo "sin desglose", validación por sección, guardado optimista). No está roto y podría salir a producción, pero hay fricciones claras que erosionan la velocidad y la confianza. Lo dejaría en producción **después** de aplicar al menos las mejoras P0.

## Diagnóstico rápido (lo que se siente al usarlo)

**Paso 1 — Datos generales**

- Muchas secciones apiladas en una sola columna larga (Cliente → Operación → Ruta → Mercancía → Tarifa → Condiciones → Cierre). Con LCL y marítimo el usuario hace scroll de 4-5 pantallas.
- El sidebar de progreso está bien, pero desaparece en <lg. En tablet (donde vive medio equipo comercial) no hay ancla visual.
- No hay atajos de teclado (Enter para siguiente, Cmd+S para guardar). Se pierde tiempo con el ratón.
- El botón "Cotizar sin desglose" convive con "Siguiente" en el mismo footer y es rojo → parece un error crítico, no un atajo. Genera duda cada vez.

**Paso 2 — Costos & P&L**

- La tabla de costos internos no da feedback en vivo del margen mientras se captura. El P&L vive en el paso 4. El usuario captura a ciegas y regresa a corregir.
- No hay indicador de "auto-cargado desde tarifa" a nivel fila (sólo un banner global). Cuesta saber qué es editable vs. heredado.

**Paso 3 — Cotización cliente**

- Dos tarjetas separadas USD / MXN. Correcto conceptualmente, pero al agregar filas nuevas siempre hay que elegir moneda de nuevo → el flujo natural sería "agregar concepto" y que el sistema lo ponga en el bucket correcto.
- Los warnings de "filas mixtas" son texto denso. Un usuario nuevo no entiende qué hacer.
- Totales viven al pie de cada tabla + un bloque final. Redundante y confuso cuando hay muchas filas (el pie queda fuera de vista).

**Paso 4 — Resumen**

- Muestra P&L y datos de embarque, pero no un preview de cómo se verá la proforma para el cliente. El usuario "confía" que el output está bien.
- No hay CTA claro post-guardado (¿enviar proforma? ¿duplicar? ¿crear embarque?). Se guarda y el usuario queda huérfano.

**Transversal**

- No hay indicador de "autoguardado / borrador". Si el navegador se cierra, se pierde todo. Riesgo real con formularios de 15+ campos.
- No hay skeleton al cargar catálogos (clientes, puertos, tarifas) → el select aparece vacío por 300-800ms.
- Los toasts de error de validación son genéricos ("Completa los campos requeridos") en vez de saltar al primer campo inválido.
- Mobile: el footer no es sticky en algunos viewports, cuesta llegar a "Siguiente".

## Prioridades

### P0 — Bloqueantes antes de anuncios de producción

1. **Autoguardado de borrador** (localStorage con TTL 24h + banner "restaurar borrador"). El wizard es largo; perder captura mata la confianza.
2. **Errores navegables**: al fallar validación, hacer scroll+focus al primer campo inválido y resaltar la sección. Reemplazar toast genérico.
3. **CTA post-guardado**: al terminar el paso 4, abrir un dialog "¿Qué sigue?" con acciones: Enviar proforma, Duplicar cotización, Crear embarque, Volver al listado.
4. **Rediseñar "Cotizar sin desglose"**: sacarlo del footer principal, moverlo a un menú "⋯ Más acciones" con confirmación explícita. Deja de competir visualmente con "Siguiente".

### P1 — Alta prioridad (semana 1 post-lanzamiento)

5. **P&L en vivo en Paso 2 y 3**: sticky pill con margen % y USD/MXN mientras se editan filas. Elimina el ida-y-vuelta al paso 4.
6. **Preview de proforma en Paso 4**: iframe/dialog con render real (misma plantilla que se envía al cliente). Aumenta confianza dramáticamente.
7. **Sidebar de progreso en tablet** (md+): usar drawer colapsable o breadcrumb pegajoso.
8. **Atajos de teclado**: Enter = Siguiente, Shift+Enter = Anterior, Cmd/Ctrl+S = Guardar. Documentar en tooltip.
9. **Indicador de fila heredada** en Paso 2: badge "Auto" gris a la izquierda de filas que vienen de tarifa; al editarlas cambian a "Editado".

### P2 — Refinamiento visual/UX

10. **Unificar botón "Agregar concepto"** en Paso 3: un solo botón con selector de moneda inline, o inferir moneda desde el catálogo SAT del concepto.
11. **Warnings de filas mixtas**: reemplazar por chip inline en la fila afectada con acción "Mover a bucket MXN".
12. **Totales flotantes**: reemplazar los 3 bloques de totales por una barra sticky inferior única con desglose expandible.
13. **Skeletons** en selects de cliente, puerto, tarifa mientras cargan catálogos.
14. **Footer sticky** garantizado en todos los viewports; agregar shadow al hacer scroll para separar del contenido.
15. **Micro-copy**: cambiar "Cotización Cliente" → "Precio al cliente", "Costos & P&L" → "Tus costos". Lenguaje más directo para asesores nuevos.

### P3 — Nice-to-have

16. **Plantillas de cotización**: guardar combinaciones frecuentes (ej. "LCL Shanghai-Manzanillo estándar") y precargar en 1 click.
17. **Comparador de tarifas** en Paso 1 marítimo: mostrar top 3 tarifas lado a lado en vez de una selección lineal (ya existe el ranking, exponerlo visualmente).
18. **Historial de cambios** dentro del wizard para cotizaciones existentes (quién editó qué campo).
19. **Modo compacto/experto**: toggle que colapsa descripciones y aumenta densidad para power users.

## Recomendación

**No lo dejaría como está.** Es un flujo diario y crítico para el negocio, y las fricciones P0 (pérdida de borrador, errores no navegables, CTA post-guardado ausente) se van a traducir en soporte y en cotizaciones perdidas. Con **P0 + P1 (≈4-5 días de trabajo)** el wizard queda a nivel producción de forwarder mexicano premium. P2/P3 se pueden iterar con feedback real de usuarios.

## Notas técnicas (para el implementador)

- El wizard vive en `CotizacionWizardLayout.tsx` (95 líneas) + `CotizacionWizardSteps.tsx` (99 líneas). Bien modularizado, cabe la mejora sin refactor mayor.
- Autoguardado: usar `browserStorage` wrapper (ver `mem://technical/browser-storage`) con key `cotizacion:draft:{userId}` y expiración 24h. Hook `useDraftAutosave(formValues)` con debounce 800ms.
- Errores navegables: `form.formState.errors` + `document.getElementById(seccion).scrollIntoView` + `setFocus(firstErrorField)`.
- P&L en vivo: extraer `useTotalesPL` a un hook y montarlo en una `<StickyPLBar />` visible en Pasos 2-3.
- Preview proforma: reutilizar el generador Remotion/PDF ya existente en `src/generators/cotizacion/` renderizado en modal.
- CTA post-guardado: nuevo componente `<CotizacionSuccessDialog />` disparado por `handleGuardar` al resolver la mutación.
- Bump `APP_VERSION` y CHANGELOG por cada fase (P0, P1, P2).

## Siguiente paso propuesto

Confirmar el alcance de P0 (los 4 puntos) y arrancar con ellos como fase 1. ¿Le entramos así, o prefieres que incluya P1 en la primera fase? vamos por fases
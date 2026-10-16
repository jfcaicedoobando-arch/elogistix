# Demo interna: preparación de tarifas de correo

Demo sintética reproducible, sin navegador, buzón real, base de datos ni despliegue.
Ejecuta el diálogo en jsdom y los lectores contra respuestas PostgREST simuladas.

```bash
bun x vitest run src/features/costeo/services/__tests__/importacionTarifasCorreo.test.ts src/features/costeo/tarifario/__tests__/ExtraerCorreoDialog.test.tsx src/features/costeo/tarifario/__tests__/duplicadosTarifas.test.ts --reporter=verbose
```

| Escenario sintético | Resultado que se demuestra |
| --- | --- |
| Shanghai → Manzanillo, Longsail, Maersk, tarifa de 100 USD | Se prepara sin escribir. El guardado requiere elegir «Cargar 1 tarifa(s) en borrador». |
| Coincidencia tras 1000 tarifas de la misma organización | Se consulta la segunda página y se marca el conflicto. Las filas de otra organización quedan fuera. |
| Página de exactamente 1000 tarifas | Se consulta también la página vacía siguiente antes de terminar. |
| Fallo en una página posterior | No se permite cargar ni ofrecer altas con información parcial. Si ocurre al preparar pendientes, se retira la oferta anterior y se muestra el error. |
| Puerto/naviera inactivo globalmente o apagado para la organización | Se reconoce su existencia y se informa que está inactivo/no visible; no se ofrece crearlo otra vez. |
| Tarifa guardada con UUID de un alias histórico de contenedor | Se detecta el conflicto; conservarlo explícitamente guarda el UUID preparado, sin reescribir el existente. |
| Dry frente a GP, HC o Reefer | No se amplía la equivalencia de identidad del catálogo. Tipos distintos no chocan. |

La lectura completa usa `leerTodasLasPaginas`, orden estable y el tope duro existente:
alcanzarlo produce un error visible, nunca una preparación parcial. Los apagados,
agentes, rutas y tarifas se consultan con la organización capturada. Los catálogos
globales de puertos, navieras y contenedores conservan su alcance global.

El cambio se limita a la extracción de correo y sus helpers. La importación CSV/Excel
conserva su contrato anterior de dos argumentos. Se mantienen las preferencias de
tipo 20/40, la elección explícita de conflictos y el guardado en borrador. No cambia
el esquema, los selectores generales ni la política GP/Dry. Agentes y rutas mantienen
su criterio previo de selección; aquí se completa su lectura por páginas.

Validaciones complementarias:

```bash
export VITE_SUPABASE_URL=http://127.0.0.1:54321
export VITE_SUPABASE_PUBLISHABLE_KEY=demo-no-real-key
export VITE_SENTRY_DSN=
bun run typecheck
bun run test -- src/features/costeo/tarifario src/features/costeo/services/__tests__/importacionTarifasCorreo.test.ts src/lib/supabase/__tests__/paginado.test.ts src/features/catalogos/utils/__tests__/tiposContenedorCanonico.test.ts src/features/catalogos/utils/__tests__/tiposContenedorCanonico.containerCatalog.test.ts
```

Estos valores son sintéticos y sólo permiten inicializar módulos de las suites
cercanas que importan el cliente sin consultarlo; no hace falta cargar un `.env` real.

Esta demo verifica decisiones y controles del diálogo; no certifica geometría visual,
acceso al buzón ni el estado de producción. No se habilita la demo pública desactivada.

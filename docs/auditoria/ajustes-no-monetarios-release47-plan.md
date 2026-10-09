# Release 13.824.47 sobre la base46 propuesta

Estado: composición exclusivamente local del 8 de octubre de2026. La base es el paquete46 final propuesto y no publicado, árbol `4f9c15bea974ce8ed2a22ab3c265ebd1e86ef06f`; no se toma HEADcc40 como base. El delta47 aprobado es el árbol `25dcd775cd051b071e00946c1da8d16890274256`, de64 rutas.

## Composición vigente y alcance

- Conserva íntegramente la UI199 y el paquete46: replay literal Drizzle0013/190000, cierre restrictivo ACL190100, corrección de cuatro appends190200, canónicos, types, AGENTS, mapeo replay y guard funcional registrado.
- Sólo intersectan seis envoltorios: AGENTS, CHANGELOG, appVersion, manifiesto, baseline y lista de guards. El resto del delta47 conserva los bytes revisados, salvo la procedencia de este documento.
- Baseline integra únicamente las cuatro funciones47 ya revisadas y sus dos helpers/triggers/ACL nuevos. Todo el contenido ajeno conserva los bytes de la base46, incluido su orden canónico.
- Manifest47 se calcula con1497 migraciones reales:1495 de46 más las dos exactas99/121. Las entradas35–44 y46 se conservan byte a byte en su prefijo serializado. No crea45 ni importa el antiguo45/46 P&L.
- Los guards47 se agregan a la lista completa46, sin quitar el de aprobación provisional. Migraciones, seis canónicos47, pruebas SQL y lógica financiera47 permanecen idénticos al delta aprobado.

## Evidencia aplicable a esta fase

Las invariantes, pruebas focales, typechecks y gates se ejecutan de nuevo sobre esta composición bajo el lock pesado compartido, con destinos sintéticos y red bloqueada. Los resultados y códigos efectivos se entregan aparte y no se presuponen verdes. No se ejecuta SQL, Git remoto, browser, build ni despliegue en esta fase.

Los resultados SQL de46,06b6,81c,8ed ycc40 citados en el registro histórico inferior no prueban el nuevo árbol compuesto. Cualquier validación SQL posterior debe ser independiente, identificar esta base propuesta y el árbol47 final, y distinguir fresh, forward, catálogo/ACL, datos, idempotencia y límites de las suites ejecutadas. Tampoco se traslada a esta composición una aprobación histórica ni un resultado de CI remoto.

Antes de una futura publicación hay que confirmar si46 llegó a main y recomponer contra la base real en ese momento. Este paquete no es una autorización ni un envelope de aplicación remota. La operación restrictiva ACL46 mantiene su autorización de seguridad separada.

## Registro histórico literal del delta47 aprobado sobre cc40

Todo el texto que sigue describe bases y resultados anteriores. Las expresiones «vigente», «nueva composición» o «siguientes» dentro de ese registro se refieren exclusivamente a aquel candidato histórico y no a esta composición sobre46.

# Release 13.824.47: ajustes no monetarios 99/121

Estado: candidato local completo recompuesto sobre main `cc40a18cbfbe0138d789634643d2ea9759af6735` (árbol `f006d912a43d48b4e56ad9be9e0284e3c77531bc`), preparado el 8 de octubre de 2026. Base06b6 revisada independientemente: PASS en árbol `171030ded2f3ce348ff2f8d726176a3913230851`. Composición81c:291 pruebas/47 archivos, lint global, tipos y build locales verdes. Composición8ed: revisión independiente aprobada en árbol `6143f852e6903bceedbbf2fa344102a545c5e808`. La nueva composición cc40 se valida y revisa por separado. No publicado; sin SQL remoto, despliegue ni GUI. PR179 no fue actualizado.

## Fuentes y composición vigente

La fuente histórica es el paquete reconstruido47: árbol padre `5e263d531aea647cd142e51c7a50dae8a75e9e16`, árbol final `06c0d850f92809ca907597caa9733809f6feffff`. Su inventario delimita61 rutas. Se verificaron SHA-256 y predecesores:52 archivos funcionales/de pruebas validados inicialmente, de los cuales49 quedan exactos y tres incorporan la corrección de revisión descrita abajo; seis envoltorios recompuestos (AGENTS, CHANGELOG, appVersion, manifest, baseline y guards), y tres documentos de procedencia. No se importaron commits sintéticos ni se aplicó el patch histórico entero.

La base histórica main06b6 se confirmó mediante GitHub el 8 de octubre de 2026 a las17:20UTC. Sus archivos de tarifario se conservaron, al igual que144/148, cache197, types, referencia NULL/efectivo131/134, cronología135, cierre139, captura62/130 y Aging/Por pagar70. Todo archivo ajeno a las61 rutas permanece idéntico a main. El baseline conserva todos los bytes ajenos a las cuatro funciones y los dos helpers/triggers propios.

El manifest añade únicamente47 con las1494 migraciones reales del árbol; las entradas35–44 permanecen intactas. No se inventan45/46 ni se ejecuta el updater que poda entradas. La función99/121 no depende de las migraciones001800/003200 ni cambia P&L o la lógica144.

## Migraciones exactas

- `20261007023000_audit99_121_historial_ajustes_no_monetarios.sql`: SHA-256 `c3f6fe9a1e325d2bf796dd4ddd68844b8b075737a5787ea3cff9d5b3ab9b03e6`.
- `20261007024500_audit99_121_ajuste_sin_banco.sql`: SHA-256 `499ba9ff5b78a1b71cac391aa33aa27a3ff760160f4dc61ed83d95bc838dc1a7`.

Clasificación sólo por `es_ajuste` persistido. Historial conserva `tipo='pago'` y añade `pago_id`, `es_ajuste` y `motivo_ajuste` al JSON. Desktop/móvil, nombre accesible, detalle y filas compartidas CSV/PDF usan «Ajuste no monetario», mantienen importe documental y conciliación «No aplica». Texto libre «Ajuste» no reclasifica pagos ordinarios. Los servicios fallan cerrado si no pueden verificar la clasificación. La revisión independiente detectó un vínculo bancario histórico presentado como conciliación válida en el detalle: se corrige en las dos piezas de detalle y se añaden dos pruebas renderizadas. La UI conserva fecha, concepto, referencia, importes, estado histórico y enlace de consulta bajo «Vínculo bancario por revisar» / «No aplica», sin mutar datos. Los guards impiden nuevas asociaciones bancarias, activación/restauración de asociaciones de ajustes, ingreso a lotes monetarios y reclasificación del flag, sin corregir ni borrar registros históricos.

## Evidencia histórica validada sobre main06b6 (no reejecutada en cc40)

Sólo entorno local desechable PostgreSQL17.9, loopback127.0.0.1, sin datos reales, bajo el lock compartido de validación. Variables de conexión saneadas; pruebas frontend con destinos locales y bloqueo de red.

- Fresh:300 migraciones posteriores al squash aplicadas; una migración de datos omitida por la lista oficial. Padre main44:298. Los1494 archivos históricos se conservan, no se reejecutan íntegros sobre el squash.
- Dos forwards independientes main44→47 sobre la misma base sintética, con segunda aplicación idempotente. Snapshot de140 tablas/114 filas igual antes y después en ambos forwards; incluye un vínculo histórico sintético de ajuste que no se reescribe.
- Catálogo antes de grants del harness:668 funciones existentes;664 idénticas y cuatro sólo cambian cuerpo. Firmas, owners, ACL y atributos existentes intactos. Dos helpers nuevos RETURNS trigger, sin EXECUTE de PUBLIC/anon; INVOKER para clasificación y DEFINER acotado a organización para activación. Fresh, ambos forwards e idempotencia concilian.
- Snapshots pre-CI fresh/forward idénticos. Baseline posterior al harness igual byte a byte al baseline candidato. El catálogo previo es la evidencia de permisos; el baseline posharness no se utiliza para certificar ACL.
- Suites completas `audit99_121_historial_ajustes` y `audit99_121_ajuste_sin_banco`, más Aging/Por pagar70, verdes en UTC y America/Mexico_City, tanto fresh como forward.
- Concurrencia ordinaria:8 casos, READ COMMITTED/REPEATABLE READ, pago/ajuste y ambos órdenes de envío, con espera observada de locks y sin temporizadores que presupongan el orden.
- Frontend:223 pruebas en43 archivos verdes, repetidas sobre la corrección final (116 enfocadas y107 de regresión), incluidos ajuste desktop/móvil, CSV/PDF, errores y controles ordinarios, devolución/REP, cronología135, Aging70 y cache197.
- Lint final de archivos cambiados y typecheck app/node verdes. El primer arreglo de revisión produjo complejidad17; se retiró el default booleano redundante y se repitieron pruebas/lint/typecheck/build. Los logs frozen-* certifican esa versión final; el fallo anterior se conserva como trazabilidad. Auditores de migraciones, funciones, espejo replay, manifest, tests, arquitectura, RPC-sync y columnas verdes. El auditor de espejo informa dos divergencias preexistentes admitidas por huella exacta y arquitectura informa un archivo preexistente de208 líneas, sin modificar allow-lists. Diff-check verde. Build local de producción, comprobación de sourcemaps y presupuesto de bundle verdes; entry comprimido207KB frente a365KB. ESLint global conserva un único fallo ajeno en el importador tarifario de main06b6 (complejidad49), cuya corrección independiente es PR198.

## Cobertura limitada y pasos siguientes

La suite `audit99_121_ajuste_aislamiento.sql` se conserva completa, pero no se ejecuta íntegra por contener escenarios adversariales fuera del alcance autorizado, incluido un claim de rol falsificado. Un harness externo ejecutó en UTC/México su prefijo ordinario de rollback multirregistro, UPSERT, flag, legado, restauración y desvínculo; eso no equivale a pasar la suite completa. No se desactiva ni elimina ningún test para aparentar verde. No se certifica RLS integral, explotación, CI remoto, build publicado ni cierre GUI. Los dos controles rojos sobre main44 fallan por la ausencia esperada de metadato/guard; los dos nuevos tests del detalle fallan con los módulos históricos y pasan con la corrección. Catorce regresiones SQL adicionales de131/134/135/139/62/130/70 y anticipos pasan en UTC.

Los dos documentos recuperados `audit99-121-ajuste-sin-banco.md` y `ajustes-no-monetarios-99-121.md` están marcados como históricos: sus resultados y referencias a la pila46 no prueban este candidato. El paquete de evidencia vigente conserva comandos, logs, código de salida, inventario y hashes; sólo resultados frescos explícitos pueden utilizarse para aprobación.

Antes de publicar: revisión independiente del árbol congelado y revalidación de main; si avanzó, recomponer y repetir controles afectados, conservando esta evidencia como histórica. La futura operación de base exige preflight independiente de backend/proyecto, historial de migraciones, dependencias, hashes, catálogo y datos; este documento no es un envelope ejecutable. No prepara45, no autoriza SQL remoto ni despliegue.

## Composición incremental de PR198

Después de congelar el candidato sobre06b6, main avanzó a81c1025 (árbol9c8deb9e0384977440fa93d8e20024d0fbd5d91c) al fusionar PR198. Sólo cambió `src/features/costeo/tarifario/importarTarifas.ts` y añadió su prueba de caracterización, rutas disjuntas al alcance99/121. Ambas se conservan exactamente. El delta47 se reaplicó sobre ese árbol real sin cambiarSQL, schema, historial, manifiesto, tipos ni lógica financiera; sólo se actualizan este documento y la procedencia de la nueva entrada de changelog.

La evidenciaSQL citada arriba pertenece al candidato06b6 verificado; una comparación de bytes del árbol completo demuestra que ninguna entradaSQL ni su contexto de ejecución cambia en81c, por lo que no se repite el replay local. La validación incremental repite frontend afectado, tarifario, lint global, tipos y build, y se informa por separado sin atribuirle pruebasSQL nuevas.

## Corte final de main8ed225f

El8 de octubre de2026, la comparación81c→8ed confirmó sólo dos rutas pricing disjuntas: `SolicitudPricingCampos.tsx` y su prueba `SolicitudPricingUnidades.test.tsx`. Se preservaron sus blobs exactos y el árbol completo de main `45a4e1d3e7387cd1c999dc5a63cb327987c60780`, sin recrear ni modificar ese trabajo. Frente al candidato47/81c, sólo cambian esas dos rutas heredadas de main y la procedencia en este documento/changelog; el código99/121 y las2377 entradasSQL/replay/harness/types/dependencias quedan byteidénticos.

No se repitenSQL, build ni la batería frontend por este delta disjunto. Las pruebas291/47, lint global, tipos y build son evidencia fresca del candidato sobre81c; no se presentan como una nueva ejecución integral sobre8ed. El guard de bundle interrumpido se cierra sobre los mismos assets de81c (207KB/365KB), sin reconstruirlos. La revisión final verifica el árbol8ed y el delta de integración, conservando el límite de ausencia deGUI, SQL remoto, publicación y certificación RLS integral.

## Recomposición sobre main cc40 posterior a Lovable

Se extrae exclusivamente el árbol base exacto `f006d912a43d48b4e56ad9be9e0284e3c77531bc`, asociado al commit `cc40a18cbfbe0138d789634643d2ea9759af6735`. El objeto del commit se reconstruye y verifica por SHA con los metadatos originales. No se incorpora el working tree de la reparación UI independiente. El delta de release47 mantiene sus61 rutas; AGENTS conserva la reorganización de CRM y la decisión de proveedores provisionales, añadiendo únicamente el hunk de ajustes. Los tipos Supabase permanecen byteidénticos a cc40, incluidas las nuevas tablas/funciones de provisionales. También se preservan el plan Lovable trasladado, su ruta anterior eliminada, Drizzle0013 y todos los archivos ajenos a release47.

El manifest47 se recompone a partir de los1494 archivos SQL que realmente existen en `supabase/migrations`. Drizzle0013 pertenece a otro catálogo y carece en esta base de replay Supabase; no se inventa ni se añade uno. Las entradas35–44 permanecen byteidénticas, sin45/46. El SQL99/121 conserva los hashes arriba documentados, pero las pruebasSQL de06b6 y el build/frontend de81c son sólo antecedentes: no se ejecuta base de datos, GUI ni build en esta recomposición. La nueva evidencia recoge invariantes, frontend focal, tipos, lint y auditorías estáticas con su base y códigos de salida exactos.

El CI heredado de cc40 tiene bloqueos independientes de release47: falta el replay canónico/mapping de Drizzle0013 y sus cuatro firmas, además de guardias de UI de provisionales que se corrigen en otro trabajo. Estos fallos se conservarán visibles y no se alteran ratchets ni allow-lists para ocultarlos. Una futura integración de esos arreglos requiere recomposición y revisión propias antes de publicación. Este paquete es local: no crea ramas/PRs ni reintenta el blob previamente rechazado.

## Corrección local de arquitectura descubierta en la recomposición cc40

La batería completa de arquitectura añadió cobertura que faltaba en la evidencia anterior: encontró cuatro imports externos profundos propios de47 y un nuevo icono largo en `MovimientoAjusteHistorico`. No son fallos atribuibles al cambio de catálogo ni a la implementación de Lovable. Se conservan el árbol previo `5ded7fc01277770ebc68bcb8064b0f7756c62e88` y sus logs:301 pruebas focales verdes, tipos verdes, pero483 pruebas de arquitectura verdes y7 fallidas.

Se sustituyen los cuatro imports por las superficies públicas de servicios/dominio y se agregan únicamente sus exports necesarios a tres barrels existentes. El nuevo icono usa `size-4`; no se cambia el icono histórico ni umbrales, ratchets o allow-lists. El alcance final pasa de61 a64 rutas por esos tres barrels. No cambian reglas financieras, SQL, tipos generados, la UI provisional ni el manifiesto. Se repiten pruebas focales, arquitectura, lint de cambios y tipos sobre el árbol corregido; los errores heredados de replay0013, queryKeys/queries inline, banners y los933 iconos de cc40 permanecen señalados por separado.

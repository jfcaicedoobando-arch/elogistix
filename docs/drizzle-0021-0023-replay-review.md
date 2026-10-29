# Reconciliación de historia Drizzle: reconstrucción aislada, sin SQL remoto

## Hallazgo y cambio de alcance

El primer borrador de PR401 había añadido tres espejos en `supabase/migrations/`.
No eran fixtures: resultaban elegibles para una futura aplicación. La lectura
remota posterior encontró que Drizzle ya había aplicado los tres orígenes y,
además, una migración histórica retirada de Git por el revert `69b06a5`.
Reaplicar 0021 sobrescribiría el contrato vigente de refacturación; reaplicar
0022 cotización intentaría crear un trigger existente. Esos tres espejos se
retiran del PR **antes de fusionarlo**, junto con sus altas del manifest.
No se borra ninguna migración ya integrada en main, ni se altera el journal
Drizzle actual, ni se ejecuta o registra SQL en bases remotas.

## Historia recuperada y colisión de índice

La fuente exacta es el commit `ec96cf2e4bbb4443be463f1496da0189df2d1bef`:
`drizzle/migrations/0022_refacturar_proforma_abre_edicion.sql`, 3307 bytes,
sin salto final, SHA-256
`8b4272fdc0abdbbbedac41c46e28694f611a59c240e0509bdf02ec2f8b9446fa`.
Su journal histórico usa idx 22, timestamp `1792518064767`; el registro remoto
observado lo identifica como ID 23. El idx 22 **actual** pertenece a
`0022_cotizacion_comercial`, de modo que no se sobreescribe ni renumera.
SQL, snapshot y journal históricos se archivan literalmente en
`scripts/ci/drizzle-history/archive/ec96cf2e4bbb4443be463f1496da0189df2d1bef/`.
La copia sirve como evidencia y entrada de reconstrucción aislada, no como
journal ejecutable por Drizzle. Los hashes de los tres archivos son obligatorios.

## Reconstrucción aislada y guards

`scripts/ci/drizzle-history/control.mjs` fija el orden y hashes completos:

1. 0021 refacturar original;
2. histórica 0022 abre edición (resultado efectivo, no creación automática);
3. actual 0022 comercial de cotización;
4. 0023 margen mínimo.

`drizzle/replay.json` distingue `scope: isolated-ci` para los tres orígenes
actuales. El auditor requiere un mapa **separado, verificado** y bytes idénticos;
no acepta los fixtures como migraciones Supabase ni permite scopes desconocidos.
La historia archivada y sus metadatos se verifican aunque no sean entradas del
journal actual. Los tests negativos cubren ausencia, cambio simultáneo de fuente
y fixture, scope erróneo, admisión adicional y copia elegible no permitida.

Sólo los preparadores de pruebas consumen esta historia después de la cadena
canónica. `rls-prepare-db.sh` exige loopback, prohíbe URLs/overrides remotos y
requiere esquema público vacío antes de bootstrap. `local-verify.sh` construye
su conexión al Postgres efímero propio. No se modifica ningún ejecutor productivo.
Los cambios de fixture/control disparan CI DB y RLS explícitamente.

El baseline refleja el cuerpo final recuperado de refacturación. No prueba por
sí solo el catálogo completo remoto. El snapshot es posterior al harness CI:
sus grants generales NO certifican ACL productivas. El trigger comercial conserva
su comprobación owner-only antes del grant masivo y después de retirar sólo sus
dos grants artificiales. Las diferencias ACL remotas se mantienen como evidencia,
no se corrigen ni se adopta una política nueva de permisos en este PR.

## Publicación y reconciliación externa

Este trabajo no inserta ni cambia registros de migración remotos, no aplica SQL,
no activa automatismos de Lovable, no fusiona y no despliega. La ejecución remota
futura requiere un plan separado de reconciliación basado en el catálogo y ambos
historiales; aprobar este PR de código/pruebas no equivale a autorizarla.

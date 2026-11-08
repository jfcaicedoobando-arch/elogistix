# Plan: squash del historial antiguo + pruebas de CI al día

Contexto: la parte nueva del historial (0000–0041) no se puede compactar sin que Lovable registre en producción el punto de partida como “ya aplicado”; eso sigue pendiente de su respuesta. Lo que sí se puede compactar sin tocar producción son los **~1,540 cambios antiguos** (anteriores a 0000), que hoy sólo se usan para reconstruir la base desde cero en pruebas y en CI.

Analogía: el libro de actas vigente se queda intacto; los tomos viejos se pasan a limpio en un solo tomo y los originales van al archivo muerto.

## Fase 0 — Comprobaciones (sólo lectura, bloqueantes)
1. Confirmar que producción ya no aplica los cambios antiguos y que sólo se usan en la reconstrucción local y en CI. Si alguno se sigue aplicando, se detiene el plan.
2. Listar todo lo que lee esos archivos: scripts de reconstrucción, auditorías, guardas, pasos de GitHub Actions y pruebas.
3. Confirmar que no hay drafts ni migraciones en curso.

## Fase 1 — Punto de partida del historial antiguo
1. Reconstruir la base desde cero con el historial actual y sacar su esquema completo (estructura, funciones, triggers, RLS, permisos, catálogos semilla).
2. Escribirlo como un solo archivo de punto de partida antiguo y verificar que, al reconstruir con ese archivo más 0000–0041, el esquema sale idéntico (normalizado) al de referencia y al de producción.
3. Mover los ~1,540 archivos originales a una carpeta de archivo, fuera de la reconstrucción, para conservar la trazabilidad fiscal.

## Fase 2 — Pruebas y CI desactualizadas
1. Ajustar scripts y pasos de CI que listan, cuentan o leen los archivos antiguos para que usen el punto de partida, y conservar las guardas de integridad: una huella fija del punto de partida y de cada archivo archivado.
2. Corregir las pruebas que se queden desactualizadas por este cambio y las que ya fallaban sin relación con él (por ejemplo, las 24 de “Nueva cotización” de rondas anteriores): investigar la causa real y corregir código o prueba según corresponda, sin bajar umbrales ni debilitar guardas.
3. Validar con pruebas focalizadas, reconstrucción limpia y `db:postcheck`; las suites completas de CI/RLS/E2E corren en GitHub Actions.

## Fase 3 — Cierre
- Regla nueva en `AGENTS.md` sobre el punto de partida antiguo y el archivo.
- Changelog y versión sólo con tu autorización.
- Reversa: devolver la carpeta de archivo a su lugar; producción no cambia en ningún paso.

## Fuera de alcance
- Compactar 0000–0041: espera a que Lovable registre el punto de partida en producción.

## Detalles técnicos
- Afecta `supabase/migrations/*` (pasa al archivo), un nuevo punto de partida, `scripts/db/local-verify.sh`, `scripts/audit-*.ts`, `scripts/ci/*`, `.github/workflows/*` y pruebas en `src/__tests__/scripts/`.
- Nada bajo `drizzle/` se edita a mano; no se ejecuta SQL en producción.
- El esquema se saca de la base local reconstruida, no de un volcado de producción.

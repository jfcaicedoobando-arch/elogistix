# Contribuir a Libre Carga

Revisado el **2026-09-26**. Leer [arquitectura](ARCHITECTURE.md),
[guías](docs/README.md) y [CI](docs/ops/ci.md).

## Preparación y cambios

Node.js ≥22.12.0; Bun 1.4.0 para paridad con CI.
Instalar con `bun install --frozen-lockfile`. Trabajar en rama/PR de alcance
explícito y conservar cambios ajenos.

No subir contraseñas, service-role keys, `.env.e2e` o documentos fiscales de clientes.
Local/preview puede apuntar a datos remotos: verificar destino antes de mutar.

Ubicar el feature, mantener UI/estado/I/O/dominio separados y usar sus APIs
públicas. Reutilizar [tokens/patrones](docs/design-system.md).
Preservar moneda, impuestos, permisos, estado e idempotencia.
No relajar guards/strict ni añadir dependencies sin necesidad.
Aplicar Power of 10 con extracciones cohesivas, no cosméticas.

## Validación proporcional

```bash
bun run test -- ruta/al/test.test.ts
bun run typecheck
```

Elegir pruebas y lint focales durante implementación. Suite completa CI/RLS
en GitHub Actions; no repetirla tras cada commit en Lovable.
Knip, coverage, benchmarks y E2E son diagnósticos separados.

UI: 1280×720 y 691×763, claro/oscuro, teclado y modales.
Docs: rutas, enlaces, comandos existentes y consistencia con el código.

## Base de datos

Migraciones aplicadas inmutables; corregir con una nueva.
Actualizar espejos, baseline y manifiesto según
[higiene SQL](docs/migrations-hygiene.md),
[baseline](docs/ops/baseline-esquema.md) y
[RLS](supabase/tests/rls/README.md).
No ejecutar suites/seeds contra Live. CI verde no prueba deploy backend.

## PR y checks

El check estable es **`CI Success (aggregator)`**, junto con gitleaks.
RLS, actionlint y Dependency Review se activan por sus rutas; CodeQL es
semanal/manual. Ver YAML para condiciones exactas.

Esto no afirma que existan reglas de protección de rama.
No exigir universalmente un check condicionado por paths: podría no iniciarse.

El PR describe alcance, pruebas, omisiones, pendientes y despliegue requerido.
Un test omitido no es un test aprobado.

## Versión y publicación

La versión del producto está en `src/constants/appVersion.ts`, no `package.json`.
Major/minor/patch depende de compatibilidad y alcance de la release aprobada,
no de cuántos archivos cambiaron. Actualizar versión y changelog del producto
de forma coherente sólo cuando corresponda a esa release.

Docs-only o limpieza histórica no exigen bump ni publicación.
Publicar en Lovable mediante interfaz o integración autorizada; merge no
equivale a deploy. Comprobar después web pública y backend implicado.

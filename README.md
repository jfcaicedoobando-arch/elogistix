# Libre Carga / eLogistix

ERP para agencias de carga: CRM, costeo y rutas, cotizaciones, embarques,
compras, facturación, cobranza, tesorería, comisiones y reportes. Incluye
portales de cliente y agente con acceso por rol y organización.

Aplicación: [librecarga.com](https://librecarga.com/).
La versión del producto procede de `src/constants/appVersion.ts`, no del paquete npm.

## Documentación

El [índice de documentación](docs/README.md) distingue guías, reportes e historial.

- [Arquitectura](ARCHITECTURE.md) y [contribución](CONTRIBUTING.md).
- [Sistema de diseño](docs/design-system.md) y [tablas](docs/tables.md).
- [CI vigente](docs/ops/ci.md).
- [Facturación](docs/flujo-facturacion.md) y [FacturAPI](docs/facturapi-go-live.md).
- [Operaciones/recuperación](docs/operations.md).
- [Historial de cambios](CHANGELOG.md).

## Stack revisado el 2026-09-26

Las restricciones declaradas están en `package.json`; `bun.lock` fija la resolución
instalada. No significa que sean las últimas versiones de cada proveedor.

| Capa | Implementación |
| --- | --- |
| Interfaz | React 19, TypeScript 6 estricto |
| Desarrollo/build | Vite 8, React SWC, Terser |
| Navegación | React Router 8 declarativo (`BrowserRouter`), adaptador nuqs v8 |
| UI | Tailwind CSS 3, Radix/shadcn adaptados, Lucide |
| Formularios | React Hook Form 7, resolvers 5, Zod 4 |
| Datos/tablas | TanStack Query 5, Table 8 y Virtual 3, Supabase |
| Pruebas | Vitest 5, Testing Library, Playwright |
| Backend | PostgreSQL, Supabase Edge Functions / Deno |
| CFDI | SDK FacturAPI 5.1.0 exclusivamente en backend |
| PDF | `@react-pdf/renderer` |

## Desarrollo

Node.js **≥22.22.0** según `engines` y el mínimo de Router 8. CI utiliza Bun **1.4.0**.

```bash
bun install --frozen-lockfile
bun run dev
```

Servidor: `http://localhost:8080`. Configurar variables públicas de Supabase
sin subir secretos. Localhost puede apuntar a datos remotos: no equivale a staging.

| Comando | Uso |
| --- | --- |
| `bun run typecheck` | TypeScript (`tsc -b`) |
| `bun run lint` | ESLint con caché |
| `bun run lint:unused` | Diagnóstico Knip, no gate automático actual |
| `bun run test -- <archivo>` | Regresión Vitest focal |
| `bun run test:watch` | Desarrollo de pruebas |
| `bun run test:perf` | Benchmarks separados |
| `bun run build` | Producción |
| `bun run build:low-mem` | Build sin sourcemaps |
| `bun run audit:report` | Informe generado en `reports/` |

La suite completa de CI/RLS corre en GitHub Actions. Local/Lovable:
comprobaciones proporcionales, no repetir todas las suites tras cada commit.

## Organización

```text
src/
  features/          UI, hooks, services, domain, tipos y queryKeys por dominio
  routes/            declaración de rutas y guards
  features/.../routes/ pantallas de cada dominio
  components/shared/ patrones UI transversales
  components/ui/     primitivas y controles adaptados
  lib/               acceso, query, errores, observabilidad, dominio compartido
  integrations/      cliente Supabase y tipos generados
  pdf/ y generators/ documentos y preparación de datos
supabase/
  functions/         casos de uso e integraciones del servidor
  migrations/        historial SQL aplicado, inmutable
  schema/            espejos SQL revisables y baseline
  tests/             guards y suites DB
docs/                guías y registros históricos identificados
e2e/                 Playwright, incluidos escenarios mutadores
```

## CI y publicación

CI principal: detector, ESLint, comprobaciones, **cinco shards Vitest** y
agregador. No ejecuta coverage en cada PR. RLS se activa por rutas DB;
E2E y smoke post-deploy son manuales. Detalles en [CI](docs/ops/ci.md).

Merge en Git no demuestra que la web esté actualizada. Publicar frontend en
Lovable mediante interfaz o integración autorizada y comprobar la web pública.
Migraciones y funciones requieren verificación de despliegue independiente.

Docs-only no necesita bump de versión, changelog del producto ni publicación.

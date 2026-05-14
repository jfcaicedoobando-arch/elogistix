# Power of 10 — Baseline

_Generado por `scripts/audit-power10.ts` sobre 545 archivos de `src/`._

Las heurísticas son conservadoras (prefieren falsos positivos). Validar manualmente antes de refactorizar. Ver ARCHITECTURE.md §20.

## Resumen

| Regla | Hallazgos |
|---|---:|
| #4 Componentes >200 líneas | 0 |
| #5/#10 `any` explícito | 0 |
| #3 `useEffect` sin cleanup | 1 |
| #2 Queries de lista sin paginar | 68 |

## Regla #4 — Componentes >200 líneas (0)

Componentes y páginas que superan el umbral. Refactor: extraer `use<X>Controller` + subcomponentes.

_Sin hallazgos._

## Regla #5/#10 — `any` explícito (0)

Reemplazar por tipos generados de Supabase, `unknown` + narrowing, o documentar override según §17.b.

_Sin hallazgos._

## Regla #3 — `useEffect` sin cleanup (heurística) (1)

Verificar manualmente: bloques con `.subscribe(`/`setInterval(`/`setTimeout(`/`addEventListener(` que parecen no retornar cleanup. Falsos positivos posibles cuando el cleanup vive en función externa.

| Dominio | Hallazgos |
|---|---:|
| `contexts/AuthContext.tsx` | 1 |

<details><summary>Detalle</summary>

- `src/contexts/AuthContext.tsx:52` — useEffect con suscripción/timer/listener sin cleanup

</details>

## Regla #2 — Queries `.from().select()` sin `.range/.limit/.single` (68)

Aplicable sólo a queries que alimentan listas visibles. Las queries agregadas (KPIs, totales) pueden estar bien sin límite — validar caso por caso.

| Dominio | Hallazgos |
|---|---:|
| `services/embarque` | 12 |
| `services/admin` | 8 |
| `services/cotizacion` | 7 |
| `services/portal` | 7 |
| `services/cliente` | 6 |
| `services/facturas` | 6 |
| `services/proforma` | 6 |
| `services/auditoria` | 3 |
| `services/catalogos` | 3 |
| `services/configuracion` | 3 |
| `services/proveedor` | 2 |
| `hooks/embarque` | 1 |
| `services/cliente-usuarios` | 1 |
| `services/planes` | 1 |
| `services/tracking` | 1 |
| `services/usuario` | 1 |

<details><summary>Detalle</summary>

- `src/hooks/embarque/useJsonCargoTracking.ts:220` — .from().select() sin .range/.limit/.single
- `src/services/admin/members.ts:33` — .from().select() sin .range/.limit/.single
- `src/services/admin/members.ts:38` — .from().select() sin .range/.limit/.single
- `src/services/admin/members.ts:64` — .from().select() sin .range/.limit/.single
- `src/services/admin/organizations.ts:18` — .from().select() sin .range/.limit/.single
- `src/services/admin/organizations.ts:27` — .from().select() sin .range/.limit/.single
- `src/services/admin/stats.ts:29` — .from().select() sin .range/.limit/.single
- `src/services/admin/stats.ts:62` — .from().select() sin .range/.limit/.single
- `src/services/admin/stats.ts:80` — .from().select() sin .range/.limit/.single
- `src/services/auditoria/index.ts:23` — .from().select() sin .range/.limit/.single
- `src/services/auditoria/index.ts:118` — .from().select() sin .range/.limit/.single
- `src/services/auditoria/index.ts:194` — .from().select() sin .range/.limit/.single
- `src/services/catalogos/index.ts:44` — .from().select() sin .range/.limit/.single
- `src/services/catalogos/index.ts:69` — .from().select() sin .range/.limit/.single
- `src/services/catalogos/index.ts:94` — .from().select() sin .range/.limit/.single
- `src/services/cliente/contactos.ts:11` — .from().select() sin .range/.limit/.single
- `src/services/cliente/crud.ts:65` — .from().select() sin .range/.limit/.single
- `src/services/cliente/crud.ts:76` — .from().select() sin .range/.limit/.single
- `src/services/cliente/financials.ts:21` — .from().select() sin .range/.limit/.single
- `src/services/cliente/relacionados.ts:5` — .from().select() sin .range/.limit/.single
- `src/services/cliente/relacionados.ts:17` — .from().select() sin .range/.limit/.single
- `src/services/cliente-usuarios/index.ts:11` — .from().select() sin .range/.limit/.single
- `src/services/configuracion/index.ts:21` — .from().select() sin .range/.limit/.single
- `src/services/configuracion/index.ts:48` — .from().select() sin .range/.limit/.single
- `src/services/configuracion/index.ts:83` — .from().select() sin .range/.limit/.single
- `src/services/cotizacion/conversiones/duplicar.ts:54` — .from().select() sin .range/.limit/.single
- `src/services/cotizacion/conversiones/embarques.ts:20` — .from().select() sin .range/.limit/.single
- `src/services/cotizacion/costos.ts:12` — .from().select() sin .range/.limit/.single
- `src/services/cotizacion/costos.ts:68` — .from().select() sin .range/.limit/.single
- `src/services/cotizacion/queries.ts:37` — .from().select() sin .range/.limit/.single
- `src/services/cotizacion/queries.ts:48` — .from().select() sin .range/.limit/.single
- `src/services/cotizacion/queries.ts:70` — .from().select() sin .range/.limit/.single
- `src/services/embarque/eventos.ts:17` — .from().select() sin .range/.limit/.single
- `src/services/embarque/queries/colaterales.ts:12` — .from().select() sin .range/.limit/.single
- `src/services/embarque/queries/colaterales.ts:21` — .from().select() sin .range/.limit/.single
- `src/services/embarque/queries/colaterales.ts:31` — .from().select() sin .range/.limit/.single
- `src/services/embarque/queries/conceptos.ts:12` — .from().select() sin .range/.limit/.single
- `src/services/embarque/queries/conceptos.ts:23` — .from().select() sin .range/.limit/.single
- `src/services/embarque/queries/expedientes.ts:15` — .from().select() sin .range/.limit/.single
- `src/services/embarque/queries/listado.ts:14` — .from().select() sin .range/.limit/.single
- `src/services/embarque/queries/listado.ts:68` — .from().select() sin .range/.limit/.single
- `src/services/embarque/queries/listado.ts:141` — .from().select() sin .range/.limit/.single
- `src/services/embarque/queries/listado.ts:169` — .from().select() sin .range/.limit/.single
- `src/services/embarque/queries/proveedores.ts:8` — .from().select() sin .range/.limit/.single
- `src/services/facturas/huecoFacturacion.ts:57` — .from().select() sin .range/.limit/.single
- `src/services/facturas/huecoFacturacion.ts:80` — .from().select() sin .range/.limit/.single
- `src/services/facturas/index.ts:25` — .from().select() sin .range/.limit/.single
- `src/services/facturas/index.ts:48` — .from().select() sin .range/.limit/.single
- `src/services/facturas/proyeccion.ts:29` — .from().select() sin .range/.limit/.single
- `src/services/facturas/proyeccion.ts:51` — .from().select() sin .range/.limit/.single
- `src/services/planes/index.ts:21` — .from().select() sin .range/.limit/.single
- `src/services/portal/queries.ts:20` — .from().select() sin .range/.limit/.single
- `src/services/portal/queries.ts:40` — .from().select() sin .range/.limit/.single
- `src/services/portal/queries.ts:50` — .from().select() sin .range/.limit/.single
- `src/services/portal/queries.ts:71` — .from().select() sin .range/.limit/.single
- `src/services/portal/queries.ts:87` — .from().select() sin .range/.limit/.single
- `src/services/portal/queries.ts:114` — .from().select() sin .range/.limit/.single
- `src/services/portal/queries.ts:123` — .from().select() sin .range/.limit/.single
- `src/services/proforma/crud.ts:96` — .from().select() sin .range/.limit/.single
- `src/services/proforma/queries.ts:12` — .from().select() sin .range/.limit/.single
- `src/services/proforma/queries.ts:22` — .from().select() sin .range/.limit/.single
- `src/services/proforma/queries.ts:35` — .from().select() sin .range/.limit/.single
- `src/services/proforma/queries.ts:72` — .from().select() sin .range/.limit/.single
- `src/services/proforma/queries.ts:83` — .from().select() sin .range/.limit/.single
- `src/services/proveedor/index.ts:49` — .from().select() sin .range/.limit/.single
- `src/services/proveedor/index.ts:99` — .from().select() sin .range/.limit/.single
- `src/services/tracking/index.ts:59` — .from().select() sin .range/.limit/.single
- `src/services/usuario/index.ts:29` — .from().select() sin .range/.limit/.single

</details>

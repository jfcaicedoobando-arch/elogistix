# Cierre LCL: no exigir fechas de descarga/devolución de contenedor

## Causa confirmada
En `validar_cierre_embarque` (`supabase/schema/embarques/validar_cierre_embarque.sql`) la regla
`contenedores_fechas_completas` se ejecuta **para cualquier embarque que tenga filas en
`embarque_contenedores`**, sin importar el tipo de carga. En cambio, la regla hermana
`contenedores_datos_completos` sí está condicionada a `modo='Marítimo' AND tipo_carga ILIKE 'FCL%'`.
Los embarques LCL sí generan filas de contenedor (agrupación por BL), así que el checklist de cierre
exige `fecha_descarga` y `fecha_devolucion` aunque en LCL no aplica (no hay contenedor completo que
descargar/devolver).

Analogía: el guardia pide el ticket de devolución del contenedor a todos los camiones, incluso a los
que llegaron en caja compartida.

## Corrección (YAGNI, sin features)

1. **Backend (origen de verdad)** — En `validar_cierre_embarque.sql`, condicionar el bloque
   `contenedores_fechas_completas` al mismo gate que `contenedores_datos_completos`:
   `modo='Marítimo' AND tipo_carga ILIKE 'FCL%'`.
   - Para LCL / Aéreo / Terrestre la regla ya no se evalúa y no aparece en el checklist.
   - Nueva migración + actualización del archivo espejo, `bun run db:postcheck` verde y baseline
     regenerada (convención del proyecto).
2. **UI** — Sin cambios funcionales: el tab Cierre ya pinta sólo las reglas que devuelve el RPC,
   así que al no emitirse la regla en LCL desaparece sola. No se toca `cierreCheckMeta.ts` (queda
   como catálogo para FCL).
3. **Tests** — Actualizar/ajustar los tests que asumen que la regla siempre existe
   (`TabCierre.rules.test.ts`, `cierreCheckOrden.test.ts`, `cierreCheckMeta.test.ts` si aplica) y
   agregar caso: embarque LCL con contenedores sin fechas → checklist sin la regla y cierre no
   bloqueado por esa causa.

## Verificación
- `bun run ci:fast` + `bun run db:postcheck` en verde.
- Prueba manual en preview: embarque LCL → tab Cierre ya no pide fechas de contenedor; embarque FCL
  marítimo sigue pidiéndolas igual que antes.

## Notas
- Versión: bump a la siguiente (13.820.6) + entrada en `CHANGELOG.md`.
- No se tocan datos ni se relaja ninguna otra regla del cierre.

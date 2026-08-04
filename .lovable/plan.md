# Validación de hallazgos R8 (WAVE 1) antes de tocar código

De acuerdo: primero comprobamos cuáles de los 7 hallazgos sistémicos son bugs reales, cuáles ya están resueltos y cuáles fueron ruido del entorno de pruebas. Nada de código de producción se modifica en esta etapa.

Analogía: antes de llamar al plomero, abrimos la llave para ver si de verdad gotea y de dónde.

## Lo que ya se verificó en el código (sin ejecutar la app)

- **FIX 1 (skeleton infinito) — parcialmente resuelto.** Ya existe `AsyncBoundary` con timeout y reintento, pero sólo está aplicado en 6 rutas (Tesorería, Cartera, Configuración, Nuevo Embarque…). `Embarques`, `Facturación` y `Usuarios` no lo usan. El `queryClient` global ya tiene `retry: 2` con backoff, pero no `placeholderData`/keepPreviousData.
- **FIX 3 (⌘K) — confirmado parcial.** `buscarGlobal` sí se traga los errores: ante fallo de la RPC devuelve `[]`, así que un error se ve igual que "sin resultados". La cobertura real de la RPC y el destino de navegación aún hay que medirlos contra datos.

## Cómo validaremos cada hallazgo

Para cada FIX de WAVE 1, tres tipos de evidencia según corresponda:

1. **Recorrido real de la app** con sesión autenticada, midiendo tiempos y capturando pantalla a 1920x1080.
2. **Consulta a la base** para saber si el problema es dato o código (p. ej. cuántos embarques ve realmente la organización activa, si la RPC de búsqueda devuelve las filas esperadas).
3. **Lectura de código** para el veredicto final: bug real, ya arreglado, o falso positivo del entorno.

| FIX | Qué se comprueba | Veredicto esperado del ejercicio |
|---|---|---|
| 1 | Rutas sin manejo de error/timeout; comportamiento al fallar una query | Lista exacta de rutas afectadas |
| 2 | Tiempo real de /embarques, /facturacion y wizard de cotización; nº de queries y filas | Confirmar o descartar los 40–85s |
| 3 | Buscar "ELIMP00005", "Comercial Pacífico", "A-1002", "FP-R7-003", "ELIMP" y revisar a dónde navega cada resultado | Qué entidades faltan en la RPC y qué URLs están mal |
| 4 | Contar embarques por estado en la base vs lo que pinta el pipeline de /inicio; fecha del saludo vs hora local MX | Distinguir filtro por rol/organización de problema de zona horaria |
| 5 | Existencia real de "Registrar cobro" en detalle y fila de CxC | Confirmar el hueco de funcionalidad |
| 6 | Si la UI de Tracking permite crear eventos del enum `tipo_evento_tracking` | Confirmar acción faltante |
| 7 | Abrir /usuarios y /configuracion como admin, medir tiempo y ver si falla por permisos/RLS o por query colgada | Causa concreta, no suposición |

## Entregable

Un reporte de triaje (`docs/auditoria/triage_uiux_r8.md`) con, por cada hallazgo: veredicto (**real / ya resuelto / falso positivo / no reproducible**), evidencia (tiempos, filas, captura, archivo y línea) y la causa raíz confirmada cuando aplique. Con eso arriba, te propongo el plan de arreglos ya priorizado por impacto real, y evitamos gastar esfuerzo en los hallazgos que fueron data corrupta del entorno de pruebas (el propio documento ya descarta 4 por esa razón).

## Notas técnicas

- Los recorridos se hacen con Playwright headless contra el servidor local, viewport 1920x1080, con la sesión de Lovable Cloud ya disponible en el entorno; capturas guardadas fuera del proyecto.
- Las mediciones de tiempo se toman por ruta con red sin throttling y se repiten 2 veces para descartar arranque en frío de Vite.
- Las consultas a la base son de sólo lectura (conteos y agregados); no se insertan ni modifican registros.
- No se cambia ningún archivo de `src/` ni migraciones en esta etapa.

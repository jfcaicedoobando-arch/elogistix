# Plan: refactor `1 embarque ↔ N contenedores` — completado

Refactor entregado en fases A→G a lo largo de v12.3.0–v12.8.0.

## Fases completadas

- **Fase A (v12.3.0)** — Tabla `embarque_contenedores`, columnas `contenedor_id` en conceptos, trigger de sync legacy, migración de datos.
- **Fase B (v12.4.0)** — Tipos `ContenedorBorrador` + Zod, servicios CRUD (`listarPorEmbarque`, `crearMuchos`, `actualizar`, `eliminar` soft-delete, `reemplazarTodos`), hook `useContenedoresEmbarque`.
- **Fase C + D (v12.5.0)** — Componentes `FilaContenedor`, `ListaContenedoresEditable`, `SeccionContenedores`; integración en `TabResumen` del detalle de embarques marítimos.
- **Fase E (v12.6.0)** — Filtro por contenedor en `DialogGenerarProforma` (chips Todos/Generales/N), badges en conceptos, helper `conceptosPorContenedor`, prefijo en notas del PDF.
- **Fase F (v12.7.0)** — RPC `duplicar_embarque_completo` copia contenedores hijos y re-mapea `contenedor_id` en conceptos. Copy de `DialogDuplicarEmbarque` actualizado.
- **Fase G (v12.7.0 + v12.8.0)** — Docs `docs/embarques-contenedores.md`, JSDoc `@deprecated` en campos legacy, integración del wizard con lista dinámica de contenedores en FCL y auto-LCL.

## Fuera de alcance (futuro)

- Remoción real de columnas legacy en `embarques` (`contenedor`, `tipo_contenedor`, `peso_kg`, `volumen_m3`, `piezas`); hoy las mantiene el trigger DB para reportes.
- Hidratación de `contenedores` en el flujo de edición desde URL/expediente (el detail-view ya consume `useContenedoresEmbarque` directamente).
- Reportes financieros agregados por contenedor (requiere nuevo dashboard).

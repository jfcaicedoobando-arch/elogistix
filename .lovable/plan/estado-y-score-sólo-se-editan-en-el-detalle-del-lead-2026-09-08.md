# Estado y score: sólo se editan en el detalle del lead

La tabla de leads pasa a ser sólo de lectura para estado y score. Los cambios reales se hacen dentro del detalle del lead, donde hay contexto e historial. Sin botón de "Marcar contactado".

## Qué cambia para el usuario

- En el listado de Leads, la columna **Estado** deja de ser un menú desplegable: siempre se ve como etiqueta de color, igual que ya se ve para prospectos y convertidos.
- La columna **Score** sigue siendo sólo lectura (hoy ya lo es).
- Para cambiar estado o score se entra al lead: ahí siguen los mismos controles que ya existen (selector de estado y score 1-5, con guardar).
- Filtros, orden, selección y exportación del listado no cambian.
- La barra de acciones masivas (cuando seleccionas varios leads) se conserva tal cual: es una acción deliberada sobre varios registros, no una edición al pasar por una fila.

## Detalles técnicos

- `src/features/crm/routes/leadsColumns.tsx`: eliminar `EstadoCell` y su uso de `useActualizarLead`, `Select` y `LEAD_ESTADOS_ETAPA_LEAD`; la celda de estado renderiza siempre `<StatusBadge domain="lead" status={...} />`. Con esto la firma de permisos ya no necesita `puedeGestionarLead` para esa columna.
- `src/features/crm/routes/Leads.tsx`: ajustar la llamada a `makeLeadsColumns` si el parámetro de permisos queda sin uso (mantener `puedeSeleccionar`).
- `src/features/crm/routes/__tests__/leadsColumns.estado.test.tsx`: reescribir el test para verificar que la celda muestra badge y que no existe `combobox` de estado, con y sin permisos.
- Sin cambios en base de datos, hooks de mutación, RLS ni permisos: `useActualizarLead` se sigue usando desde el detalle.
- Cierre: bump patch a 13.823.227, entrada en `CHANGELOG.md`, typecheck + ESLint focalizado + build. CI, RLS y suites completas quedan para GitHub Actions. Sin publicar.

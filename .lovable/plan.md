

## v8.12.0 — Asociar embarques a expediente existente

### Resumen

Permitir que al crear un nuevo embarque, el usuario elija entre generar un expediente nuevo o asociarse a uno existente del mismo cliente. Esto resuelve el caso de cotizaciones separadas por tipo de contenedor (20'/40') que comparten el mismo BL/booking.

### Plan de acción

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/hooks/useEmbarqueQueries.ts` | Nuevo hook `useExpedientesCliente(clienteId)` — query `SELECT DISTINCT ON (expediente) expediente, bl_master, cliente_nombre, count(*) OVER (PARTITION BY expediente)` filtrado por `cliente_id`, `estado != 'Cerrado'`, y `organization_id` |
| 2 | `src/hooks/useEmbarques.ts` | Re-exportar `useExpedientesCliente` |
| 3 | `src/hooks/useEmbarqueForm.ts` | Agregar campos al form: `modoExpediente: 'nuevo' | 'existente'` y `expedienteExistente: string` (almacena el expediente seleccionado). Valor default `modoExpediente: 'nuevo'`. Ajustar `desvincularCotizacion` para resetear estos campos |
| 4 | `src/components/embarque/StepDatosGenerales.tsx` | Después del selector de cotización y del selector de cliente, agregar: (a) RadioGroup "Crear nuevo expediente" / "Asociar a expediente existente" — solo visible si el cliente tiene expedientes abiertos. (b) Si modo=existente: Combobox con búsqueda listando expedientes con formato "ELIMP00001 \| BL: MAEU123 (2 embarques)". Al seleccionar, setear `blMaster` readonly |
| 5 | `src/pages/NuevoEmbarque.tsx` | En `handleFinish`: si `modoExpediente === 'existente'`, usar el expediente seleccionado directamente en vez de llamar a `resolverExpediente()`. También usar el `blMaster` del expediente existente |
| 6 | `src/data/changelogData.ts` | Entrada v8.12.0 |

### Detalle de UX

- Por defecto: "Crear nuevo expediente" seleccionado
- La opción "Asociar a expediente existente" solo aparece si `useExpedientesCliente` retorna resultados
- Al seleccionar un expediente existente, los campos `expediente` y `bl_master` se autocompletan y quedan `readOnly`
- Al cambiar de cliente, se resetea la selección de expediente
- Badge en cada opción del combobox: "(N embarques)"

### Sin migración SQL

No hay constraint único en `expediente`. La función `crear_embarque_completo` ya acepta cualquier expediente. No se necesitan cambios en la base de datos.

### Diseño visual

```text
┌─ Datos Generales ──────────────────────────────┐
│ ¿Vincular cotización? [combobox]               │
│ Cliente *          [combobox]                   │
│                                                 │
│ ○ Crear nuevo expediente                        │
│ ● Asociar a expediente existente                │
│   ┌──────────────────────────────────────┐      │
│   │ 🔍 Buscar expediente...              │      │
│   │ ELIMP00012 | BL: MAEU456 (1 emb.)   │      │
│   │ ELEXP00009 | BL: COSU789 (2 emb.)   │      │
│   └──────────────────────────────────────┘      │
│                                                 │
│ Modo * [select]     Tipo * [select]             │
│ ...                                             │
└─────────────────────────────────────────────────┘
```


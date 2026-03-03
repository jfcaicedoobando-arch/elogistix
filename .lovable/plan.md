

## Análisis y Recomendación: Operaciones con BL Master y múltiples BL House

### Contexto actual

La tabla `embarques` trata cada embarque como una entidad independiente con campos `bl_master` y `bl_house` de tipo texto simple. No existe concepto de agrupación ni relación padre-hijo entre embarques. Costos, ventas, documentos, facturas y notas se vinculan directamente a un `embarque_id`. Los reportes y la facturación operan a nivel de embarque individual.

---

### Recomendación: Embarques independientes vinculados por referencia de operación

**No recomiendo sub-embarques ni una tabla separada de "operación madre"**. El modelo más pragmático y menos disruptivo es:

1. Agregar dos columnas a la tabla `embarques`:
   - `referencia_operacion` (text) — el identificador compartido (ej: `OP-2026-001`)
   - `embarque_padre_id` (uuid, nullable, FK a `embarques.id`) — apunta al primer embarque creado en la operación (el "madre"), `null` para el embarque madre mismo

2. Cada BL House es un embarque completo e independiente con su propio expediente, cliente, contenedor, documentos, costos y facturación.

3. El BL Master se registra igual en cada embarque hijo (todos comparten el mismo valor de `bl_master`).

```text
embarques
┌──────────────────────────────────────────────────────┐
│ id: uuid (PK)                                        │
│ expediente: text (EXP-2026-XXXX) ← único por BL     │
│ referencia_operacion: text ← compartida (OP-2026-001)│
│ embarque_padre_id: uuid (FK → embarques.id, nullable)│
│ bl_master: text  ← mismo valor en todos los hijos    │
│ bl_house: text   ← único por embarque                │
│ cliente_id, contenedor, costos, etc.                 │
└──────────────────────────────────────────────────────┘

OP-2026-001
├── EXP-2026-0001 (madre)  padre_id=NULL,  BL House ELOX001, Cliente A
├── EXP-2026-0002 (hijo)   padre_id=0001,  BL House ELOX002, Cliente B
└── EXP-2026-0003 (hijo)   padre_id=0001,  BL House ELOX003, Cliente C
```

---

### Por qué esta arquitectura y no otra

| Alternativa | Problema |
|---|---|
| Tabla separada `operaciones` como padre | Requiere reescribir todo el flujo: crear, editar, detalle, facturación, reportes. Duplica lógica. Complejidad alta para beneficio bajo. |
| Sub-embarques dentro de un embarque | Rompe la relación 1:1 entre embarque y factura/costos. Obliga a crear un modelo anidado en toda la app. |
| **Columnas de vínculo en la misma tabla** | Cambio mínimo en BD. Cada embarque sigue funcionando exactamente igual. La agrupación es solo una vista adicional. |

---

### Costos y precios: a nivel de cada BL House

Cada embarque (BL House) tiene su propio cliente, sus propios conceptos de venta y costos. Esto es correcto porque:
- Se factura por BL House (cada cliente recibe su factura)
- Los costos de flete, maniobras, etc. varían por contenedor
- Los costos compartidos de la operación (despacho aduanal, por ejemplo) se pueden prorratear o duplicar según el caso de uso

Si en el futuro necesitan costos a nivel operación madre, se puede agregar una tabla `costos_operacion` sin tocar lo existente.

---

### Impacto en el flujo actual

**Crear embarques**: Se agrega un campo opcional "Referencia de Operación" en el paso 1. Si el usuario escribe una referencia existente, se vincula automáticamente al padre. También se puede ofrecer un botón "Agregar BL House a esta operación" desde el detalle de un embarque existente.

**Lista de embarques**: Se agrega la columna `Ref. Operación` a la tabla. Opcionalmente se pueden agrupar visualmente los embarques que comparten referencia.

**Detalle de embarque**: Se muestra una sección "Operación" con la referencia y links a los embarques hermanos.

**Facturación**: Sin cambios. Cada embarque se factura independientemente como hoy.

**Reportes**: Se puede agregar un filtro/agrupación por referencia de operación para ver la rentabilidad consolidada.

---

### Cambios técnicos necesarios

1. **Migración BD**: Agregar `referencia_operacion` (text, nullable) y `embarque_padre_id` (uuid, nullable, FK) a `embarques`
2. **`StepDatosGenerales`**: Campo opcional "Referencia de Operación" con autocompletado de referencias existentes
3. **`NuevoEmbarque` / `useEmbarqueForm`**: Manejar los nuevos campos en el formulario y payload
4. **`Embarques.tsx`**: Columna de referencia en la tabla, filtro por referencia
5. **`EmbarqueDetalle.tsx`**: Sección que muestra embarques hermanos vinculados
6. **`Reportes.tsx`**: Agrupación opcional por referencia de operación
7. **Changelog**: Nueva entrada de versión

No se requieren cambios en facturación, documentos ni en la estructura de costos.


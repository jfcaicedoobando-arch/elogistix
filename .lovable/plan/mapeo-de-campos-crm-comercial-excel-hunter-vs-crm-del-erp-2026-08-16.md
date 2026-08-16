# Mapeo de campos: CRM comercial (Excel Hunter) vs CRM del ERP

Objetivo: dejar por escrito el mapeo campo por campo y cerrar los huecos reales para que el equipo comercial pueda abandonar el Excel sin perder información.

## Resultado del mapeo (ya verificado contra la base de datos)

### Hoja 02_Clientes -> `crm_leads`
Cubierto: Empresa, Sitio web, Años establecida, Contacto principal, Correo, Teléfono, Sector, Mercancía, Rutas, Frecuencia, Volumen, Incoterm, Aduana/puerto, Dolor explícito, Consecuencia, Proveedor actual, Estatus ICP, Motivo descarte/nutrición, Fecha nutrición, Responsable, Fecha alta.

Falta en el ERP:
- Cargo del contacto principal
- Origen y Destino/entrega (hoy sólo existen en oportunidades)

### Hoja 03_Pipeline -> `crm_oportunidades`
Cubierto: Etapa actual, Fecha ingreso etapa, Último movimiento, Valor, Probabilidad, Fecha estimada de cierre, Servicio, Incoterm, Ruta, Volumen/Frecuencia, Necesidad/dolor, Responsable, Motivo de pérdida, Proveedor actual, Aduana/puerto.
Derivados que la app ya calcula: Días sin movimiento, Monto ponderado, Estado de higiene, Kanban.

Falta en el ERP:
- Margen % estimado de la oportunidad
- Autorización de margen (quién y cuándo autorizó un margen fuera de política)
- Riesgos / objeciones (campo propio, hoy se mezcla en "notas")
- Siguiente actividad y su fecha visibles en la fila de la oportunidad (existen como actividad, pero no se ven en el listado/Kanban)
- SLA de días por etapa como campo explícito de configuración (hoy se reutiliza "días de seguimiento")

### Hoja 04_Actividades -> `crm_actividades`
Cubierto: Fecha, Cliente/Empresa, Oportunidad, Tipo de contacto, Resultado, Contacto efectivo, Reunión calificada, Comentarios, Responsable. Semana de inicio se calcula.
Falta: nada relevante; "Siguiente actividad" se resuelve creando la actividad siguiente.

### Hojas 01_Parametros, 05_Kanban, 06_Higiene, 07_Dashboard, 08_Historial_Etapas
Todas tienen equivalente en el ERP (etapas y probabilidades, presupuesto mensual, metas de actividad, tablero de higiene, historial de etapas). Aquí no falta nada.

### Lo que el ERP tiene de más (ganancia al migrar)
Score de lead, fuente, país/ciudad, criterios de salida por etapa, cuotas por vendedor, valor real de cierre, vínculo a cotización y embarque ganadores, historial automático de etapas, permisos por rol y bitácora.

## Qué se va a implementar

1. Documento de mapeo en `docs/crm-mapeo-excel-erp.md` con la tabla completa hoja por hoja, para que Comercial valide antes de migrar.
2. Campos faltantes en la base de datos:
   - `crm_leads`: `cargo_contacto`, `origen`, `destino`
   - `crm_oportunidades`: `margen_pct`, `margen_autorizado_por`, `margen_autorizado_at`, `riesgos_objeciones`
   - `crm_etapas_pipeline`: `sla_dias`
3. Formularios y detalle: capturar y mostrar estos campos (ficha ICP del lead, formulario y detalle de oportunidad, editor de etapas en Configuración).
4. Listado/Kanban: columna "Siguiente actividad + fecha" tomada de la próxima actividad programada, y semáforo de SLA por etapa usando `sla_dias`.
5. Plantilla de importación alineada al Excel para la carga de la base actual.

## Notas técnicas

- Migración con `ALTER TABLE ... ADD COLUMN` (nullable, sin default costoso); no requiere GRANT nuevos porque las tablas ya existen con sus políticas RLS por organización.
- La autorización de margen se registra sólo por RPC con validación de rol (`gerente_comercial`/`admin_org`), no editable desde el cliente.
- "Siguiente actividad" se resuelve con una vista/agregado sobre `crm_actividades` (mínima `fecha_programada` pendiente) para no denormalizar datos.
- Se respeta el límite de 200 líneas por componente y se agregan pruebas al dominio de higiene/SLA.
- Al cerrar: bump de `APP_VERSION` y entrada en `CHANGELOG.md`.

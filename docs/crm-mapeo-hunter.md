# Mapeo CRM Comercial (Excel "Hunter") → CRM del ERP

Comparativo de columnas del archivo `CRM_Comercial_Hunter_Elogistix_Jul-Dic_2026.xlsx`
contra el esquema del ERP (`crm_leads`, `crm_oportunidades`, `crm_etapas_pipeline`).

## Hoja "Clientes" → `crm_leads`

| Columna Excel | Campo ERP | Estado |
| --- | --- | --- |
| Empresa / RFC / Sector | `empresa`, `rfc`, `sector` | Cubierto |
| Contacto / Correo / Teléfono | `contacto_nombre`, `email`, `telefono` | Cubierto |
| Cargo del contacto | `cargo_contacto` | Agregado v13.627.0 |
| Origen | `origen` | Agregado v13.627.0 |
| Destino / entrega | `destino` | Agregado v13.627.0 |
| Perfil ICP (volumen, modo, incoterm, etc.) | campos ICP de `crm_leads` | Cubierto |

## Hoja "Pipeline" → `crm_oportunidades`

| Columna Excel | Campo ERP | Estado |
| --- | --- | --- |
| Oportunidad / Cliente / Monto / Moneda | `nombre`, `cliente_*`, `monto_estimado`, `moneda` | Cubierto |
| Etapa / Probabilidad / Cierre estimado | `etapa_id`, `probabilidad`, `fecha_estimada_cierre` | Cubierto |
| Monto meta / Fecha meta / Compromiso | `monto_meta`, `fecha_meta_cierre`, `compromiso_nota` | Cubierto |
| Margen % estimado | `margen_pct` | Agregado v13.627.0 |
| Autorización de margen | `margen_autorizado_por`, `margen_autorizado_at` (RPC `crm_autorizar_margen`) | Agregado v13.627.0 |
| Riesgos / objeciones | `riesgos_objeciones` | Agregado v13.627.0 |
| Siguiente actividad | `crm_actividades` (columna en la tabla y tarjeta Kanban) | Cubierto |

## Etapas y disciplina

| Columna Excel | Campo ERP | Estado |
| --- | --- | --- |
| Días máximos por etapa | `crm_etapas_pipeline.sla_dias` | Agregado v13.627.0 |
| Criterios de salida | `crm_etapa_criterios` + `crm_oportunidad_criterios` | Cubierto (ganancia vs Excel) |
| Cuotas y presupuesto | `crm_cuotas_vendedor`, `crm_presupuesto_mensual`, `crm_metas_actividad` | Cubierto (ganancia vs Excel) |
| Trazabilidad de cambios de etapa | `crm_historial_etapas` | Cubierto (automático) |

## Reglas de seguridad

- La autorización de margen sólo la puede ejecutar `super_admin`, `admin_org` o
  `gerente_comercial` de la misma organización: la validación vive en la RPC
  `public.crm_autorizar_margen` (SECURITY DEFINER), no en el frontend.

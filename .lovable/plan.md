# Auditoría y robustecimiento del tab "Actividad y Notas"

## Qué encontré hoy

El tab (`TabNotas.tsx` + `useActividadEmbarque.ts`) sólo mezcla **3 fuentes**:

1. `notas_embarque` (notas manuales)
2. `eventos_embarque` (tracking)
3. `bitacora_actividad` filtrada por `entidad_id = embarque` o `entidad_nombre = expediente`

Problemas detectados:

| # | Severidad | Hallazgo |
|---|---|---|
| 1 | CRÍTICO | **Todo lo financiero es invisible.** La bitácora de facturas, proformas, CxP y pagos se guarda con el `entidad_id` de *esa* entidad (factura/proforma/proveedor), no del embarque, así que nunca entra al feed. Hoy hay 103 "crear factura", 69 borradores, 58 timbrados, 56 cambios de proforma y 46 aprobaciones CxP que no se ven desde el embarque. |
| 2 | CRÍTICO | **Cierres y reaperturas** viven en `cierre_embarque_log` (10 registros) y sólo se ven en el tab Cierre. |
| 3 | ALTO | **Historial de garantías** (`embarque_garantias_historial`, 23 registros) y cambios de seguros no aparecen. |
| 4 | ALTO | **Correos enviados** (`factura_envios`, 29) y **consultas de tracking** (`tracking_intentos`) no aparecen. |
| 5 | ALTO | **Buzón de invoices** (`embarque_facturas_entrantes`, nuevo en 13.347.0) no aparece: no se ve quién subió ni quién capturó. |
| 6 | MEDIO | El hook **ignora el error** de la consulta: si falla la bitácora, el usuario ve "Sin actividad registrada" (mentira silenciosa). |
| 7 | MEDIO | Deduplicación frágil: se comparan **cadenas de fecha recortadas al minuto** para evitar duplicados de "cambio de estado". Dos acciones distintas en el mismo minuto se ocultan entre sí. |
| 8 | MEDIO | Límite fijo de 100 entradas en bitácora, sin aviso de truncado. |
| 9 | BAJO | El feed no distingue visualmente categorías; todo es una lista plana sin agrupar por día. |

## Qué voy a construir

### 1. Un solo RPC que reúne todo

Nueva función `public.actividad_embarque(p_embarque_id uuid)` que hace `UNION ALL` de todas las fuentes ligadas al embarque y devuelve un feed ordenado por fecha. Fuentes:

```text
Operación   notas_embarque · eventos_embarque · documentos_embarque
            bitacora (entidad_id = embarque) · tracking_intentos
Comercial   cotización origen (embarques.cotizacion_id) + su bitácora
Finanzas    proformas (embarque_id) · facturas (vía factura_embarques)
            pagos y notas de crédito de esas facturas · factura_envios
            proveedor_facturas (embarque_id) + pagos a proveedor
            embarque_facturas_entrantes (subida / captura / rechazo)
Riesgo      embarque_garantias_historial · seguros_embarque
Cierre      cierre_embarque_log (cerrar / reabrir con motivo)
```

- Se ejecuta con los permisos del usuario (`SECURITY INVOKER`), así que **el aislamiento multi-tenant y las RLS existentes siguen aplicando** sin abrir puertas nuevas.
- Filtra `deleted_at` en las tablas con borrado suave.
- **Montos ocultos**: cada fila financiera pasa por `can_view_financials()`; si el rol no tiene permiso se devuelve el evento ("Factura F1010 timbrada") con el importe en `null`, y la UI muestra "—".
- La deduplicación de "cambio de estado" se hace por clave real (id de origen + estado destino), no por minuto recortado.

### 2. Rediseño del tab

- Carga completa del historial de una sola vez (según tu preferencia), con contador total en el encabezado.
- Agrupado por día ("Hoy", "Ayer", "28/07/2026") con línea de tiempo vertical, consistente con el detalle de proforma.
- Cada entrada: ícono y color por categoría (Operación, Comercial, Finanzas, Riesgo, Cierre), acción, usuario, hora, y detalle expandible con los cambios campo-a-campo cuando existan.
- Enlaces profundos: una entrada de factura lleva al detalle de esa factura; una de documento al tab Documentos; una de cierre al tab Cierre.
- Estado de error real ("No se pudo cargar la actividad" + Reintentar) en vez del falso "Sin actividad".
- La caja para escribir notas se queda arriba, sin cambios de permisos.

### 3. Pruebas

- Unitarias del mapeo y agrupación por día, del enmascarado de montos y de la deduplicación de cambios de estado.
- Prueba de RLS que confirme que un usuario de otra organización no obtiene filas del RPC.
- Prueba de componente: error de carga muestra el aviso, no el vacío.

## Detalles técnicos

- Migración: crea `public.actividad_embarque(uuid)` (`STABLE`, `SECURITY INVOKER`, `SET search_path = public`) con `GRANT EXECUTE` sólo a `authenticated`; se agregan índices faltantes en `factura_envios(factura_id)` y `embarque_garantias_historial(garantia_id)` si no existen.
- Frontend: `useActividadEmbarque.ts` pasa a consumir el RPC (adiós a la mezcla en cliente); `TabNotas.tsx` se divide en `TabNotas.tsx` (contenedor + caja de nota), `ActividadTimeline.tsx` y `ActividadItem.tsx` para respetar el límite de 200 líneas por archivo.
- Se regeneran los tipos de Supabase y se registran `CHANGELOG.md` + `APP_VERSION` = `13.348.0`.

## Fuera de alcance

No se modifica cómo se escribe la bitácora en otros módulos: el RPC lee lo que ya existe. Si más adelante quieres que cada acción de factura también quede sellada con el embarque, eso sería un cambio aparte en los servicios de escritura.

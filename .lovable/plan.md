## Diagnóstico real (confirmado en BD)

La factura sigue en `pendiente` aunque el toast verde aparezca porque la RPC `public.aprobar_factura_proveedor`:

1. Ejecuta correctamente el `UPDATE proveedor_facturas SET estado_aprobacion='aprobada' ...`
2. Luego intenta insertar en `public.bitacora_actividad` usando columnas que **no existen** en esa tabla:
   - RPC escribe: `user_id, accion, entidad, entidad_id, descripcion, metadata`
   - Columnas reales: `usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles` (y `usuario_email`/`modulo` son `NOT NULL`)
3. El INSERT lanza `undefined_column`. La RPC tiene `EXCEPTION WHEN undefined_table OR undefined_column THEN RETURN v_row` al final. En plpgsql, cualquier bloque con `EXCEPTION` está envuelto en una **subtransacción implícita**: al capturar la excepción, **se hace rollback de toda la subtransacción** — incluido el UPDATE.
4. La función retorna `v_row` (la fila vieja, ya cargada en memoria antes del UPDATE) **sin error**, así que el cliente cree que aprobó y muestra toast verde.

Analogía: la RPC mete el cambio en un cajón, pero al cerrar el cajón se atora una bisagra (la bitácora) y el cajón rebota abierto — pero le dice al usuario "listo, guardado".

## Solución (1 migración)

Reescribir `public.aprobar_factura_proveedor` para que el INSERT en `bitacora_actividad` use los **nombres reales** de columnas:

```sql
INSERT INTO public.bitacora_actividad
  (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
VALUES (
  v_row.organization_id,
  v_uid,
  COALESCE((SELECT email FROM auth.users WHERE id = v_uid), ''),
  CASE WHEN p_aprobar THEN 'aprobar_factura_proveedor' ELSE 'rechazar_factura_proveedor' END,
  'cxp',
  v_row.id,
  'Factura ' || v_row.folio_proveedor || ' de ' || v_row.proveedor_nombre,
  jsonb_build_object('motivo', p_motivo, 'total', v_row.total)
);
```

Además, **eliminar el handler peligroso** `EXCEPTION WHEN undefined_table OR undefined_column THEN RETURN v_row`: silenciar undefined_column es exactamente lo que escondió este bug. Si la bitácora alguna vez se quita o cambia, queremos un error claro, no un éxito falso. Como compromiso, envolver SOLO la bitácora en su propio bloque `BEGIN ... EXCEPTION WHEN OTHERS THEN RAISE WARNING ...; END;` para que un fallo de bitácora nunca derribe la aprobación, pero quede registrado en logs.

### Versionado
- `APP_VERSION` → `13.103.4`
- Entrada en `CHANGELOG.md`: "fix(cxp): `aprobar_factura_proveedor` ya persiste el cambio — la bitácora usaba columnas inexistentes y el handler `WHEN undefined_column` deshacía el UPDATE silenciosamente."

### Fuera de alcance
- Frontend: no cambia (ya invalida queries correctamente; el problema era 100% BD).
- Toast: el verde era correcto desde la perspectiva del cliente; ahora también lo será desde la BD.

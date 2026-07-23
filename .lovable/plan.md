## Problema

En el detalle de cotización, cuando la cotización está en **Borrador**, la UI muestra el botón **"Aceptar"** (junto con "Marcar como Enviada" y "Rechazar"). Al hacer clic en Aceptar, el trigger `guard_estado_cotizacion` de la base de datos rechaza la transición con:

```
LC_COT_TRANSICION_INVALIDA: no se puede pasar de Borrador a Aceptada
```

Hay un desajuste entre la UI y la máquina de estados del backend:

- UI (`CotizacionDetalleSecciones.tsx`): permite Aceptar desde **Borrador o Enviada**.
- DB (`guard_estado_cotizacion`): sólo permite Enviada → Aceptada.

## Analogía

Es como si en la caja del súper te dejaran pasar con el carrito, pero al llegar el guardia te dijera que primero debiste sacar un boleto en otra ventanilla que ni siquiera está señalizada. Lo lógico es que quien deja pasar (la UI) y quien valida (la DB) hablen el mismo idioma.

## Decisión

Alinear la DB con la UI: **permitir Borrador → Aceptada**. Es un flujo real: a veces la cotización se acepta verbalmente o por chat sin pasar por el envío formal por correo. Ya existe precedente porque el guard permite Borrador → Rechazada (misma lógica de "saltarse" Enviada).

## Cambios

### 1. Migración SQL

Actualizar `guard_estado_cotizacion` para agregar `Borrador → Aceptada` a las transiciones válidas:

```sql
IF (v_old = 'Borrador'      AND v_new IN ('Enviada','Aceptada','Rechazada'))
OR (v_old = 'Enviada'       AND v_new IN ('Aceptada','Rechazada'))
OR (v_old = 'Aceptada'      AND v_new IN ('En operación'))
```

Actualizar también el archivo canónico en `supabase/schema/` si existe la función ahí (item 3.1 de la refactorización).

### 2. Snapshot de versión al aceptar desde Borrador

Revisar `snapshot_cotizacion_al_enviar`: hoy congela la cotización al pasar a Enviada. Si se acepta directo desde Borrador, hay que asegurar que también se genere el snapshot/versión (misma lógica) para no perder trazabilidad. Se ajusta el trigger para disparar snapshot también en Borrador → Aceptada.

### 3. Sin cambios de UI

El botón "Aceptar" ya se muestra correctamente desde Borrador. No se toca.

### 4. Versionado y changelog

- `APP_VERSION` → `13.308.10` (o el siguiente disponible).
- Entrada en `CHANGELOG.md` describiendo el fix.

## Verificación

1. Migración aplicada limpia contra el linter.
2. Probar en la cotización `e64a91fb-...` (la del reporte) que el botón Aceptar la mueve a Aceptada y crea la versión snapshot.
3. Confirmar que las transiciones inválidas (p.ej. Aceptada → Borrador) siguen bloqueadas.

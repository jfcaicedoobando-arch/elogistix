# Reestructurar Paso 1 del wizard de cotización (marítimo)

## Razonamiento (perspectiva comercial)

Una persona de ventas sin conocimiento de costeo sólo sabe: a quién le vende, qué embarca, de dónde a dónde y cuántos contenedores. Lo demás (ruta intermedia del barco, días de tránsito, frecuencia, validez real, seguro recomendado por el agente) lo dicta la **tarifa**. Por eso el orden conversacional debe llevar a la persona a un único momento de decisión: **elegir tarifa**.

## Nuevo orden propuesto (sólo modo Marítimo)

```text
1. Cliente              (a quién le cotizo)
2. Operación            (importación/exportación, incoterm, modo, tipo)
3. Ruta                 (sólo origen + destino + tipo de movimiento CY/DR)
4. Mercancía            (FCL/LCL, contenedor, peso, descripción, MSDS)
5. Tarifa               (← momento de decisión: ya tengo todo para buscarla)
6. Condiciones comerciales  (validez + seguro, heredadas/ajustables tras tarifa)
7. Cierre               (nº embarques, notas)
```

Aéreo / Terrestre / General conservan su flujo actual (sin tarifa vinculada).

## Cambios concretos

### 1. `SeccionRutaCotizacion.tsx`
En modo marítimo, dejar visible **sólo**:
- Origen + Destino (PortSelect)
- Tipo de movimiento (CY-CY, CY-DR, …)

Ocultar para marítimo (mover o eliminar de esta sección):
- Campo **"Ruta"** (`rutaTexto`): se autollenará desde la tarifa o queda editable en el panel post-tarifa como dato heredado.
- **Validez de la propuesta**: se muestra en la nueva sección "Condiciones comerciales".
- **Seguro** (`SeguroBlock`): igual, se mueve a "Condiciones comerciales".

Para modos no marítimos, **no cambia nada** (siguen como hoy).

### 2. Nueva sección "Condiciones comerciales" (sólo marítimo)
Crear `SeccionCondicionesComerciales.tsx` que se renderiza **después** de `TarifaVinculadaPanel`. Contiene:
- **Ruta del barco** (`rutaTexto`): read-only con badge "Heredado de tarifa" cuando hay tarifa; editable manual con permiso `canOverrideTarifaPricing` (ya existe). Sin tarifa → input deshabilitado con hint "Selecciona una tarifa primero".
- **Validez de la propuesta**: calendario con `disabled` hasta `tarifa.vigente_hasta` (lógica ya existe en `SeccionRutaCotizacion`, se traslada). Sin tarifa → deshabilitado con hint.
- **Seguro** (`SeguroBlock`): se reutiliza tal cual. Sin tarifa → deshabilitado con hint.

La autocarga de `rutaTexto` desde la tarifa se agrega en `aplicarTarifa.ts`: si la tarifa trae texto de ruta (campo `notas` o nuevo `ruta_texto` si lo decidimos) lo escribe vía `setValue("rutaTexto", …, OPTS)`. **Sin migración nueva**: en esta iteración usamos `"{origen} → {destino}"` por defecto si la tarifa no trae texto explícito (placeholder editable).

### 3. `PasoDatosGenerales.tsx`
Reordenar bloques para marítimo:
```text
Cliente → Operación → Ruta → Mercancía → Tarifa → Condiciones comerciales → Cierre
```
Para no-marítimo: sin cambios (Mercancía sigue al final como hoy ya que la Ruta conserva validez/seguro).

### 4. `Paso1ProgressSidebar.tsx`
Actualizar la lista de secciones para marítimo añadiendo el paso "Condiciones":
```text
Cliente · Operación · Ruta · Mercancía · Tarifa · Condiciones · Cierre
```

### 5. `usePaso1SectionStatus.ts`
Añadir `condiciones: boolean` (true cuando `validezPropuesta` y `seguro` tienen valor) y reusar el ya existente para mercancía. La sección "Ruta" en marítimo ahora se marca completa con sólo origen/destino/tipo de movimiento.

### 6. Validación / Zod
- `rutaTexto`, `validezPropuesta`, `seguro` siguen siendo obligatorios para avanzar.
- Añadir guardia: en marítimo, no se puede pasar a Paso 2 sin tarifa vinculada (regla ya existente vía `status.tarifa`).

### 7. Versionado y changelog
- Bump `APP_VERSION` → `13.47.2`.
- Entrada en `CHANGELOG.md`: "Reordenar Paso 1 marítimo: Mercancía antes de Tarifa; Validez/Seguro/Ruta-texto se capturan después de tarifa".
- Actualizar memoria `mem://features/wizard-cotizacion-flujo` con el nuevo orden.

## Fuera de alcance
- Cambios de esquema en `costeo_tarifas` (no se agrega `ruta_texto` en esta iteración; se autollena con `origen → destino`).
- Aéreo, terrestre, multimodal y general (mantienen el flujo actual).
- Persistencia de overrides nuevos: `rutaTexto` no entra al objeto `tarifa_override` en esta iteración (es texto libre comercial, no dato operativo de costeo).

## Preguntas abiertas (responde si quieres ajustar antes de implementar)
1. ¿El campo "Ruta" debe quedar visible como heredado/editable después de la tarifa, o lo eliminamos por completo de la UI de ventas y se autopobla en segundo plano para el PDF?
2. ¿"Seguro" en post-tarifa debe traer un default sugerido por la tarifa/agente, o seguir 100% manual del comercial?

## Wizard "Conectar FacturApi" (3 pasos)

Reemplazo de la captura todo-en-uno por un asistente guiado, montado sobre `FormDialogShell` + `FormDialogStepper` (los componentes estándar de modales tipo formulario del proyecto). Se integra al `FacturapiCredencialesCard` existente: si la org aún no tiene `last4` cargado, la tarjeta muestra un botón **"Conectar FacturApi"** que abre el wizard; si ya está conectada, se muestra como hoy con un botón **"Reconfigurar"** que también lo abre.

### Pasos

1. **Ambiente** — el usuario elige Sandbox o Producción (default Sandbox). Explicación breve de qué significa cada uno y recomendación de empezar siempre por Sandbox. Único campo: switch + texto de ayuda.
2. **API keys** — inputs tipo password para Sandbox (`sk_test_…`) y Live (`sk_live_…`). Cada uno con badge de estado (Vacía / Cargada · `••••1234`) y botón **Guardar** que persiste vía RPC `set_facturapi_api_key` (cifrado en vault). Botón **Quitar** para borrar (`clear_facturapi_api_key`). Al menos la key del ambiente activo debe estar cargada para avanzar.
3. **Probar y confirmar** — botón **Probar conexión** que invoca la edge function `facturapi-test-conexion` con el ambiente activo. Muestra estado en vivo: idle → "Probando…" (spinner) → éxito (badge verde + nombre legal devuelto por FacturApi + `facturapi_org_id` autocompletado) o error (alerta roja con `status` y `detail` traducidos). Sólo permite **Finalizar** cuando la prueba haya sido exitosa al menos una vez.

### Progreso y mensajes

- Header con stepper visible (1 Ambiente · 2 API keys · 3 Probar). Cada paso ya completo se marca con check; el paso actual resaltado.
- Footer sticky con **Atrás** / **Siguiente** (deshabilitado si el paso no cumple su requisito) y **Finalizar** en el último paso.
- Mensajes claros en español MX para cada error de FacturApi (key inválida → "FacturApi rechazó la API key (401). Verifica que la copiaste completa y que corresponde al ambiente seleccionado."; org no encontrada → "No se encontró la organización en FacturApi."; red → "No se pudo contactar a FacturApi. Reintenta en unos segundos.").
- Toast de éxito al finalizar: "FacturApi conectado en ambiente Sandbox/Producción".

### Archivos

- **Nuevo** `src/features/configuracion/components/FacturapiOnboardingWizard.tsx` — orquesta los 3 pasos, mantiene estado local (`paso`, `pruebaResultado`), invoca hooks ya existentes (`useSetFacturapiApiKey`, `useClearFacturapiApiKey`, `useProbarFacturapiConexion`, `useUpsertFacturapiCredenciales`) y al finalizar persiste el ambiente elegido vía upsert.
- **Nuevo** `src/features/configuracion/components/wizard/PasoAmbiente.tsx`, `PasoApiKeys.tsx`, `PasoProbar.tsx` — componentes presentacionales de cada paso (cumple regla ≤200 líneas por archivo).
- **Editado** `FacturapiCredencialesCard.tsx` — añade botón "Conectar FacturApi" / "Reconfigurar" que abre el wizard. La vista detallada (form actual) queda como modo avanzado plegable para usuarios que ya conocen la integración.
- **Editado** `CHANGELOG.md` + bump `APP_VERSION` a `13.137.19`.

### Detalles técnicos

- El wizard reusa toda la lógica de servicios ya implementada en `setFacturapiApiKey`, `clearFacturapiApiKey`, `probarFacturapiConexion` y la edge `facturapi-test-conexion` — no se toca backend ni migraciones.
- Validación por paso:
  - Paso 1: siempre válido (default sandbox).
  - Paso 2: válido si `last4` del ambiente activo está presente tras guardar (lo lee de `useFacturapiCredenciales`).
  - Paso 3: válido si `pruebaResultado?.ok === true` para el ambiente activo.
- Si el usuario cambia el ambiente en el paso 1 después de probar, se invalida `pruebaResultado` para forzar reprobar.
- El wizard usa `FormDialogShell` con icon-tile `<Receipt/>`, secciones por paso vía `FormDialogSection` y footer sticky con los botones — alineado a la regla del proyecto sobre modales tipo formulario.
- Sin cambios a tests existentes; agregar smoke test del componente raíz (`FacturapiOnboardingWizard.test.tsx`) que monte cada paso y verifique que **Siguiente** está deshabilitado hasta cumplir su requisito (usa mocks de los hooks).

```text
┌──────────────────────────────────────────┐
│  Conectar FacturApi                  [x] │
│  ──①──── ──②──── ──③──                   │
│  Ambiente  API keys  Probar              │
├──────────────────────────────────────────┤
│  (contenido del paso actual)             │
│                                          │
├──────────────────────────────────────────┤
│  [Atrás]              [Siguiente / OK]   │
└──────────────────────────────────────────┘
```

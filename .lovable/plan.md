# Auditoría del CRM: idioma y el botón "Nuevo" que no hace nada

## 1) Idioma — resultado

Revisé todos los textos visibles del módulo (`src/features/crm/**` y `src/routes/crmRoutes.tsx`): botones, etiquetas, placeholders, encabezados de tabla, estados vacíos, avisos y mensajes de error. **Todo está en español mexicano.** Único detalle de consistencia: en varias pantallas la etiqueta del correo dice "Email" (ficha de lead, formulario de nuevo lead, vista previa de importación CSV, plantillas de mensaje, acciones de contacto) mientras el resto del ERP usa "Correo". No es un error, pero conviene homologarlo.

## 2) Bug confirmado: el menú "Nuevo" no abre nada

Reproducido en la app corriendo, sobre `/crm`:

- Clic en **Nuevo** → el menú abre bien.
- Clic en **Nuevo lead** (o "Nueva oportunidad" / "Nueva actividad") → el menú se cierra y **no aparece ningún formulario**. Cero elementos flotantes en pantalla, sin error en consola.
- Con el atajo de teclado **L** (con el menú cerrado) el mismo formulario **sí** aparece.

Causa: el formulario express vive en un panel flotante (Popover) anclado al mismo botón que abre el menú desplegable. Al elegir una opción, el cierre del menú y la apertura del panel ocurren en el mismo gesto del mouse; el propio cierre del menú (clic afuera + devolución del foco) cancela el panel recién abierto. El atajo de teclado funciona porque ahí el menú ya está cerrado. El código ya trae dos intentos previos de parche para esta misma carrera (comentarios `B-004` y `REG B-004` en `QuickAddMenu.tsx`), lo que confirma que el patrón panel-dentro-de-menú es frágil.

Analogía: es como una puerta de resorte: al salir del menú, la puerta se cierra de golpe y tumba la ventanilla de captura que apenas se estaba abriendo.

## Qué propongo hacer

1. **Dejar de anidar el panel flotante en el menú.** Las tres altas express (lead, oportunidad, actividad) pasan a abrirse como modal centrado (el mismo `FormDialogShell` que usa el resto del ERP), con exactamente los mismos campos y el mismo enlace "Más campos →". Los modales sí soportan abrirse desde un ítem de menú sin condiciones de carrera.
2. **Conservar los atajos** N / L / O / A con el mismo comportamiento.
3. **Barrer los demás CTA de creación del CRM** en el navegador (Leads, Oportunidades, Kanban por etapa, Actividades, Importar leads CSV, "Más campos →") para confirmar que todos abren su formulario; corregir los que fallen.
4. **Homologar "Email" → "Correo"** en las pantallas del CRM listadas arriba.
5. **Prueba de regresión** que simule elegir "Nuevo lead" desde el menú y verifique que el formulario queda montado, para que este bug no regrese por tercera vez.

## Detalle técnico

- `src/features/crm/components/QuickAddMenu.tsx`: se elimina el `Popover`/`PopoverAnchor` que envuelve al `DropdownMenu` y el truco de `requestAnimationFrame`; `quick` pasa a controlar un `Dialog` con `FormDialogShell` + `FormDialogSection`. Los tres `QuickCreate*Popover` se conservan como cuerpo del modal (se renombran a `QuickCreate*Form` sin `PopoverContent` propio) para no reescribir su lógica de guardado.
- Se respeta el límite de 200 líneas por componente extrayendo el switch de contenido a un `quickCreate/QuickCreateDialog.tsx`.
- Verificación con Playwright sobre `localhost:8080/crm`: recorrer los CTA y confirmar `[role=dialog]` presente y sin errores de consola.
- Prueba unitaria nueva en `src/features/crm/components/__tests__/` con Testing Library: abrir menú, `userEvent.click` en "Nuevo lead", esperar el diálogo.
- Cierre: entrada en `CHANGELOG.md` y bump de `APP_VERSION`.

## Nota

El error `Incorrect locale information provided` que vi durante la prueba proviene del navegador de pruebas sin idioma configurado (`en-US@posix`), no de la app; con `es-MX` desaparece. No requiere cambio.

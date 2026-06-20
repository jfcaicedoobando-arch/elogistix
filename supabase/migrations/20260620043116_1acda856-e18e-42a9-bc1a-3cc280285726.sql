
INSERT INTO public.bitacora_actividad (usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles, organization_id)
VALUES (
  'f7d122d2-0926-48c0-99ed-092b587d9b3c',
  'hector@lopezbenavides.com',
  'eliminar_usuario_prueba',
  'auditoria',
  'd664d815-f1af-4d1c-ab42-04de012b0ade',
  'prueba+1781927127@librecarga-test.dev',
  jsonb_build_object(
    'motivo', 'Cuenta generada por prueba E2E de Playwright, nunca confirmada ni utilizada',
    'organizacion_eliminada', 'Agencia Prueba SA',
    'organization_id', 'bd77c2c9-b42a-48b7-8211-4741f7e32adc',
    'email_confirmed', false,
    'last_sign_in_at', null,
    'eliminado_por', 'hector@lopezbenavides.com',
    'eliminado_en', now()
  ),
  NULL
);

DELETE FROM public.organization_members WHERE user_id = 'd664d815-f1af-4d1c-ab42-04de012b0ade';
DELETE FROM public.organizations WHERE id = 'bd77c2c9-b42a-48b7-8211-4741f7e32adc';
DELETE FROM public.user_roles WHERE user_id = 'd664d815-f1af-4d1c-ab42-04de012b0ade';
DELETE FROM auth.users WHERE id = 'd664d815-f1af-4d1c-ab42-04de012b0ade';

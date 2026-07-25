REVOKE EXECUTE ON FUNCTION public.assert_pago_sin_rep_vivo_delete() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calc_pago_retenciones() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calcular_comision_pago() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calcular_comision_pago(p_pago_factura_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(p_org uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tg_facturas_link_proforma() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tg_liberar_folio_proveedor_factura() FROM PUBLIC, anon;
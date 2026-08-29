REVOKE ALL ON FUNCTION public._assert_nc_prov_no_excede_saldo() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._assert_nc_prov_no_excede_saldo() TO service_role;
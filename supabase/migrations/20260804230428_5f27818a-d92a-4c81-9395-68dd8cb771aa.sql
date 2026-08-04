REVOKE ALL ON FUNCTION public._embarques_sembrar_tc_dof() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._embarques_sembrar_tc_dof() FROM anon;
GRANT EXECUTE ON FUNCTION public._embarques_sembrar_tc_dof() TO authenticated, service_role;
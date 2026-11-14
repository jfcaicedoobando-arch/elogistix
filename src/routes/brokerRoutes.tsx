/**
 * Rutas del Portal de Brokers (vendedores externos).
 */
import { lazy } from "react";
import { Route } from "react-router";
import { BrokerProtectedRoute } from "@/features/auth/components/BrokerProtectedRoute";

const BrokerLayout = lazy(() => import("@/features/portal-broker/components/BrokerLayout"));
const BrokerInicio = lazy(() => import("@/features/portal-broker/routes/BrokerInicio"));
const BrokerConsultar = lazy(() => import("@/features/portal-broker/routes/BrokerConsultar"));

export const brokerRoutes = (
  <Route
    element={
      <BrokerProtectedRoute>
        <BrokerLayout />
      </BrokerProtectedRoute>
    }
  >
    <Route path="/broker" element={<BrokerInicio />} />
    <Route path="/broker/consultar" element={<BrokerConsultar />} />
  </Route>
);

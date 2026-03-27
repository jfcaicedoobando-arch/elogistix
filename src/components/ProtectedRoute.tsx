import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Super admin accessing regular app routes → redirect to /admin
  const isSuperAdmin = (role as string) === "super_admin";
  if (isSuperAdmin && !location.pathname.startsWith("/admin")) {
    return <Navigate to="/admin" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role as string)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

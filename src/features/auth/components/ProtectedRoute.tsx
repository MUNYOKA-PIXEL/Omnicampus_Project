// @ts-nocheck
import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/context/AuthContext";
import type { AppRole } from "@/types/roles";
import { getRoleDashboardPath } from "@/types/roles";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-primary text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role) && role !== "superadmin") {
    return <Navigate to={getRoleDashboardPath(role)} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

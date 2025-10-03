import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function RoleGate({children}:{children:JSX.Element}) {
  const { loading, role } = useAuth();
  if (loading) return <div className="p-6">Chargement...</div>;
  const isManager = role === "pdd_admin" || role === "pdd_respo";
  if (!isManager) return <Navigate to="/" replace />;
  return children;
}

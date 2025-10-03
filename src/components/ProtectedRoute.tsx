
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute({children}:{children:JSX.Element}) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6">Chargement...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

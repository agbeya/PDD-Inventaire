// src/components/ProtectedRoute.tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

type Props = {
  children: React.ReactNode;
  allowInactive?: boolean;
};

export default function ProtectedRoute({ children, allowInactive = false }: Props) {
  // ⬇️ récupère aussi `active`
  const { user, loading, profile, active } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-600">
          <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 2a10 10 0 1 0 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Chargement…
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // ✅ utilise l'état `active` du contexte (et non profile.active)
  if (!allowInactive && !active) {
    const fullName =
      (profile?.firstName || profile?.lastName)
        ? `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim()
        : (profile?.displayName || profile?.email || "Utilisateur");

    async function doLogout() {
      await signOut(auth);
      window.location.href = "/login";
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="max-w-md w-full bg-white border rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div className="font-semibold">Compte en attente d’activation</div>
              <div className="text-sm text-gray-600">Bonjour {fullName}, votre compte n’a pas encore été activé par un responsable.</div>
            </div>
          </div>
          <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
            <li>Un responsable doit valider votre accès.</li>
            <li>Vous serez informé(e) dès que l’activation sera effectuée.</li>
          </ul>
          <div className="pt-2 flex items-center justify-end">
            <button
              onClick={doLogout}
              className="inline-flex items-center gap-2 border px-3 py-2 rounded hover:bg-gray-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M16 17l5-5-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

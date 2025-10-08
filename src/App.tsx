import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import IdleLogoutProvider from "./components/IdleLogoutProvider";
import RoleGate from "./components/RoleGate";

import Login from "./pages/auth/Login";
import Dashboard from "./pages/Dashboard";
import Setup from "./pages/setup/Setup";
import CreateActivity from "./pages/activities/CreateActivity";
import InventoryEditor from "./pages/activities/InventoryEditor";
import UsersAdmin from "./pages/admin/Users";

import { useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        {/* Déconnexion auto après 15min d'inactivité avec préavis 60s */}
        <IdleLogoutProvider idleMaxMs={15*60*1000} warningMs={60*1000}>
          <MainLayout />
        </IdleLogoutProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}

function MainLayout() {
  const location = useLocation();
  const { role, profile } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);

  const isLoginPage = location.pathname === "/login";

  async function doSignOut() {
    await signOut(auth);
    window.location.href = "/login";
  }

  // Nom complet prioritaire (Prénom Nom), sinon displayName, sinon email
  const fullName =
    (profile?.firstName || profile?.lastName)
      ? `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim()
      : null;
  const identity = fullName || profile?.displayName || profile?.email || "";

  useEffect(() => {
    // Simule le chargement lors du changement de page
    setLoading(true);
    const timeout = setTimeout(() => setLoading(false), 400); // à adapter selon ton vrai loading
    return () => clearTimeout(timeout);
  }, [location.pathname]);

  // Ajout : auto-collapse selon la largeur de la fenêtre
  useEffect(() => {
    function handleResize() {
      // Rétracte si largeur < 900px, sinon déplie (sauf si manuel)
      setCollapsed(window.innerWidth < 900);
    }
    window.addEventListener("resize", handleResize);
    handleResize(); // initial
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Option manuelle : priorité à l'utilisateur
  function handleToggle() {
    setCollapsed(prev => !prev);
  }

  return (
    <div className="flex h-screen">
      {!isLoginPage && (
        <SideMenu
          role={role}
          collapsed={collapsed}
          onToggle={handleToggle}
          onSignOut={doSignOut}
          identity={identity}
          photoURL={profile?.photoURL ?? null}
        />
      )}

      <div className="flex-1 overflow-y-auto bg-gray-50">
        {loading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-10 pointer-events-none">
            <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-blue-600 border-solid"></div>
          </div>
        )}

        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/setup" element={<ProtectedRoute><RoleGate><Setup /></RoleGate></ProtectedRoute>} />
          <Route path="/activities/new" element={<ProtectedRoute><RoleGate><CreateActivity /></RoleGate></ProtectedRoute>} />
          <Route path="/activities/:activityId/inventory" element={<ProtectedRoute><InventoryEditor /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute><RoleGate><UsersAdmin /></RoleGate></ProtectedRoute>} />
          <Route path="*" element={<div className="p-4">Page 404 — <Link to="/" className="no-underline hover:no-underline">Retour à l'accueil</Link></div>} />
        </Routes>
      </div>
    </div>
  );
}

function SideMenu({
  role,
  collapsed,
  onToggle,
  onSignOut,
  identity,
  photoURL,
}: {
  role: string | null;
  collapsed: boolean;
  onToggle: () => void;
  onSignOut: () => void;
  identity: string;
  photoURL: string | null;
}) {
  const isManager = role === "pdd_admin" || role === "pdd_respo";
  const isAdmin = role === "pdd_admin";

  const initial = (identity || "?").trim().charAt(0).toUpperCase();

  // Libellé lisible du rôle
  const roleLabel =
    role === "pdd_admin" ? "Admin" :
    role === "pdd_respo" ? "Responsable" :
    role === "pdd_member" ? "Membre" : "—";

  return (
    <aside
      className={`bg-white border-r h-screen flex flex-col transition-all duration-300 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Header avec logo + titre + toggle */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          {/* Logo (même que sur Login) */}
          <div className="h-9 w-9 rounded-xl bg-gray-900 text-white flex items-center justify-center shadow">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3.3 7L12 12l8.7-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 22V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          {!collapsed && <h1 className="text-lg font-bold">PDD Inventaire</h1>}
        </div>

        <button
          onClick={onToggle}
          className="p-1 rounded hover:bg-gray-200"
          title={collapsed ? "Déplier" : "Réduire"}
          aria-label={collapsed ? "Déplier le menu" : "Réduire le menu"}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-2">
        <NavItem to="/" collapsed={collapsed} label="Accueil" icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2v-9z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        } />

        {isManager && (
          <NavItem to="/setup" collapsed={collapsed} label="Paramétrage" icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" strokeWidth="2"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1.82l.03.08a2 2 0 1 1-3.4 0l.03-.08A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1-.6 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1.82-.33l-.08.03a2 2 0 1 1 0-3.4l.08.03A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0 .6-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.64 2.3l.06.06A1.65 1.65 0 0 0 9 4.6c.28 0 .55-.1.78-.28.25-.2.45-.46.6-.75l.03-.08a2 2 0 1 1 3.4 0l.03.08c.15.3.35.55.6.75.23.18.5.28.78.28a1.65 1.65 0 0 0 1.3-.64l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06c-.4.4-.6.93-.6 1.48 0 .28.1.55.28.78.2.25.46.45.75.6l.08.03a2 2 0 1 1 0 3.4l-.08.03c-.3.15-.55.35-.75.6-.18.23-.28.5-.28.78Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            </svg>
          } />
        )}

        {isManager && (
          <NavItem to="/activities/new" collapsed={collapsed} label="Nouvelle activité" icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          } />
        )}

        {isAdmin && (
          <NavItem to="/admin/users" collapsed={collapsed} label="Utilisateurs" icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          } />
        )}
      </nav>

      {/* Footer utilisateur + Déconnexion */}
      <div className="border-t p-2">
        {/* Bloc identité */}
        {!collapsed ? (
          <div className="px-2 pb-2 flex items-center gap-3">
            {/* Avatar */}
            {photoURL ? (
              <img
                src={photoURL}
                alt={identity}
                className="h-9 w-9 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-semibold">
                {initial}
              </div>
            )}
            <div className="min-w-0">
              {/* Identité : UNIQUEMENT le nom complet ou l’email à défaut */}
              <div className="text-sm italic truncate">{identity}</div>
              {/* Badge rôle */}
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] mt-0.5
                               bg-gray-100 text-gray-700 border border-gray-200">
                {roleLabel}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center pb-2">
            {photoURL ? (
              <img
                src={photoURL}
                alt={identity}
                className="h-7 w-7 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="h-7 w-7 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-sm font-semibold">
                {initial}
              </div>
            )}
          </div>
        )}

        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-100"
          title="Se déconnecter"
          aria-label="Se déconnecter"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M16 17l5-5-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          {!collapsed && <span className="no-underline hover:no-underline">Se déconnecter</span>}
        </button>

        {!collapsed && <span className="block text-xs text-gray-500 mt-2 px-2">© Parole de Dieu</span>}
      </div>
    </aside>
  );
}

function NavItem({
  to,
  icon,
  label,
  collapsed,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-100 no-underline hover:no-underline"
      title={label}
      aria-label={label}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/auth/Login";
import Dashboard from "./pages/Dashboard";
import Setup from "./pages/setup/Setup";
import CreateActivity from "./pages/activities/CreateActivity";
import InventoryEditor from "./pages/activities/InventoryEditor";
import UsersAdmin from "./pages/admin/Users";
import RoleGate from "./components/RoleGate";
import { useAuth } from "./contexts/AuthContext";
import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <MainLayout />
      </BrowserRouter>
    </AuthProvider>
  );
}

function MainLayout() {
  const location = useLocation();
  const { role } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const isLoginPage = location.pathname === "/login";

  // (Option) auto-réduire le menu lorsqu'on change de page sur petit écran
  useEffect(() => {
    if (window.innerWidth < 1024) setCollapsed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  async function doSignOut() {
    await signOut(auth);
    window.location.href = "/login";
  }

  return (
    <div className="flex h-screen">
      {/* Menu latéral (caché sur /login) */}
      {!isLoginPage && (
        <SideMenu
          role={role}
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          onSignOut={doSignOut}
        />
      )}

      {/* Contenu principal */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/setup" element={<ProtectedRoute><RoleGate><Setup /></RoleGate></ProtectedRoute>} />
          <Route path="/activities/new" element={<ProtectedRoute><RoleGate><CreateActivity /></RoleGate></ProtectedRoute>} />
          <Route path="/activities/:activityId/inventory" element={<ProtectedRoute><InventoryEditor /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute><RoleGate><UsersAdmin /></RoleGate></ProtectedRoute>} />
          <Route path="*" element={<div className="p-4">Page 404 — <Link to="/">Retour à l'accueil</Link></div>} />
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
}: {
  role: string | null;
  collapsed: boolean;
  onToggle: () => void;
  onSignOut: () => void;
}) {
  const { user } = useAuth();
  const isManager = role === "pdd_admin" || role === "pdd_respo";
  const isAdmin = role === "pdd_admin";

  // Données d’affichage user
  const displayName = user?.displayName || "";
  const email = user?.email || "";
  const avatar = user?.photoURL || "";

  return (
    <aside
      className={`bg-white border-r h-screen flex flex-col transition-all duration-300 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Header + bouton toggle */}
      <div className="flex items-center justify-between p-4 border-b">
        {!collapsed && <h1 className="text-lg font-bold truncate">PDD Inventaire</h1>}
        <button
          onClick={onToggle}
          className="p-1 rounded hover:bg-gray-200"
          title={collapsed ? "Déplier" : "Réduire"}
          aria-label={collapsed ? "Déplier le menu" : "Réduire le menu"}
        >
          {/* Icône menu (burger) */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-2 space-y-1">
        <NavItem to="/" collapsed={collapsed} label="Accueil" icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2v-9z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        } />

        {isManager && (
          <NavItem to="/setup" collapsed={collapsed} label="Paramétrage" icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" strokeWidth="2"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1.82l.03.08a2 2 0 1 1-3.4 0l.03-.08A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1-.6 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1.82-.33l-.08.03a2 2 0 1 1 0-3.4l.08.03A1.65 1.65 0 0 0 4.6 9c.28 0 .55-.1.78-.28.25-.2.45-.46.6-.75l.03-.08a2 2 0 1 1 3.4 0l.03.08c.15.3.35.55.6.75.23.18.5.28.78.28a1.65 1.65 0 0 0 1.3-.64l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06c-.4.4-.6.93-.6 1.48 0 .28.1.55.28.78.2.25.46.45.75.6l.08.03a2 2 0 1 1 0 3.4l-.08.03c-.3.15-.55.35-.75.6-.18.23-.28.5-.28.78Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
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

      {/* Bloc utilisateur + Déconnexion */}
      <div className="border-t p-3 text-sm text-gray-700">
        {/* Profil */}
        {!collapsed && (
          <div className="flex items-center gap-3 mb-2">
            {avatar ? (
              <img
                src={avatar}
                alt="Avatar"
                className="w-8 h-8 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600">
                { (displayName || email || "?").slice(0,1).toUpperCase() }
              </div>
            )}
            <div className="min-w-0">
              <div className="font-semibold truncate">{displayName || email || "Utilisateur"}</div>
              <div className="text-xs text-gray-500 truncate">
                {role ? role.replace("pdd_", "").toUpperCase() : ""}
              </div>
            </div>
          </div>
        )}

        {/* Déconnexion (icône toujours visible, texte masqué si collapsed) */}
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-2 py-2 rounded hover:bg-gray-100"
          title="Se déconnecter"
          aria-label="Se déconnecter"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M16 17l5-5-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          {!collapsed && <span>Se déconnecter</span>}
        </button>

        {!collapsed && (
          <span className="block text-xs text-gray-400 mt-2">© Parole de Dieu</span>
        )}
      </div>
    </aside>
  );
}

/** Item de menu avec icône + label
 * - Affiche seulement l’icône si `collapsed`
 * - Ajoute un title pour l’accessibilité/tooltip
 */
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
      className="flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-100"
      title={label}
      aria-label={label}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

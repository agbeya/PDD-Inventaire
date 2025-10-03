import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/auth/Login";
import Dashboard from "./pages/Dashboard";
import Setup from "./pages/setup/Setup";
import CreateActivity from "./pages/activities/CreateActivity";
import InventoryEditor from "./pages/activities/InventoryEditor";
import { useAuth } from "./contexts/AuthContext";
import RoleGate from "./components/RoleGate";
import UsersAdmin from "./pages/admin/Users";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="flex h-screen">
          {/* Menu latéral */}
          <SideMenu />
          {/* Contenu principal */}
          <div className="flex-1 overflow-y-auto bg-gray-50">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/setup"
                element={
                  <ProtectedRoute>
                    <RoleGate>
                      <Setup />
                    </RoleGate>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/activities/new"
                element={
                  <ProtectedRoute>
                    <RoleGate>
                      <CreateActivity />
                    </RoleGate>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/activities/:activityId/inventory"
                element={
                  <ProtectedRoute>
                    <InventoryEditor />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute>
                    <RoleGate>
                      <UsersAdmin />
                    </RoleGate>
                  </ProtectedRoute>
                }
              />
              <Route
                path="*"
                element={
                  <div className="p-4">
                    Page 404 — <Link to="/">Retour à l'accueil</Link>
                  </div>
                }
              />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

function SideMenu() {
  const { role } = useAuth();
  const isManager = role === "pdd_admin" || role === "pdd_respo";
  const isAdmin = role === "pdd_admin";

  return (
    <aside className="w-60 bg-white border-r h-screen p-4 flex flex-col">
      <h1 className="text-lg font-bold mb-6">PDD Inventaire</h1>
      <nav className="flex-1 space-y-2">
        <Link to="/" className="block px-3 py-2 rounded hover:bg-gray-100">
          Accueil
        </Link>
        {isManager && (
          <Link
            to="/setup"
            className="block px-3 py-2 rounded hover:bg-gray-100"
          >
            Paramétrage
          </Link>
        )}
        {isManager && (
          <Link
            to="/activities/new"
            className="block px-3 py-2 rounded hover:bg-gray-100"
          >
            Nouvelle activité
          </Link>
        )}
        {isAdmin && (
          <Link
            to="/admin/users"
            className="block px-3 py-2 rounded hover:bg-gray-100"
          >
            Utilisateurs
          </Link>
        )}
      </nav>
      <div className="border-t pt-3">
        <span className="text-xs text-gray-500">© Parole de Dieu</span>
      </div>
    </aside>
  );
}

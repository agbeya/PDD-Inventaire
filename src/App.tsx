
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/auth/Login";
import Dashboard from "./pages/Dashboard";
import Setup from "./pages/setup/Setup";
import CreateActivity from "./pages/activities/CreateActivity";
import InventoryEditor from "./pages/activities/InventoryEditor";

export default function App(){
  return (
    <AuthProvider>
      <BrowserRouter>
        <nav className="p-3 border-b bg-white flex gap-3">
          <Link to="/">Accueil</Link>
          <Link to="/setup">Paramétrage</Link>
          <Link to="/activities/new">Nouvelle activité</Link>
        </nav>
        <Routes>
          <Route path="/login" element={<Login/>}/>
          <Route path="/" element={<ProtectedRoute><Dashboard/></ProtectedRoute>}/>
          <Route path="/setup" element={<ProtectedRoute><Setup/></ProtectedRoute>}/>
          <Route path="/activities/new" element={<ProtectedRoute><CreateActivity/></ProtectedRoute>}/>
          <Route path="/activities/:activityId/inventory" element={<ProtectedRoute><InventoryEditor/></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

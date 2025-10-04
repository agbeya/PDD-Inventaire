import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import { Navigate } from "react-router-dom";

type Role = "pdd_admin" | "pdd_respo" | "pdd_member";
type U = { id: string; email: string; role: Role };

export default function UsersAdmin() {
  const { role, loading } = useAuth();
  const [users, setUsers] = useState<U[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  // UI: filtre & recherche
  const [filterRole, setFilterRole] = useState<Role | "">("");
  const [search, setSearch] = useState("");

  // UI: édition inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftRole, setDraftRole] = useState<Role>("pdd_member");

  if (!loading && role !== "pdd_admin") {
    // Seul pdd_admin peut modifier les rôles
    return <Navigate to="/" replace />;
  }

  // Chargement live
  useEffect(() => {
    const qUsers = query(collection(db, "users"), orderBy("email"), limit(500));
    const unsub = onSnapshot(qUsers, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        email: (d.data() as any).email || "",
        role: ((d.data() as any).role || "pdd_member") as Role,
      }));
      setUsers(list);
    });
    return () => unsub();
  }, []);

  // Filtrage client
  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (filterRole && u.role !== filterRole) return false;
      if (search.trim()) {
        const needle = search.trim().toLowerCase();
        if (!u.email.toLowerCase().includes(needle)) return false;
      }
      return true;
    });
  }, [users, filterRole, search]);

  // Utils rôle
  const roleLabel: Record<Role, string> = {
    pdd_member: "Membre",
    pdd_respo: "Responsable",
    pdd_admin: "Admin",
  };
  const roleClass: Record<Role, string> = {
    pdd_member: "bg-gray-100 text-gray-700",
    pdd_respo: "bg-amber-100 text-amber-700",
    pdd_admin: "bg-blue-100 text-blue-700",
  };

  // Icônes
  const IconEdit = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
  const IconTrash = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
  const IconCheck = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
  const IconClose = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );

  // Actions
  async function changeRole(uid: string, newRole: Role) {
    setSavingId(uid);
    await updateDoc(doc(db, "users", uid), { role: newRole });
    setUsers((prev) => prev.map((u) => (u.id === uid ? { ...u, role: newRole } : u)));
    setSavingId(null);
  }

  function startEdit(u: U) {
    setEditingId(u.id);
    setDraftRole(u.role);
  }
  function cancelEdit() {
    setEditingId(null);
  }
  async function saveEdit(u: U) {
    await changeRole(u.id, draftRole);
    setEditingId(null);
    alert("Rôle mis à jour. L'utilisateur devra se reconnecter si besoin.");
  }

  async function removeUserDoc(u: U) {
    // ⚠️ Ceci supprime SEULEMENT le document Firestore `users/{uid}`.
    // Cela ne supprime pas le compte Auth. (Pour supprimer le compte, il faut le faire côté Admin SDK / console.)
    if (!confirm(`Supprimer la fiche utilisateur Firestore pour "${u.email}" ?\n(Le compte Auth ne sera pas supprimé)`)) return;
    setSavingId(u.id);
    await deleteDoc(doc(db, "users", u.id));
    setSavingId(null);
  }

  // Avatar simple (initiale)
  function Avatar({ email }: { email: string }) {
    const letter = (email || "?").charAt(0).toUpperCase();
    return (
      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold">
        {letter}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Administration — Utilisateurs</h1>
        <div className="text-sm text-gray-500">
          {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
        </div>
      </div>

      {/* Barre d’outils (filtres) */}
      <div className="border rounded-xl bg-white p-3">
        <div className="grid md:grid-cols-3 gap-3">
          <input
            className="border p-2 rounded"
            placeholder="Rechercher par email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="border p-2 rounded"
            value={filterRole}
            onChange={(e) => setFilterRole((e.target.value || "") as Role | "")}
          >
            <option value="">Tous les rôles</option>
            <option value="pdd_member">Membre</option>
            <option value="pdd_respo">Responsable</option>
            <option value="pdd_admin">Admin</option>
          </select>
          <button
            className="border px-3 py-2 rounded hover:bg-gray-50"
            onClick={() => {
              setSearch("");
              setFilterRole("");
            }}
          >
            Réinitialiser
          </button>
        </div>
      </div>

      {/* Liste */}
      <div className="border rounded-xl bg-white">
        <div className="grid grid-cols-12 font-semibold px-4 py-2 border-b text-sm">
          <div className="col-span-5">Utilisateur</div>
          <div className="col-span-3">Rôle</div>
          <div className="col-span-4 text-right">Actions</div>
        </div>

        {filtered.map((u) => {
          const isEditing = editingId === u.id;
          return (
            <div key={u.id} className="grid grid-cols-12 items-center px-4 py-3 border-b hover:bg-gray-50">
              {/* Utilisateur */}
              <div className="col-span-5 flex items-center gap-3">
                <Avatar email={u.email} />
                <div>
                  <div className="font-medium">{u.email || <span className="text-gray-400">—</span>}</div>
                  <div className="text-xs text-gray-500">uid: <code>{u.id}</code></div>
                </div>
              </div>

              {/* Rôle */}
              <div className="col-span-3">
                {!isEditing ? (
                  <span className={`inline-block px-2 py-1 rounded text-xs ${roleClass[u.role]}`}>
                    {roleLabel[u.role]}
                  </span>
                ) : (
                  <select
                    className="border p-2 rounded w-full text-sm"
                    value={draftRole}
                    onChange={(e) => setDraftRole(e.target.value as Role)}
                  >
                    <option value="pdd_member">Membre</option>
                    <option value="pdd_respo">Responsable</option>
                    <option value="pdd_admin">Admin</option>
                  </select>
                )}
              </div>

              {/* Actions */}
              <div className="col-span-4">
                {!isEditing ? (
                  <div className="flex justify-end items-center gap-2 text-gray-600">
                    {/* Modifier (passe en mode édition) */}
                    <button
                      className="p-2 rounded hover:bg-gray-200"
                      title="Modifier le rôle"
                      aria-label="Modifier le rôle"
                      onClick={() => startEdit(u)}
                    >
                      <IconEdit />
                    </button>

                    {/* Raccourcis de rôle */}
                    <button
                      disabled={savingId === u.id}
                      className="text-xs border px-2 py-1 rounded hover:bg-gray-100"
                      onClick={() => changeRole(u.id, "pdd_member")}
                    >
                      Membre
                    </button>
                    <button
                      disabled={savingId === u.id}
                      className="text-xs border px-2 py-1 rounded hover:bg-gray-100"
                      onClick={() => changeRole(u.id, "pdd_respo")}
                    >
                      Responsable
                    </button>
                    <button
                      disabled={savingId === u.id}
                      className="text-xs border px-2 py-1 rounded hover:bg-gray-100"
                      onClick={() => changeRole(u.id, "pdd_admin")}
                    >
                      Admin
                    </button>

                    {/* Supprimer (doc Firestore) */}
                    <button
                      className="p-2 rounded hover:bg-red-50 hover:text-red-600"
                      title="Supprimer la fiche Firestore"
                      aria-label="Supprimer la fiche Firestore"
                      onClick={() => removeUserDoc(u)}
                    >
                      <IconTrash />
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-end items-center gap-2">
                    <button
                      disabled={savingId === u.id}
                      className="inline-flex items-center gap-1 bg-blue-600 text-white px-3 py-1 rounded text-sm"
                      onClick={() => saveEdit(u)}
                    >
                      <IconCheck /> Enregistrer
                    </button>
                    <button
                      className="inline-flex items-center gap-1 border px-3 py-1 rounded text-sm"
                      onClick={cancelEdit}
                    >
                      <IconClose /> Annuler
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="p-6 text-center text-gray-500">Aucun utilisateur trouvé.</div>
        )}
      </div>

      <div className="text-xs text-gray-500">
        Remarque : la suppression ici retire uniquement le document <code>users/{`{uid}`}</code> dans Firestore.
        Pour supprimer le compte d’authentification, fais-le via la console Firebase ou une Cloud Function Admin.
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  limit,
} from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import { Navigate } from "react-router-dom";

type Role = "pdd_admin" | "pdd_respo" | "pdd_member";

type U = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  role: Role;
  active: boolean;
};

export default function UsersAdmin() {
  const { role, loading } = useAuth();
  const [users, setUsers] = useState<U[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  // UI: filtre & recherche
  const [filterRole, setFilterRole] = useState<Role | "">("");
  const [filterActive, setFilterActive] = useState<"" | "active" | "pending">("");
  const [search, setSearch] = useState("");

  // UI: édition inline (un seul à la fois)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftRole, setDraftRole] = useState<Role>("pdd_member");

  if (!loading && role !== "pdd_admin") {
    return <Navigate to="/" replace />;
  }

  // Chargement live
  useEffect(() => {
    const qUsers = query(collection(db, "users"), orderBy("email"), limit(1000));
    const unsub = onSnapshot(qUsers, (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          email: data.email || "",
          firstName: data.firstName ?? null,
          lastName: data.lastName ?? null,
          displayName: data.displayName ?? null,
          photoURL: data.photoURL ?? null,
          role: (data.role || "pdd_member") as Role,
          active: !!data.active,
        } as U;
      });
      setUsers(list);
    });
    return () => unsub();
  }, []);

  // Filtrage client
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return users.filter((u) => {
      if (filterRole && u.role !== filterRole) return false;
      if (filterActive === "active" && !u.active) return false;
      if (filterActive === "pending" && u.active) return false;

      if (needle) {
        const fn = (u.firstName || "").toLowerCase();
        const ln = (u.lastName || "").toLowerCase();
        const em = (u.email || "").toLowerCase();
        if (!fn.includes(needle) && !ln.includes(needle) && !em.includes(needle)) return false;
      }
      return true;
    });
  }, [users, filterRole, filterActive, search]);

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
    alert("Rôle mis à jour.");
  }

  async function toggleActive(u: U) {
    setSavingId(u.id);
    await updateDoc(doc(db, "users", u.id), { active: !u.active });
    setSavingId(null);
  }

  // Avatar (photo ou initiale)
  function Avatar({ user }: { user: U }) {
    const label =
      (user.firstName || user.lastName)
        ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
        : (user.displayName || user.email || "");
    const initial = (label || "?").trim().charAt(0).toUpperCase();

    if (user.photoURL) {
      return (
        <img
          src={user.photoURL}
          alt={label}
          className="w-8 h-8 rounded-full object-cover"
          referrerPolicy="no-referrer"
        />
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold">
        {initial}
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

      {/* Barre d’outils */}
      <div className="border rounded-xl bg-white p-3">
        <div className="grid md:grid-cols-4 gap-3">
          <input
            className="border p-2 rounded"
            placeholder="Rechercher (nom, prénom, email)…"
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
          <select
            className="border p-2 rounded"
            value={filterActive}
            onChange={(e) => setFilterActive((e.target.value || "") as "" | "active" | "pending")}
          >
            <option value="">Tous les statuts</option>
            <option value="active">Activés</option>
            <option value="pending">En attente</option>
          </select>
          <button
            className="border px-3 py-2 rounded hover:bg-gray-50"
            onClick={() => {
              setSearch("");
              setFilterRole("");
              setFilterActive("");
            }}
          >
            Réinitialiser
          </button>
        </div>
      </div>

      {/* Liste */}
      <div className="border rounded-xl bg-white">
        <div className="grid grid-cols-12 font-semibold px-4 py-2 border-b text-sm">
          <div className="col-span-4">Utilisateur</div>
          <div className="col-span-3">Email</div>
          <div className="col-span-2">Rôle</div>
          <div className="col-span-1">Statut</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {filtered.map((u) => {
          const isEditing = editingId === u.id;
          const fullName =
            (u.firstName || u.lastName)
              ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()
              : (u.displayName || "");
          return (
            <div key={u.id} className="grid grid-cols-12 items-center px-4 py-3 border-b hover:bg-gray-50">
              {/* Utilisateur */}
              <div className="col-span-4 flex items-center gap-3 min-w-0">
                <Avatar user={u} />
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {fullName || <span className="text-gray-400">—</span>}
                  </div>
                  <div className="text-[11px] text-gray-500 truncate"><code>{u.id}</code></div>
                </div>
              </div>

              {/* Email */}
              <div className="col-span-3 truncate">
                {u.email || <span className="text-gray-400">—</span>}
              </div>

              {/* Rôle */}
              <div className="col-span-2">
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

              {/* Statut */}
              <div className="col-span-1">
                <span className={`text-xs px-2 py-1 rounded ${u.active ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                  {u.active ? "Activé" : "En attente"}
                </span>
              </div>

              {/* Actions */}
              <div className="col-span-2">
                {!isEditing ? (
                  <div className="flex justify-end items-center gap-2">
                    <button
                      className="p-2 rounded hover:bg-gray-200"
                      title="Modifier le rôle"
                      onClick={() => startEdit(u)}
                    >
                      <IconEdit />
                    </button>
                    <button
                      disabled={savingId === u.id}
                      className={`text-xs px-2 py-1 rounded border ${u.active ? "hover:bg-gray-50" : "bg-blue-600 text-white border-blue-600 hover:opacity-90"}`}
                      onClick={() => toggleActive(u)}
                      title={u.active ? "Désactiver l'utilisateur" : "Activer l'utilisateur"}
                    >
                      {u.active ? "Désactiver" : "Activer"}
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
        Remarque : l’activation/désactivation agit uniquement sur le document <code>users/{`{uid}`}</code>.
        L’accès aux pages est bloqué via <em>ProtectedRoute</em> tant que <code>active=false</code>.
      </div>
    </div>
  );
}

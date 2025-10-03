import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc, query, orderBy, limit } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import { Navigate } from "react-router-dom";

type U = { id:string; email:string; role:"pdd_admin"|"pdd_respo"|"pdd_member" };

export default function UsersAdmin(){
  const { role, loading } = useAuth();
  const [users,setUsers] = useState<U[]>([]);
  const [saving,setSaving] = useState<string|null>(null);

  if (!loading && role !== "pdd_admin") {
    // Seul pdd_admin peut modifier les rôles
    return <Navigate to="/" replace />;
  }

  useEffect(()=>{
    (async()=>{
      const q = query(collection(db,"users"), orderBy("email"), limit(200));
      const snap = await getDocs(q);
      setUsers(snap.docs.map(d=>({ id:d.id, email:(d.data() as any).email || "", role:(d.data() as any).role || "pdd_member" })));
    })();
  },[]);

  async function changeRole(uid:string, newRole:U["role"]){
    setSaving(uid);
    await updateDoc(doc(db,"users",uid), { role: newRole });
    setUsers(prev=>prev.map(u=>u.id===uid?{...u, role:newRole}:u));
    setSaving(null);
    alert("Rôle mis à jour. L'utilisateur devra se reconnecter si besoin.");
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Administration — Utilisateurs</h1>
      <div className="border rounded bg-white">
        <div className="grid grid-cols-3 font-semibold px-3 py-2 border-b">
          <div>Email</div><div>Rôle</div><div>Actions</div>
        </div>
        {users.map(u=>(
          <div key={u.id} className="grid grid-cols-3 items-center px-3 py-2 border-b">
            <div>{u.email}</div>
            <div className="text-sm">{u.role}</div>
            <div className="flex gap-2">
              <button disabled={saving===u.id} onClick={()=>changeRole(u.id,"pdd_member")} className="px-2 py-1 border rounded">Membre</button>
              <button disabled={saving===u.id} onClick={()=>changeRole(u.id,"pdd_respo")} className="px-2 py-1 border rounded">Responsable</button>
              <button disabled={saving===u.id} onClick={()=>changeRole(u.id,"pdd_admin")} className="px-2 py-1 border rounded">Admin</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import type { Activity } from "../types";
import { Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import { useAuth } from "../contexts/AuthContext";

export default function Dashboard() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const { role } = useAuth();
  const isManager = role === "pdd_admin" || role === "pdd_respo";

  useEffect(() => {
    (async () => {
      const q = query(
        collection(db, "activities"),
        orderBy("startDate", "desc"),
        limit(10)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setActivities(list as Activity[]);
      setLoading(false);
    })();
  }, []);

  async function doSignOut() {
    await signOut(auth);
    window.location.href = "/login";
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Activités récentes</h1>
        <div className="flex gap-2">
          {isManager && <Link
            to="/activities/new"
            className="bg-blue-600 text-white px-3 py-2 rounded"
          >
            + Nouvelle activité
          </Link>}
          <button
            onClick={doSignOut}
            className="border px-3 py-2 rounded"
            title="Se déconnecter"
          >
            Se déconnecter
          </button>
        </div>
      </div>

      {loading && <div>Chargement…</div>}
      {!loading && activities.length === 0 && (
        <div className="text-gray-600">Aucune activité pour le moment.</div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activities.map((a) => {
          const start =
            (a as any).startDate?.toDate?.().toLocaleDateString("fr-FR") ?? "";
          const end =
            (a as any).endDate?.toDate?.().toLocaleDateString("fr-FR") ?? "";
          return (
            <div key={a.id} className="border rounded-xl p-4 space-y-2 bg-white">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{a.label}</h2>
                <span title={a.isComplete ? "Complet" : "Incomplet"}>
                  {a.isComplete ? "🟢" : "🟠"}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                {start} → {end}
              </div>
              <div className="text-sm">
                Retours : {a.itemsReturned ?? 0}/{a.itemsTotal ?? 0}
              </div>
              <div className="pt-2">
                <Link
                  to={`/activities/${a.id}/inventory`}
                  className="text-sm bg-gray-900 text-white px-3 py-2 rounded"
                >
                  Ouvrir l’inventaire
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

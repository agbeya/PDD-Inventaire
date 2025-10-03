import { useEffect, useMemo, useState } from "react";
import {
  addDoc, collection, serverTimestamp, getDocs, query, where,
  orderBy, limit, onSnapshot, doc, updateDoc, deleteDoc
} from "firebase/firestore";
import { db } from "../../firebase";
import { Link, useNavigate } from "react-router-dom";

type Year = { id:string; label:string };
type Zone = { id:string; name:string; yearId:string };
type Subzone = { id:string; name:string; zoneId:string };

type ActivityRow = {
  id: string;
  label: string;
  startDate: any;
  endDate: any;
  yearId: string;
  zoneId: string;
  subzoneId: string;
  isComplete?: boolean;
  itemsTotal?: number;
  itemsReturned?: number;
};

export default function CreateActivity(){
  // Form
  const [years,setYears]=useState<Year[]>([]);
  const [zones,setZones]=useState<Zone[]>([]);
  const [subzones,setSubzones]=useState<Subzone[]>([]);
  const [form,setForm]=useState({
    yearId:"", zoneId:"", subzoneId:"",
    label:"", startDate:"", endDate:""
  });

  // Liste
  const [activities,setActivities] = useState<ActivityRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [editing, setEditing] = useState<Record<string, {
    label: string;
    startDate: string; // yyyy-mm-dd
    endDate: string;   // yyyy-mm-dd
  }>>({});

  const nav = useNavigate();

  // Utils
  function tsToInput(d:any): string {
    try {
      const date: Date =
        d?.toDate?.() instanceof Date ? d.toDate() :
        d instanceof Date ? d :
        new Date(d);
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth()+1).padStart(2,"0");
      const dd = String(date.getDate()).padStart(2,"0");
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return "";
    }
  }

  // Chargement des référentiels
  useEffect(()=>{ (async()=>{
    const ys = await getDocs(collection(db,"years"));
    setYears(ys.docs.map(d=>({id:d.id, ...(d.data() as any)})));
  })(); },[]);

  useEffect(()=>{ if(!form.yearId) return;
    (async()=>{
      const qz = query(collection(db,"zones"), where("yearId","==",form.yearId));
      const zs = await getDocs(qz);
      setZones(zs.docs.map(d=>({id:d.id, ...(d.data() as any)})));
      setSubzones([]); setForm(f=>({...f, zoneId:"", subzoneId:""}));
    })();
  },[form.yearId]);

  useEffect(()=>{ if(!form.zoneId) return;
    (async()=>{
      const qsz = query(collection(db,"subzones"), where("zoneId","==",form.zoneId));
      const szz = await getDocs(qsz);
      setSubzones(szz.docs.map(d=>({id:d.id, ...(d.data() as any)})));
      setForm(f=>({...f, subzoneId:""}));
    })();
  },[form.zoneId]);

  // Liste activités (live)
  useEffect(()=> {
    const qAct = query(collection(db, "activities"), orderBy("startDate","desc"), limit(20));
    const unsub = onSnapshot(qAct, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as ActivityRow[];
      setActivities(list);
      setLoadingList(false);
    });
    return () => unsub();
  }, []);

  async function submit(e:React.FormEvent){
    e.preventDefault();
    if(!form.yearId || !form.zoneId || !form.subzoneId || !form.label || !form.startDate || !form.endDate) return;
    const ref = await addDoc(collection(db,"activities"),{
      label: form.label.trim(),
      startDate: new Date(form.startDate),
      endDate: new Date(form.endDate),
      yearId: form.yearId,
      zoneId: form.zoneId,
      subzoneId: form.subzoneId,
      itemsTotal: 0,
      itemsReturned: 0,
      isComplete: false,
      createdAt: serverTimestamp()
    });
    // Reset form (optionnel)
    setForm({ yearId: "", zoneId: "", subzoneId: "", label: "", startDate: "", endDate: "" });
    // Aller directement à l'inventaire si souhaité
    nav(`/activities/${ref.id}/inventory`);
  }

  // Edition inline
  function startEdit(a: ActivityRow) {
    setEditing(prev => ({
      ...prev,
      [a.id]: {
        label: a.label || "",
        startDate: tsToInput(a.startDate),
        endDate: tsToInput(a.endDate),
      }
    }));
  }
  function cancelEdit(id:string) {
    setEditing(prev => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  }
  async function saveEdit(a: ActivityRow) {
    const draft = editing[a.id];
    if (!draft) return;
    await updateDoc(doc(db,"activities",a.id),{
      label: draft.label.trim(),
      startDate: draft.startDate ? new Date(draft.startDate) : a.startDate,
      endDate: draft.endDate ? new Date(draft.endDate) : a.endDate,
      updatedAt: serverTimestamp()
    });
    cancelEdit(a.id);
  }
  async function removeActivity(a: ActivityRow) {
    if (!confirm(`Supprimer l’activité "${a.label}" ?\n(Remarque: cela ne supprime pas les sous-collections d’items)`)) return;
    await deleteDoc(doc(db,"activities",a.id));
  }

  // Affichage noms
  const yearById = useMemo(()=>Object.fromEntries(years.map(y=>[y.id,y.label])),[years]);
  const zoneById = useMemo(()=>Object.fromEntries(zones.map(z=>[z.id,z.name])),[zones]);
  const subzoneById = useMemo(()=>Object.fromEntries(subzones.map(s=>[s.id,s.name])),[subzones]);

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Activités</h1>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Carte formulaire */}
        <div className="border rounded-xl p-4 bg-white">
          <h2 className="font-semibold mb-3">Créer une activité</h2>
          <form onSubmit={submit} className="space-y-3">
            <select
              value={form.yearId}
              onChange={e=>setForm({...form,yearId:e.target.value})}
              className="border p-2 w-full rounded"
            >
              <option value="">-- Année --</option>
              {years.map(y=><option key={y.id} value={y.id}>{y.label}</option>)}
            </select>

            <select
              disabled={!form.yearId}
              value={form.zoneId}
              onChange={e=>setForm({...form,zoneId:e.target.value})}
              className="border p-2 w-full rounded disabled:bg-gray-100"
            >
              <option value="">-- Zone --</option>
              {zones
                .filter(z=>z.yearId===form.yearId)
                .map(z=><option key={z.id} value={z.id}>{z.name}</option>)}
            </select>

            <select
              disabled={!form.zoneId}
              value={form.subzoneId}
              onChange={e=>setForm({...form,subzoneId:e.target.value})}
              className="border p-2 w-full rounded disabled:bg-gray-100"
            >
              <option value="">-- Sous-zone --</option>
              {subzones
                .filter(s=>s.zoneId===form.zoneId)
                .map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <input
              className="border p-2 w-full rounded"
              placeholder="Libellé"
              value={form.label}
              onChange={e=>setForm({...form,label:e.target.value})}
            />

            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                className="border p-2 rounded"
                value={form.startDate}
                onChange={e=>setForm({...form,startDate:e.target.value})}
              />
              <input
                type="date"
                className="border p-2 rounded"
                value={form.endDate}
                onChange={e=>setForm({...form,endDate:e.target.value})}
              />
            </div>

            <div>
              <button className="bg-blue-600 text-white px-4 py-2 rounded">
                Créer
              </button>
            </div>
          </form>
        </div>

        {/* Carte liste + CRUD */}
        <div className="border rounded-xl p-4 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Dernières activités</h2>
            <span className="text-xs text-gray-500">{activities.length} éléments</span>
          </div>

          {loadingList && <div>Chargement…</div>}
          {!loadingList && activities.length === 0 && (
            <div className="text-gray-600">Aucune activité.</div>
          )}

          <div className="divide-y">
            {activities.map(a=>{
              const draft = editing[a.id];
              const startStr = tsToInput(a.startDate);
              const endStr = tsToInput(a.endDate);
              return (
                <div key={a.id} className="py-3">
                  {/* Ligne d’infos */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      {!draft ? (
                        <>
                          <div className="font-semibold">{a.label}</div>
                          <div className="text-sm text-gray-600">
                            {startStr} → {endStr}
                          </div>
                          <div className="text-xs text-gray-500">
                            {yearById[a.yearId] ?? "?"} / {zoneById[a.zoneId] ?? "?"} / {subzoneById[a.subzoneId] ?? "?"}
                          </div>
                          <div className="text-xs">
                            Retours : {a.itemsReturned ?? 0}/{a.itemsTotal ?? 0} — {a.isComplete ? "🟢 Complet" : "🟠 Incomplet"}
                          </div>
                        </>
                      ) : (
                        <div className="grid sm:grid-cols-3 gap-2">
                          <input
                            className="border p-2 rounded col-span-3"
                            value={draft.label}
                            onChange={(e)=>setEditing(prev=>({...prev,[a.id]:{...prev[a.id], label:e.target.value}}))}
                          />
                          <input
                            type="date"
                            className="border p-2 rounded"
                            value={draft.startDate}
                            onChange={(e)=>setEditing(prev=>({...prev,[a.id]:{...prev[a.id], startDate:e.target.value}}))}
                          />
                          <input
                            type="date"
                            className="border p-2 rounded"
                            value={draft.endDate}
                            onChange={(e)=>setEditing(prev=>({...prev,[a.id]:{...prev[a.id], endDate:e.target.value}}))}
                          />
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0 flex flex-col gap-2">
                      {!draft ? (
                        <>
                          <Link
                            to={`/activities/${a.id}/inventory`}
                            className="text-xs bg-gray-900 text-white px-3 py-1 rounded text-center"
                          >
                            Inventaire
                          </Link>
                          <button
                            onClick={()=>startEdit(a)}
                            className="text-xs border px-3 py-1 rounded"
                          >
                            Éditer
                          </button>
                          <button
                            onClick={()=>removeActivity(a)}
                            className="text-xs border px-3 py-1 rounded text-red-600"
                          >
                            Supprimer
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={()=>saveEdit(a)}
                            className="text-xs bg-blue-600 text-white px-3 py-1 rounded"
                          >
                            Enregistrer
                          </button>
                          <button
                            onClick={()=>cancelEdit(a.id)}
                            className="text-xs border px-3 py-1 rounded"
                          >
                            Annuler
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-xs text-gray-500 mt-3">
            Astuce : l’édition inline modifie <code>libellé</code> et <code>dates</code>.  
            Pour changer année/zone/sous-zone, recrée l’activité (ou ajoute un écran avancé).
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  addDoc, collection, serverTimestamp, getDocs, query, where,
  orderBy, limit, onSnapshot, doc, updateDoc, deleteDoc
} from "firebase/firestore";
import { db } from "../../firebase";
import { Link, useNavigate } from "react-router-dom";

type Year = { id:string; label:string };
type Zone = { id:string; name:string };
type Subzone = { id:string; name:string; zoneId:string };

type ActivityRow = {
  id: string;
  label: string;
  startDate: any;
  endDate: any;
  yearId: string;
  subzoneId: string;
  isComplete?: boolean;
  itemsTotal?: number;
  itemsReturned?: number;
};

const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

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
    startDate: string;
    endDate: string;
  }>>({});

  // Filtres LISTE
  const [filterYearId, setFilterYearId] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<"all"|"complete"|"incomplete">("all");
  const [filterLabel, setFilterLabel] = useState<string>("");

  const nav = useNavigate();

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
    } catch { return ""; }
  }

  // Référentiels (triés)
  useEffect(()=>{ (async()=>{
    const ysSnap = await getDocs(query(collection(db,"years"), orderBy("label")));
    const ys = ysSnap.docs.map(d=>({id:d.id, ...(d.data() as any)})) as Year[];
    ys.sort((a,b)=>collator.compare(a.label||"", b.label||""));
    setYears(ys);

    const zsSnap = await getDocs(query(collection(db,"zones"), orderBy("name")));
    const zs = zsSnap.docs.map(d=>({id:d.id, ...(d.data() as any)})) as Zone[];
    zs.sort((a,b)=>collator.compare(a.name||"", b.name||""));
    setZones(zs);
  })(); },[]);

  // Sous-zones filtrées par zone choisie (triées)
  useEffect(() => {
    if (!form.zoneId) {
      setSubzones([]);
      setForm(f => ({ ...f, subzoneId: "" }));
      return;
    }
    (async () => {
      try {
        const qsz = query(collection(db, "subzones"), where("zoneId", "==", form.zoneId));
        const szz = await getDocs(qsz);
        const list = szz.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Subzone[];
        list.sort((a, b) => collator.compare(a.name || "", b.name || ""));
        setSubzones(list);
        setForm(f => ({ ...f, subzoneId: "" }));
      } catch (e) {
        console.error("Chargement sous-zones échoué :", e);
        setSubzones([]);
      }
    })();
  }, [form.zoneId]);

  // Liste activités (live) — filtres Année + Statut côté requête
  useEffect(()=> {
    setLoadingList(true);

    const clauses:any[] = [];
    if (filterYearId) clauses.push(where("yearId","==",filterYearId));
    if (filterStatus !== "all") {
      const wantComplete = filterStatus === "complete";
      clauses.push(where("isComplete","==", wantComplete));
    }

    const qAct = query(collection(db,"activities"), ...clauses, orderBy("startDate","desc"), limit(200));

    const unsub = onSnapshot(qAct, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as ActivityRow[];
      setActivities(list);
      setLoadingList(false);
    }, err => {
      console.warn("Index manquant, fallback mémoire:", err?.message);
      const baseQ = query(collection(db,"activities"), orderBy("startDate","desc"), limit(200));
      onSnapshot(baseQ, s2 => {
        let list = s2.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as ActivityRow[];
        if (filterYearId) list = list.filter(a => a.yearId === filterYearId);
        if (filterStatus !== "all") {
          const wantComplete = filterStatus === "complete";
          list = list.filter(a => !!a.isComplete === wantComplete);
        }
        setActivities(list);
        setLoadingList(false);
      });
    });

    return () => unsub();
  }, [filterYearId, filterStatus]);

  // Sous-zones (toutes) pour affichage liste
  const [subzonesAll, setSubzonesAll] = useState<Subzone[]>([]);
  useEffect(()=> {
    (async ()=>{
      const allSnap = await getDocs(query(collection(db,"subzones"), orderBy("name")));
      const all = allSnap.docs.map(d=>({id:d.id, ...(d.data() as any)})) as Subzone[];
      all.sort((a,b)=>collator.compare(a.name||"", b.name||""));
      setSubzonesAll(all);
    })();
  },[]);

  // Maps d'affichage
  const yearLabelById   = useMemo(()=>Object.fromEntries(years.map(y=>[y.id,y.label])),[years]);
  const zoneById        = useMemo(()=>Object.fromEntries(zones.map(z=>[z.id,z.name])),[zones]);
  const subzoneAllById  = useMemo(()=>Object.fromEntries(subzonesAll.map(s=>[s.id,s])),[subzonesAll]);

  // Filtre par libellé (client-side)
  const activitiesFiltered = useMemo(()=>{
    if (!filterLabel.trim()) return activities;
    const needle = filterLabel.toLocaleLowerCase();
    return activities.filter(a => (a.label || "").toLocaleLowerCase().includes(needle));
  }, [activities, filterLabel]);

  // Création activité
  async function submit(e:React.FormEvent){
    e.preventDefault();
    if(!form.yearId || !form.subzoneId || !form.label || !form.startDate || !form.endDate) return;
    const ref = await addDoc(collection(db,"activities"),{
      label: form.label.trim(),
      startDate: new Date(form.startDate),
      endDate: new Date(form.endDate),
      yearId: form.yearId,
      subzoneId: form.subzoneId,
      itemsTotal: 0,
      itemsReturned: 0,
      isComplete: false,
      createdAt: serverTimestamp()
    });
    setForm({ yearId: "", zoneId: "", subzoneId: "", label: "", startDate: "", endDate: "" });
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

  // Helpers d’affichage
  function getZoneNameForActivity(a: ActivityRow): string {
    // legacy
    // @ts-ignore
    if ((a as any).zoneId && zoneById[(a as any).zoneId]) return zoneById[(a as any).zoneId];
    const sz = subzoneAllById[a.subzoneId];
    if (!sz) return "?";
    const zName = zoneById[sz.zoneId];
    return zName || "?";
  }
  function getSubzoneNameForActivity(a: ActivityRow): string {
    const sz = subzoneAllById[a.subzoneId];
    return sz?.name ?? "?";
  }

  // Versions triées pour les <select>
  const yearsSorted = years.slice().sort((a,b)=>collator.compare(a.label||"", b.label||""));
  const zonesSorted = zones.slice().sort((a,b)=>collator.compare(a.name||"", b.name||""));
  const subzonesSorted = subzones.slice().sort((a,b)=>collator.compare(a.name||"", b.name||""));

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-semibold">Activités</h1>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* Formulaire (gauche) — hauteur naturelle */}
        <div className="border rounded-xl p-4 bg-white self-start">
          <h2 className="font-semibold mb-3">Créer une activité</h2>
          <form onSubmit={submit} className="space-y-3">
            {/* Année */}
            <select
              value={form.yearId}
              onChange={e=>setForm({...form,yearId:e.target.value})}
              className="border p-2 w-full rounded"
            >
              <option value="">-- Année --</option>
              {yearsSorted.map(y=><option key={y.id} value={y.id}>{y.label}</option>)}
            </select>

            {/* Zone */}
            <select
              value={form.zoneId}
              onChange={e=>setForm({...form,zoneId:e.target.value})}
              className="border p-2 w-full rounded"
            >
              <option value="">-- Zone --</option>
              {zonesSorted.map(z=><option key={z.id} value={z.id}>{z.name}</option>)}
            </select>

            {/* Sous-zone */}
            <select
              disabled={!form.zoneId}
              value={form.subzoneId}
              onChange={e=>setForm({...form,subzoneId:e.target.value})}
              className="border p-2 w-full rounded disabled:bg-gray-100"
            >
              <option value="">-- Sous-zone --</option>
              {subzonesSorted.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
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
              <button className="bg-blue-600 text-white px-4 py-2 rounded">Créer</button>
            </div>
          </form>
        </div>

        {/* Liste + Filtres + CRUD (droite) — pleine hauteur + header sticky */}
        {/*
          h-[calc(100vh-2rem)] : 100vh - padding vertical global (p-4 => 1rem en haut + 1rem en bas)
          overflow-hidden sur la carte, puis header sticky et body scrollable
        */}
        <div className="border rounded-xl bg-white self-stretch p-0 overflow-hidden h-[calc(100vh-6rem)]">
          {/* Header sticky: titre + filtres */}
          <div className="sticky top-0 z-10 bg-white border-b">
            <div className="px-4 pt-4 flex items-center justify-between">
              <h2 className="font-semibold">Dernières activités</h2>
              <span className="text-xs text-gray-500">{activitiesFiltered.length} éléments</span>
            </div>

            <div className="px-4 pb-3 pt-2 flex flex-wrap gap-2">
              <select
                value={filterYearId}
                onChange={(e)=>setFilterYearId(e.target.value)}
                className="border p-2 rounded"
              >
                <option value="">Toutes les années</option>
                {yearsSorted.map(y=>(
                  <option key={y.id} value={y.id}>{y.label}</option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e)=>setFilterStatus(e.target.value as any)}
                className="border p-2 rounded"
              >
                <option value="all">Tous les statuts</option>
                <option value="complete">Complet</option>
                <option value="incomplete">Incomplet</option>
              </select>

              <input
                className="border p-2 rounded flex-1 min-w-[180px]"
                placeholder="Rechercher par libellé…"
                value={filterLabel}
                onChange={(e)=>setFilterLabel(e.target.value)}
              />
            </div>
          </div>

          {/* Corps scrollable */}
          <div className="h-full overflow-y-auto p-4">
            {loadingList && <div>Chargement…</div>}
            {!loadingList && activitiesFiltered.length === 0 && (
              <div className="text-gray-600">Aucune activité.</div>
            )}

            <div className="divide-y">
              {activitiesFiltered.map(a=>{
                const draft = editing[a.id];
                const startStr = tsToInput(a.startDate);
                const endStr = tsToInput(a.endDate);
                return (
                  <div key={a.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        {!draft ? (
                          <>
                            <div className="font-semibold">{a.label}</div>
                            <div className="text-sm text-gray-600">
                              {startStr} → {endStr}
                            </div>
                            <div className="text-xs text-gray-500">
                              {yearLabelById[a.yearId] ?? "?"} / {getZoneNameForActivity(a)} / {getSubzoneNameForActivity(a)}
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
              Remarque : la zone est déduite de la sous-zone (pas stockée dans l’activité).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

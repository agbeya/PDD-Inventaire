import { useEffect, useMemo, useState } from "react";
import {
  addDoc, collection, serverTimestamp, getDocs, query, where,
  orderBy, limit, onSnapshot, doc, updateDoc, deleteDoc
} from "firebase/firestore";
import { db } from "../../firebase";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext"; // Ajout import

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
  createdAt?: any;
  createdByUid?: string;
  createdByName?: string;
};

const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

export default function CreateActivity(){
  // Auth
  const { user, profile } = useAuth();
  const currentUserName =
    (profile?.firstName || profile?.lastName)
      ? `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim()
      : (profile?.displayName || user?.displayName || user?.email || "Utilisateur");

  // Form
  const [years,setYears]=useState<Year[]>([]);
  const [zones,setZones]=useState<Zone[]>([]);
  const [subzones,setSubzones]=useState<Subzone[]>([]);
  const [form,setForm]=useState({
    yearId:"", zoneId:"", subzoneId:"",
    label:"", startDate:"", endDate:""
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Liste
  const [activities,setActivities] = useState<ActivityRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [editing, setEditing] = useState<Record<string, {
    label: string;
    startDate: string;
    endDate: string;
    error?: string;
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

  // Contrôle date UX
  function isEndDateValid(start: string, end: string) {
    if (!start || !end) return true;
    return new Date(end) >= new Date(start);
  }

  // Création activité
  async function submit(e:React.FormEvent){
    e.preventDefault();
    setFormError(null);
    if(!form.yearId || !form.subzoneId || !form.label || !form.startDate || !form.endDate) {
      setFormError("Tous les champs sont obligatoires.");
      return;
    }
    if (!isEndDateValid(form.startDate, form.endDate)) {
      setFormError("La date de fin ne peut pas être antérieure à la date de début.");
      return;
    }
    const ref = await addDoc(collection(db,"activities"),{
      label: form.label.trim(),
      startDate: new Date(form.startDate),
      endDate: new Date(form.endDate),
      yearId: form.yearId,
      subzoneId: form.subzoneId,
      itemsTotal: 0,
      itemsReturned: 0,
      isComplete: false,
      createdAt: serverTimestamp(),
      createdByUid: user?.uid ?? null,
      createdByName: currentUserName
    });
    setForm({ yearId: "", zoneId: "", subzoneId: "", label: "", startDate: "", endDate: "" });
    nav(`/activities/${ref.id}/inventory`);
  }

  // Edition inline avec contrôle date
  function startEdit(a: ActivityRow) {
    setEditing(prev => ({
      ...prev,
      [a.id]: {
        label: a.label || "",
        startDate: tsToInput(a.startDate),
        endDate: tsToInput(a.endDate),
        error: undefined
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
    if (!draft.label || !draft.startDate || !draft.endDate) {
      setEditing(prev => ({
        ...prev,
        [a.id]: { ...draft, error: "Tous les champs sont obligatoires." }
      }));
      return;
    }
    if (!isEndDateValid(draft.startDate, draft.endDate)) {
      setEditing(prev => ({
        ...prev,
        [a.id]: { ...draft, error: "La date de fin ne peut pas être antérieure à la date de début." }
      }));
      return;
    }
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
  function tsToDate(d: any): Date | null {
    if (!d) return null;
    if (typeof d?.toDate === "function") return d.toDate();
    if (d instanceof Date) return d;
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  function fmtDateTime(d: any, fallback = ""): string {
    const val = tsToDate(d);
    if (!val) return fallback;
    return `${val.toLocaleDateString("fr-FR")} ${val.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  }

  // Versions triées pour les <select>
  const yearsSorted = years.slice().sort((a,b)=>collator.compare(a.label||"", b.label||""));
  const zonesSorted = zones.slice().sort((a,b)=>collator.compare(a.name||"", b.name||""));
  const subzonesSorted = subzones.slice().sort((a,b)=>collator.compare(a.name||"", b.name||""));

  return (
    <div className="p-6 space-y-10 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold tracking-tight text-gray-800">
        📋 Activités
      </h1>

      <div className="grid lg:grid-cols-2 gap-8 items-start">
        {/* Formulaire (gauche) — hauteur naturelle */}
        <div className="bg-white border rounded-2xl shadow-sm p-6 self-start hover:shadow-md transition">
          <h2 className="font-semibold mb-3 text-lg text-gray-800">Créer une activité</h2>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <select
                value={form.yearId}
                onChange={e=>setForm({...form,yearId:e.target.value})}
                className="border p-2 w-full rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              >
                <option value="">-- Année --</option>
                {yearsSorted.map(y=><option key={y.id} value={y.id}>{y.label}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <select
                value={form.zoneId}
                onChange={e=>setForm({...form,zoneId:e.target.value})}
                className="border p-2 w-full rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              >
                <option value="">-- Zone --</option>
                {zonesSorted.map(z=><option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <select
                disabled={!form.zoneId}
                value={form.subzoneId}
                onChange={e=>setForm({...form,subzoneId:e.target.value})}
                className="border p-2 w-full rounded disabled:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              >
                <option value="">-- Sous-zone --</option>
                {subzonesSorted.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <input
                className="border p-2 w-full rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Libellé"
                value={form.label}
                onChange={e=>setForm({...form,label:e.target.value})}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <input
                  type="date"
                  className="border p-2 rounded w-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={form.startDate}
                  onChange={e=>setForm({...form,startDate:e.target.value, endDate: form.endDate && new Date(form.endDate) < new Date(e.target.value) ? "" : form.endDate})}
                  required
                  max={form.endDate || undefined}
                />
              </div>
              <div className="space-y-2">
                <input
                  type="date"
                  className={`border p-2 rounded w-full focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                    form.startDate && form.endDate && !isEndDateValid(form.startDate, form.endDate)
                      ? "border-red-500"
                      : ""
                  }`}
                  value={form.endDate}
                  onChange={e=>setForm({...form,endDate:e.target.value})}
                  required
                  min={form.startDate || undefined}
                />
              </div>
            </div>

            {formError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-2 rounded">
                {formError}
              </div>
            )}

            <button className="bg-blue-600 hover:bg-blue-700 transition text-white px-4 py-2 rounded-md shadow-sm w-full">
              Créer
            </button>
          </form>
        </div>

        {/* Liste + Filtres + CRUD (droite) — pleine hauteur + header sticky */}
        <div className="bg-white border rounded-2xl shadow-sm p-0 h-[calc(100vh-8rem)] flex flex-col">
          {/* Header sticky: titre + filtres */}
          <div className="sticky top-0 z-10 bg-white border-b">
            <div className="px-6 pt-6 flex items-center justify-between">
              <h2 className="font-semibold text-lg text-gray-800">Dernières activités</h2>
              <span className="text-xs text-gray-500">{activitiesFiltered.length} éléments</span>
            </div>
            <div className="px-6 pb-4 pt-2 flex flex-wrap gap-2">
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

          {/* Corps scrollable sous le header sticky */}
          <div className="flex-1 overflow-y-auto p-6">
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
                  <div key={a.id} className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        {!draft ? (
                          <>
                            <div className="font-semibold text-gray-900">{a.label}</div>
                            <div className="text-sm text-gray-600">
                              {startStr} → {endStr}
                            </div>
                            <div className="text-xs text-gray-500">
                              {yearLabelById[a.yearId] ?? "?"} / {getZoneNameForActivity(a)} / {getSubzoneNameForActivity(a)}
                            </div>
                            <div className="text-xs">
                              Retours : {a.itemsReturned ?? 0}/{a.itemsTotal ?? 0} — {a.isComplete ? "🟢 Complet" : "🟠 Incomplet"}
                            </div>
                            {/* Ajout affichage créateur et date */}
                            <div className="text-xs text-gray-400 mt-1">
                              {a.createdAt
                                ? <>Créée le {fmtDateTime(a.createdAt, "?")}{a.createdByName ? <> par {a.createdByName}</> : null}</>
                                : <>Date de création inconnue</>
                              }
                            </div>
                          </>
                        ) : (
                          <div className="grid sm:grid-cols-3 gap-2">
                            <input
                              className="border p-2 rounded col-span-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                              value={draft.label}
                              onChange={(e)=>setEditing(prev=>({...prev,[a.id]:{...prev[a.id], label:e.target.value, error: undefined}}))}
                              required
                            />
                            <input
                              type="date"
                              className="border p-2 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                              value={draft.startDate}
                              onChange={e=>{
                                setEditing(prev=>{
                                  const newStart = e.target.value;
                                  const newEnd = draft.endDate && new Date(draft.endDate) < new Date(newStart) ? "" : draft.endDate;
                                  return {
                                    ...prev,
                                    [a.id]: { ...prev[a.id], startDate: newStart, endDate: newEnd, error: undefined }
                                  };
                                });
                              }}
                              required
                              max={draft.endDate || undefined}
                            />
                            <input
                              type="date"
                              className={`border p-2 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                                draft.startDate && draft.endDate && !isEndDateValid(draft.startDate, draft.endDate)
                                  ? "border-red-500"
                                  : ""
                              }`}
                              value={draft.endDate}
                              onChange={e=>setEditing(prev=>({...prev,[a.id]:{...prev[a.id], endDate:e.target.value, error: undefined}}))}
                              required
                              min={draft.startDate || undefined}
                            />
                            {draft.error && (
                              <div className="col-span-3 text-sm text-red-600 bg-red-50 border border-red-200 p-2 rounded mt-2">
                                {draft.error}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex-shrink-0 flex flex-col gap-2">
                        {!draft ? (
                          <>
                            <Link
                              to={`/activities/${a.id}/inventory`}
                              className="text-xs bg-gray-900 text-white px-3 py-1 rounded text-center hover:bg-gray-800 transition"
                            >
                              Inventaire
                            </Link>
                            <button
                              onClick={()=>startEdit(a)}
                              className="text-xs border px-3 py-1 rounded hover:bg-blue-50 hover:text-blue-600 transition"
                            >
                              Éditer
                            </button>
                            <button
                              onClick={()=>removeActivity(a)}
                              className="text-xs border px-3 py-1 rounded text-red-600 hover:bg-red-50 hover:text-red-600 transition"
                            >
                              Supprimer
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={()=>saveEdit(a)}
                              className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition"
                            >
                              Enregistrer
                            </button>
                            <button
                              onClick={()=>cancelEdit(a.id)}
                              className="text-xs border px-3 py-1 rounded hover:bg-gray-50 transition"
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
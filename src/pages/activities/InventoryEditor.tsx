
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, serverTimestamp, orderBy, setDoc
} from "firebase/firestore";
import { db } from "../../firebase";
import type { Activity, Item, Service } from "../../types";

export default function InventoryEditor(){
  const { activityId } = useParams();
  const [activity,setActivity] = useState<Activity|null>(null);
  const [services,setServices] = useState<Service[]>([]);
  const [itemsByService,setItemsByService] = useState<Record<string,Item[]>>({});

  useEffect(()=>{ (async()=>{
    if(!activityId) return;
    const a = await getDoc(doc(db,"activities",activityId));
    setActivity({id:a.id, ...(a.data() as any)});
    const sv = await getDocs(query(collection(db,"services")));
    const allSv = sv.docs.map(d=>({id:d.id, ...(d.data() as any)})).filter(s=>s.active!==false);
    setServices(allSv);

    const res:Record<string,Item[]> = {};
    for(const s of allSv){
      const snap = await getDocs(query(
        collection(db,"activities",activityId,"serviceItems",s.id,"items"),
        orderBy("createdAt","asc")
      ));
      res[s.id] = snap.docs.map(d=>({id:d.id, ...(d.data() as any)}));
    }
    setItemsByService(res);
  })(); },[activityId]);

  async function addItem(serviceId:string){
    if(!activityId) return;
    const name = prompt("Nom de l'objet ?");
    if(!name) return;
    const qtyStr = prompt("Quantité ?", "1");
    const qty = Number(qtyStr ?? 1) || 1;
    const sortieChecked = true;
    const now = serverTimestamp();
    await setDoc(doc(db,"activities",activityId,"serviceItems",serviceId), { serviceId, createdAt: now }, { merge: true });
    const ref = await addDoc(
      collection(db,"activities",activityId,"serviceItems",serviceId,"items"), {
        activityId,
        name, qty,
        sortieChecked, sortieAt: now,
        retourChecked: false, retourAt: null,
        createdAt: now, updatedAt: now
      }
    );
    setItemsByService(prev=>({
      ...prev,
      [serviceId]: [...(prev[serviceId]||[]), {
        id: ref.id, name, qty,
        sortieChecked, sortieAt: null,
        retourChecked: false, retourAt: null,
        createdAt: null, updatedAt: null
      }]
    }));
  }

  async function toggleRetour(serviceId:string, item:Item){
    if(!activityId) return;
    const ref = doc(db,"activities",activityId,"serviceItems",serviceId,"items", item.id);
    const retourChecked = !item.retourChecked;
    await updateDoc(ref,{
      retourChecked,
      retourAt: retourChecked ? serverTimestamp() : null,
      updatedAt: serverTimestamp()
    });
    setItemsByService(prev=>({
      ...prev,
      [serviceId]: prev[serviceId].map(it=>it.id===item.id ? {...it, retourChecked, retourAt: null} : it)
    }));
  }

  const stats = useMemo(()=>{
    const all = Object.values(itemsByService).flat();
    const total = all.length;
    const returned = all.filter(i=>i.retourChecked).length;
    return { total, returned, complete: total>0 && total===returned };
  },[itemsByService]);

  useEffect(() => {
    if (!activityId) return;
    // évite d'écrire au tout premier rendu avant chargement complet
    const total = stats.total;
    const returned = stats.returned;
    const isComplete = stats.complete;
    (async () => {
      try {
        await updateDoc(doc(db, "activities", activityId), {
          itemsTotal: total,
          itemsReturned: returned,
          isComplete,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.error("MAJ activité échouée:", e);
      }
    })();
  }, [activityId, stats.total, stats.returned, stats.complete]);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Inventaire : {activity?.label}</h1>
      <div className="text-sm">
        Période : {(activity as any)?.startDate?.toDate?.()?.toLocaleDateString("fr-FR")} → {(activity as any)?.endDate?.toDate?.()?.toLocaleDateString("fr-FR")}
      </div>
      <div className="p-3 border rounded bg-white">
        Statut activité : {stats.complete ? "🟢 Complet" : "🟠 Incomplet"} ({stats.returned}/{stats.total} retournés)
      </div>

      {services.map(s=>(
        <div key={s.id} className="border rounded p-3 bg-white">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{s.name}</h2>
            <button onClick={()=>addItem(s.id)} className="text-sm bg-blue-600 text-white px-3 py-1 rounded">
              + Ajouter un objet
            </button>
          </div>
          <div className="mt-2">
            {(itemsByService[s.id]||[]).length===0 && <div className="text-gray-500 text-sm">Aucun objet</div>}
            {(itemsByService[s.id]||[]).map(it=>(
              <div key={it.id} className="grid grid-cols-12 gap-2 items-center py-2 border-b">
                <div className="col-span-4">
                  <div className="font-medium">{it.name}</div>
                  <div className="text-xs text-gray-500">Qté: {it.qty}</div>
                </div>
                <div className="col-span-3">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" disabled checked={!!it.sortieChecked}/>
                    <span>Sortie</span>
                  </label>
                </div>
                <div className="col-span-3">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!it.retourChecked} onChange={()=>toggleRetour(s.id,it)}/>
                    <span>Retour</span>
                  </label>
                </div>
                <div className="col-span-2 text-xs text-gray-500">
                  {it.retourChecked ? "à jour" : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

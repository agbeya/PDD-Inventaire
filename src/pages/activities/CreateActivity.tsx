
import { useState, useEffect } from "react";
import { addDoc, collection, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { useNavigate } from "react-router-dom";

export default function CreateActivity(){
  const [years,setYears]=useState<any[]>([]);
  const [zones,setZones]=useState<any[]>([]);
  const [subzones,setSubzones]=useState<any[]>([]);
  const [form,setForm]=useState({
    yearId:"", zoneId:"", subzoneId:"",
    label:"", startDate:"", endDate:""
  });
  const nav = useNavigate();

  useEffect(()=>{ (async()=>{
    const ys = await getDocs(collection(db,"years"));
    setYears(ys.docs.map(d=>({id:d.id,...d.data()})));
  })(); },[]);

  useEffect(()=>{ if(!form.yearId) return;
    (async()=>{
      const qz = query(collection(db,"zones"), where("yearId","==",form.yearId));
      const zs = await getDocs(qz);
      setZones(zs.docs.map(d=>({id:d.id,...d.data()})));
      setSubzones([]); setForm(f=>({...f, zoneId:"", subzoneId:""}));
    })();
  },[form.yearId]);

  useEffect(()=>{ if(!form.zoneId) return;
    (async()=>{
      const qsz = query(collection(db,"subzones"), where("zoneId","==",form.zoneId));
      const szz = await getDocs(qsz);
      setSubzones(szz.docs.map(d=>({id:d.id,...d.data()})));
      setForm(f=>({...f, subzoneId:""}));
    })();
  },[form.zoneId]);

  async function submit(e:React.FormEvent){
    e.preventDefault();
    if(!form.yearId || !form.zoneId || !form.subzoneId || !form.label || !form.startDate || !form.endDate) return;
    const ref = await addDoc(collection(db,"activities"),{
      label: form.label,
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
    nav(`/activities/${ref.id}/inventory`);
  }

  return (
    <form onSubmit={submit} className="p-4 max-w-xl space-y-3">
      <h1 className="text-xl font-semibold">Créer une activité</h1>
      <select value={form.yearId} onChange={e=>setForm({...form,yearId:e.target.value})} className="border p-2 w-full">
        <option value="">-- Année --</option>
        {years.map(y=><option key={y.id} value={y.id}>{y.label}</option>)}
      </select>

      <select disabled={!form.yearId} value={form.zoneId} onChange={e=>setForm({...form,zoneId:e.target.value})} className="border p-2 w-full">
        <option value="">-- Zone --</option>
        {zones.map(z=><option key={z.id} value={z.id}>{z.name}</option>)}
      </select>

      <select disabled={!form.zoneId} value={form.subzoneId} onChange={e=>setForm({...form,subzoneId:e.target.value})} className="border p-2 w-full">
        <option value="">-- Sous-zone --</option>
        {subzones.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      <input className="border p-2 w-full" placeholder="Libellé" value={form.label}
        onChange={e=>setForm({...form,label:e.target.value})} />

      <div className="grid grid-cols-2 gap-2">
        <input type="date" className="border p-2" value={form.startDate}
          onChange={e=>setForm({...form,startDate:e.target.value})}/>
        <input type="date" className="border p-2" value={form.endDate}
          onChange={e=>setForm({...form,endDate:e.target.value})}/>
      </div>

      <button className="bg-blue-600 text-white px-4 py-2 rounded">Créer</button>
    </form>
  );
}

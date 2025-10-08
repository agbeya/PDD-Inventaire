import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../firebase";

type Opt = {
  id: string;
  label?: string;
  name?: string;
  zoneId?: string;
  active?: boolean;
};

export default function Setup() {
  // Data stores
  const [years, setYears] = useState<Opt[]>([]);
  const [zones, setZones] = useState<Opt[]>([]);
  const [subzones, setSubzones] = useState<Opt[]>([]);
  const [services, setServices] = useState<Opt[]>([]);

  // Forms
  const [yearLabel, setYearLabel] = useState("");
  const [zoneName, setZoneName] = useState("");
  const [subzoneZoneId, setSubzoneZoneId] = useState("");
  const [subzoneName, setSubzoneName] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [serviceActive, setServiceActive] = useState(true);

  // Tri helpers
  const byLabel = (a: Opt, b: Opt) =>
    (a.label ?? "").localeCompare(b.label ?? "", "fr", { sensitivity: "base" });
  const byName = (a: Opt, b: Opt) =>
    (a.name ?? "").localeCompare(b.name ?? "", "fr", { sensitivity: "base" });

  // Chargement initial
  useEffect(() => {
    (async () => {
      const [ys, zs, szz, svs] = await Promise.all([
        getDocs(query(collection(db, "years"), orderBy("label"))),
        getDocs(query(collection(db, "zones"), orderBy("name"))),
        getDocs(query(collection(db, "subzones"), orderBy("name"))),
        getDocs(query(collection(db, "services"), orderBy("name"))),
      ]);

      setYears(ys.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setZones(zs.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setSubzones(szz.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setServices(svs.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    })();
  }, []);

  // Données triées
  const yearsSorted = useMemo(() => [...years].sort(byLabel), [years]);
  const zonesSorted = useMemo(() => [...zones].sort(byName), [zones]);
  const subzonesSorted = useMemo(() => [...subzones].sort(byName), [subzones]);
  const servicesSorted = useMemo(() => [...services].sort(byName), [services]);

  // CRUD — création
  async function createYear(e: React.FormEvent) {
    e.preventDefault();
    if (!yearLabel.trim()) return;
    const label = yearLabel.trim();
    const ref = await addDoc(collection(db, "years"), { label, createdAt: serverTimestamp() });
    setYears((p) => [...p, { id: ref.id, label }]);
    setYearLabel("");
  }

  async function createZone(e: React.FormEvent) {
    e.preventDefault();
    if (!zoneName.trim()) return;
    const name = zoneName.trim();
    const ref = await addDoc(collection(db, "zones"), { name, createdAt: serverTimestamp() });
    setZones((p) => [...p, { id: ref.id, name }]);
    setZoneName("");
  }

  async function createSubzone(e: React.FormEvent) {
    e.preventDefault();
    if (!subzoneName.trim() || !subzoneZoneId) return;
    const name = subzoneName.trim();
    const ref = await addDoc(collection(db, "subzones"), {
      name,
      zoneId: subzoneZoneId,
      createdAt: serverTimestamp(),
    });
    setSubzones((p) => [...p, { id: ref.id, name, zoneId: subzoneZoneId }]);
    setSubzoneName("");
  }

  async function createService(e: React.FormEvent) {
    e.preventDefault();
    if (!serviceName.trim()) return;
    const name = serviceName.trim();
    const active = serviceActive;
    const ref = await addDoc(collection(db, "services"), { name, active, createdAt: serverTimestamp() });
    setServices((p) => [...p, { id: ref.id, name, active }]);
    setServiceName("");
    setServiceActive(true);
  }

  // CRUD — modifications & suppressions
  async function editYear(y: Opt) {
    const newLabel = prompt("Modifier le libellé :", y.label ?? "");
    if (newLabel === null) return;
    const label = newLabel.trim();
    await updateDoc(doc(db, "years", y.id), { label, updatedAt: serverTimestamp() });
    setYears((p) => p.map((i) => (i.id === y.id ? { ...i, label } : i)));
  }
  async function deleteYear(y: Opt) {
    if (!confirm(`Supprimer "${y.label}" ?`)) return;
    await deleteDoc(doc(db, "years", y.id));
    setYears((p) => p.filter((i) => i.id !== y.id));
  }

  async function editZone(z: Opt) {
    const newName = prompt("Modifier le nom :", z.name ?? "");
    if (newName === null) return;
    const name = newName.trim();
    await updateDoc(doc(db, "zones", z.id), { name, updatedAt: serverTimestamp() });
    setZones((p) => p.map((i) => (i.id === z.id ? { ...i, name } : i)));
  }
  async function deleteZone(z: Opt) {
    if (!confirm(`Supprimer "${z.name}" ?`)) return;
    await deleteDoc(doc(db, "zones", z.id));
    setZones((p) => p.filter((i) => i.id !== z.id));
  }

  async function editSubzone(s: Opt) {
    const newName = prompt("Modifier le nom :", s.name ?? "");
    if (newName === null) return;
    const name = newName.trim();
    await updateDoc(doc(db, "subzones", s.id), { name, updatedAt: serverTimestamp() });
    setSubzones((p) => p.map((i) => (i.id === s.id ? { ...i, name } : i)));
  }
  async function deleteSubzone(s: Opt) {
    if (!confirm(`Supprimer "${s.name}" ?`)) return;
    await deleteDoc(doc(db, "subzones", s.id));
    setSubzones((p) => p.filter((i) => i.id !== s.id));
  }

  async function editService(s: Opt) {
    const newName = prompt("Modifier le nom :", s.name ?? "");
    if (newName === null) return;
    const name = newName.trim();
    await updateDoc(doc(db, "services", s.id), { name, updatedAt: serverTimestamp() });
    setServices((p) => p.map((i) => (i.id === s.id ? { ...i, name } : i)));
  }
  async function toggleServiceActive(s: Opt) {
    const newVal = !s.active;
    await updateDoc(doc(db, "services", s.id), { active: newVal, updatedAt: serverTimestamp() });
    setServices((p) => p.map((i) => (i.id === s.id ? { ...i, active: newVal } : i)));
  }
  async function deleteService(s: Opt) {
    if (!confirm(`Supprimer "${s.name}" ?`)) return;
    await deleteDoc(doc(db, "services", s.id));
    setServices((p) => p.filter((i) => i.id !== s.id));
  }

  // Icônes
  const IconEdit = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
  const IconTrash = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    </svg>
  );
  const IconToggle = ({ on }: { on: boolean }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      className={on ? "text-green-600" : "text-gray-400"}>
      <rect x="3" y="8" width="18" height="8" rx="4"></rect>
      <circle cx={on ? 17 : 7} cy="12" r="3"></circle>
    </svg>
  );

  // ————————————————————————————————————————
  // —————— UI RENDER ————————————————
  // ————————————————————————————————————————
  return (
    <div className="p-6 space-y-10 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold tracking-tight text-gray-800">
        ⚙️ Paramétrage
      </h1>

      {renderSection("Années", "Créer une année", createYear, yearLabel, setYearLabel, yearsSorted, "label", editYear, deleteYear, "2024-2025")}
      {renderSection("Zones", "Créer une zone", createZone, zoneName, setZoneName, zonesSorted, "name", editZone, deleteZone, "Europe")}
      {renderSubzonesSection()}
      {renderServicesSection()}
    </div>
  );

  // ————————————————————————————————————————
  // —————— RENDER FUNCTIONS ————————————
  // ————————————————————————————————————————
  function renderSection(
    title: string,
    formTitle: string,
    onSubmit: (e: any) => Promise<void>,
    inputValue: string,
    setInputValue: (v: string) => void,
    items: Opt[],
    keyField: "label" | "name",
    onEdit: (x: Opt) => void,
    onDelete: (x: Opt) => void,
    placeholder: string
  ) {
    return (
      <section className="grid md:grid-cols-2 gap-6 items-start">
        <div className="bg-white border rounded-2xl shadow-sm p-5 transition hover:shadow-md">
          <h2 className="text-lg font-semibold mb-3 text-gray-800">{formTitle}</h2>
          <form onSubmit={onSubmit} className="space-y-3">
            <input
              className="border p-2 w-full rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder={`Ex : "${placeholder}"`}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              required
            />
            <button className="bg-blue-600 hover:bg-blue-700 transition text-white px-4 py-2 rounded-md shadow-sm w-full">
              Enregistrer
            </button>
          </form>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm p-5 max-h-[380px] overflow-y-auto">
          <h3 className="font-medium mb-3 text-gray-700">{title}</h3>
          <ul className="text-sm divide-y">
            {items.slice(0, 8).map((item) => (
              <li key={item.id} className="flex items-center justify-between py-2 group hover:bg-gray-50 rounded-md px-2 transition">
                <span>{item[keyField]}</span>
                <div className="flex items-center gap-2 text-gray-500">
                  <button onClick={() => onEdit(item)} className="p-1 rounded hover:bg-blue-50 hover:text-blue-600 transition">
                    <IconEdit />
                  </button>
                  <button onClick={() => onDelete(item)} className="p-1 rounded hover:bg-red-50 hover:text-red-600 transition">
                    <IconTrash />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  function renderSubzonesSection() {
    return (
      <section className="grid md:grid-cols-2 gap-6 items-start">
        <div className="bg-white border rounded-2xl shadow-sm p-5 hover:shadow-md transition">
          <h2 className="text-lg font-semibold mb-3 text-gray-800">Créer une sous-zone</h2>
          <form onSubmit={createSubzone} className="space-y-3">
            <select
              className="border p-2 w-full rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={subzoneZoneId}
              onChange={(e) => setSubzoneZoneId(e.target.value)}
              required
            >
              <option value="">-- Zone --</option>
              {zonesSorted.map((z) => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>

            <input
              className="border p-2 w-full rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder='Ex : "France"'
              value={subzoneName}
              onChange={(e) => setSubzoneName(e.target.value)}
              required
            />

            <button className="bg-blue-600 hover:bg-blue-700 transition text-white px-4 py-2 rounded-md shadow-sm w-full">
              Enregistrer
            </button>
          </form>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm p-5 max-h-[380px] overflow-y-auto">
          <h3 className="font-medium mb-3 text-gray-700">Sous-zones</h3>
          <ul className="text-sm divide-y">
            {subzonesSorted.slice(0, 10).map((s) => {
              const zone = zonesSorted.find((z) => z.id === s.zoneId);
              return (
                <li key={s.id} className="flex items-center justify-between py-2 group hover:bg-gray-50 rounded-md px-2 transition">
                  <span>
                    {s.name}
                    <span className="text-gray-500 text-xs"> ({zone?.name})</span>
                  </span>
                  <div className="flex items-center gap-2 text-gray-500">
                    <button onClick={() => editSubzone(s)} className="p-1 rounded hover:bg-blue-50 hover:text-blue-600 transition">
                      <IconEdit />
                    </button>
                    <button onClick={() => deleteSubzone(s)} className="p-1 rounded hover:bg-red-50 hover:text-red-600 transition">
                      <IconTrash />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    );
  }

  function renderServicesSection() {
    return (
      <section className="grid md:grid-cols-2 gap-6 items-start">
        <div className="bg-white border rounded-2xl shadow-sm p-5 hover:shadow-md transition">
          <h2 className="text-lg font-semibold mb-3 text-gray-800">Créer un service</h2>
          <form onSubmit={createService} className="space-y-3">
            <input
              className="border p-2 w-full rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder='Ex : "Service Instruments"'
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              required
            />
            <label className="inline-flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={serviceActive}
                onChange={(e) => setServiceActive(e.target.checked)}
              />
              Actif
            </label>
            <button className="bg-blue-600 hover:bg-blue-700 transition text-white px-4 py-2 rounded-md shadow-sm w-full">
              Enregistrer
            </button>
          </form>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm p-5 max-h-[380px] overflow-y-auto">
          <h3 className="font-medium mb-3 text-gray-700">Services</h3>
          <ul className="text-sm divide-y">
            {servicesSorted.slice(0, 12).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2 group hover:bg-gray-50 rounded-md px-2 transition">
                <span className="flex items-center gap-2">
                  {s.name}
                  <span className={`ml-2 text-xs font-medium ${s.active ? "text-green-600" : "text-gray-400"}`}>
                    {s.active ? "Actif" : "Inactif"}
                  </span>
                </span>
                <div className="flex items-center gap-2 text-gray-500">
                  <button onClick={() => toggleServiceActive(s)} className="p-1 rounded hover:bg-gray-100 transition">
                    <IconToggle on={!!s.active} />
                  </button>
                  <button onClick={() => editService(s)} className="p-1 rounded hover:bg-blue-50 hover:text-blue-600 transition">
                    <IconEdit />
                  </button>
                  <button onClick={() => deleteService(s)} className="p-1 rounded hover:bg-red-50 hover:text-red-600 transition">
                    <IconTrash />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }
}

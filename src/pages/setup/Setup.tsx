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

  // ------- helpers de tri (locale FR, insensible à la casse) -------
  const byLabel = (a: Opt, b: Opt) =>
    (a.label ?? "").localeCompare(b.label ?? "", "fr", { sensitivity: "base" });
  const byName = (a: Opt, b: Opt) =>
    (a.name ?? "").localeCompare(b.name ?? "", "fr", { sensitivity: "base" });

  // Load initial data
  useEffect(() => {
    (async () => {
      const ys = await getDocs(query(collection(db, "years"), orderBy("label")));
      setYears(ys.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));

      const zs = await getDocs(query(collection(db, "zones"), orderBy("name")));
      setZones(zs.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));

      const szz = await getDocs(query(collection(db, "subzones"), orderBy("name")));
      setSubzones(szz.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));

      const svs = await getDocs(query(collection(db, "services"), orderBy("name")));
      setServices(svs.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    })();
  }, []);

  // Versions triées pour TOUS les affichages (selects + listes)
  const yearsSorted    = useMemo(() => [...years].sort(byLabel), [years]);
  const zonesSorted    = useMemo(() => [...zones].sort(byName),  [zones]);
  const subzonesSorted = useMemo(() => [...subzones].sort(byName), [subzones]);
  const servicesSorted = useMemo(() => [...services].sort(byName), [services]);

  // Create handlers
  async function createYear(e: React.FormEvent) {
    e.preventDefault();
    if (!yearLabel.trim()) return;
    const label = yearLabel.trim();
    const ref = await addDoc(collection(db, "years"), { label, createdAt: serverTimestamp() });
    setYears((prev) => [...prev, { id: ref.id, label }]);
    setYearLabel("");
  }

  async function createZone(e: React.FormEvent) {
    e.preventDefault();
    if (!zoneName.trim()) return;
    const name = zoneName.trim();
    const ref = await addDoc(collection(db, "zones"), { name, createdAt: serverTimestamp() });
    setZones((prev) => [...prev, { id: ref.id, name }]);
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
    setSubzones((prev) => [...prev, { id: ref.id, name, zoneId: subzoneZoneId }]);
    setSubzoneName("");
  }

  async function createService(e: React.FormEvent) {
    e.preventDefault();
    if (!serviceName.trim()) return;
    const name = serviceName.trim();
    const active = serviceActive;
    const ref = await addDoc(collection(db, "services"), { name, active, createdAt: serverTimestamp() });
    setServices((prev) => [...prev, { id: ref.id, name, active }]);
    setServiceName("");
    setServiceActive(true);
  }

  // ===== CRUD: YEARS =====
  async function editYear(y: Opt) {
    const newLabel = prompt('Modifier le libellé de l’année :', y.label ?? '');
    if (newLabel === null) return;
    const label = newLabel.trim();
    await updateDoc(doc(db, "years", y.id), { label, updatedAt: serverTimestamp() });
    setYears(prev => prev.map(it => it.id === y.id ? { ...it, label } : it));
  }
  async function deleteYear(y: Opt) {
    if (!confirm(`Supprimer l’année "${y.label}" ?`)) return;
    await deleteDoc(doc(db, "years", y.id));
    setYears(prev => prev.filter(it => it.id !== y.id));
  }

  // ===== CRUD: ZONES =====
  async function editZone(z: Opt) {
    const newName = prompt('Modifier le nom de la zone :', z.name ?? '');
    if (newName === null) return;
    const name = newName.trim();
    await updateDoc(doc(db, "zones", z.id), { name, updatedAt: serverTimestamp() });
    setZones(prev => prev.map(it => it.id === z.id ? { ...it, name } : it));
  }
  async function deleteZone(z: Opt) {
    if (!confirm(`Supprimer la zone "${z.name}" ?\n(Remarque : ne supprime pas les sous-collections associées)`)) return;
    await deleteDoc(doc(db, "zones", z.id));
    setZones(prev => prev.filter(it => it.id !== z.id));
  }

  // ===== CRUD: SUBZONES =====
  async function editSubzone(s: Opt) {
    const newName = prompt('Modifier le nom de la sous-zone :', s.name ?? '');
    if (newName === null) return;
    const name = newName.trim();
    await updateDoc(doc(db, "subzones", s.id), { name, updatedAt: serverTimestamp() });
    setSubzones(prev => prev.map(it => it.id === s.id ? { ...it, name } : it));
  }
  async function deleteSubzone(s: Opt) {
    if (!confirm(`Supprimer la sous-zone "${s.name}" ?`)) return;
    await deleteDoc(doc(db, "subzones", s.id));
    setSubzones(prev => prev.filter(it => it.id !== s.id));
  }

  // ===== CRUD: SERVICES =====
  async function editService(s: Opt) {
    const newName = prompt('Modifier le nom du service :', s.name ?? '');
    if (newName === null) return;
    const name = newName.trim();
    await updateDoc(doc(db, "services", s.id), { name, updatedAt: serverTimestamp() });
    setServices(prev => prev.map(it => it.id === s.id ? { ...it, name } : it));
  }
  async function toggleServiceActive(s: Opt) {
    const newVal = !s.active;
    await updateDoc(doc(db, "services", s.id), { active: newVal, updatedAt: serverTimestamp() });
    setServices(prev => prev.map(it => it.id === s.id ? { ...it, active: newVal } : it));
  }
  async function deleteService(s: Opt) {
    if (!confirm(`Supprimer le service "${s.name}" ?`)) return;
    await deleteDoc(doc(db, "services", s.id));
    setServices(prev => prev.filter(it => it.id !== s.id));
  }

  // === Icônes (petits SVG inline)
  const IconEdit = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none"
         viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
  const IconTrash = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none"
         viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
  const IconToggle = ({on}:{on:boolean}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none"
         viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
         className={on ? "text-green-600" : "text-gray-400"}>
      <rect x="3" y="8" width="18" height="8" rx="4"></rect>
      <circle cx={on ? 17 : 7} cy="12" r="3"></circle>
    </svg>
  );

  return (
    <div className="p-4 space-y-8">
      <h1 className="text-xl font-semibold">Paramétrage</h1>

      {/* Année */}
      <section className="grid md:grid-cols-2 gap-6 items-start auto-rows-min">
        <div className="border rounded-xl p-4 bg-white self-start">
          <h2 className="font-semibold mb-3">Créer une année</h2>
          <form onSubmit={createYear} className="space-y-3">
            <input
              className="border p-2 w-full rounded"
              placeholder='Ex: "2024-2025"'
              value={yearLabel}
              onChange={(e) => setYearLabel(e.target.value)}
              required
            />
            <button className="bg-blue-600 text-white px-4 py-2 rounded">
              Enregistrer
            </button>
          </form>
        </div>

        <div className="border rounded-xl p-4 bg-white self-start max-h-[360px] overflow-y-auto overscroll-contain pr-2">
          <h3 className="font-medium mb-2">Dernières années</h3>
          <ul className="text-sm divide-y">
            {yearsSorted.slice(0, 6).map((y) => (
              <li key={y.id} className="flex items-center justify-between py-2">
                <span>{y.label}</span>
                <div className="flex items-center gap-2 text-gray-600">
                  <button
                    onClick={() => editYear(y)}
                    className="p-1 rounded hover:bg-gray-200"
                    title="Modifier"
                    aria-label="Modifier année"
                  >
                    <IconEdit />
                  </button>
                  <button
                    onClick={() => deleteYear(y)}
                    className="p-1 rounded hover:bg-red-50 hover:text-red-600"
                    title="Supprimer"
                    aria-label="Supprimer année"
                  >
                    <IconTrash />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Zone */}
      <section className="grid md:grid-cols-2 gap-6 items-start auto-rows-min">
        <div className="border rounded-xl p-4 bg-white self-start">
          <h2 className="font-semibold mb-3">Créer une zone</h2>
          <form onSubmit={createZone} className="space-y-3">
            <input
              className="border p-2 w-full rounded"
              placeholder='Ex: "Europe"'
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              required
            />
            <button className="bg-blue-600 text-white px-4 py-2 rounded">
              Enregistrer
            </button>
          </form>
        </div>

        <div className="border rounded-xl p-4 bg-white self-start max-h-[360px] overflow-y-auto overscroll-contain pr-2">
          <h3 className="font-medium mb-2">Zones</h3>
          <ul className="text-sm divide-y">
            {zonesSorted.slice(0, 8).map((z) => (
              <li key={z.id} className="flex items-center justify-between py-2">
                <span>{z.name}</span>
                <div className="flex items-center gap-2 text-gray-600">
                  <button
                    onClick={() => editZone(z)}
                    className="p-1 rounded hover:bg-gray-200"
                    title="Modifier"
                    aria-label="Modifier zone"
                  >
                    <IconEdit />
                  </button>
                  <button
                    onClick={() => deleteZone(z)}
                    className="p-1 rounded hover:bg-red-50 hover:text-red-600"
                    title="Supprimer"
                    aria-label="Supprimer zone"
                  >
                    <IconTrash />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Sous-zone */}
      <section className="grid md:grid-cols-2 gap-6 items-start auto-rows-min">
        <div className="border rounded-xl p-4 bg-white self-start">
          <h2 className="font-semibold mb-3">Créer une sous-zone</h2>
          <form onSubmit={createSubzone} className="space-y-3">
            <select
              className="border p-2 w-full rounded"
              value={subzoneZoneId}
              onChange={(e) => setSubzoneZoneId(e.target.value)}
              required
            >
              <option value="">-- Zone --</option>
              {zonesSorted.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>

            <input
              className="border p-2 w-full rounded"
              placeholder='Ex: "France"'
              value={subzoneName}
              onChange={(e) => setSubzoneName(e.target.value)}
              required
            />

            <button className="bg-blue-600 text-white px-4 py-2 rounded">
              Enregistrer
            </button>
          </form>
        </div>

        <div className="border rounded-xl p-4 bg-white self-start max-h-[360px] overflow-y-auto overscroll-contain pr-2">
          <h3 className="font-medium mb-2">Sous-zones</h3>
          <ul className="text-sm divide-y">
            {subzonesSorted.slice(0, 10).map((s) => {
              const z = zonesSorted.find((zz) => zz.id === s.zoneId);
              return (
                <li key={s.id} className="flex items-center justify-between py-2">
                  <span>
                    {s.name}
                    <span className="text-gray-500"> ({z?.name ?? "?"})</span>
                  </span>
                  <div className="flex items-center gap-2 text-gray-600">
                    <button
                      onClick={() => editSubzone(s)}
                      className="p-1 rounded hover:bg-gray-200"
                      title="Modifier"
                      aria-label="Modifier sous-zone"
                    >
                      <IconEdit />
                    </button>
                    <button
                      onClick={() => deleteSubzone(s)}
                      className="p-1 rounded hover:bg-red-50 hover:text-red-600"
                      title="Supprimer"
                      aria-label="Supprimer sous-zone"
                    >
                      <IconTrash />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Service */}
      <section className="grid md:grid-cols-2 gap-6 items-start auto-rows-min">
        <div className="border rounded-xl p-4 bg-white self-start">
          <h2 className="font-semibold mb-3">Créer un service</h2>
          <form onSubmit={createService} className="space-y-3">
            <input
              className="border p-2 w-full rounded"
              placeholder='Ex: "Service Instruments"'
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              required
            />
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={serviceActive}
                onChange={(e) => setServiceActive(e.target.checked)}
              />
              Actif
            </label>
            <div>
              <button className="bg-blue-600 text-white px-4 py-2 rounded">
                Enregistrer
              </button>
            </div>
          </form>
        </div>

        <div className="border rounded-xl p-4 bg-white self-start max-h-[360px] overflow-y-auto overscroll-contain pr-2">
          <h3 className="font-medium mb-2">Services</h3>
          <ul className="text-sm divide-y">
            {servicesSorted.slice(0, 12).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2">
                <span className="flex items-center gap-2">
                  {s.name}
                  <span className={`ml-2 text-xs ${s.active ? "text-green-600" : "text-gray-500"}`}>
                    {s.active ? "Actif" : "Inactif"}
                  </span>
                </span>
                <div className="flex items-center gap-2 text-gray-600">
                  {/* Toggle actif/inactif */}
                  <button
                    onClick={() => toggleServiceActive(s)}
                    className="p-1 rounded hover:bg-gray-100"
                    title={s.active ? "Désactiver" : "Activer"}
                    aria-label="Basculer état service"
                  >
                    <IconToggle on={!!s.active} />
                  </button>

                  {/* Éditer */}
                  <button
                    onClick={() => editService(s)}
                    className="p-1 rounded hover:bg-gray-200"
                    title="Modifier"
                    aria-label="Modifier service"
                  >
                    <IconEdit />
                  </button>

                  {/* Supprimer */}
                  <button
                    onClick={() => deleteService(s)}
                    className="p-1 rounded hover:bg-red-50 hover:text-red-600"
                    title="Supprimer"
                    aria-label="Supprimer service"
                  >
                    <IconTrash />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

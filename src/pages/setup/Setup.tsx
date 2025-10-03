
import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  where,
  serverTimestamp,
  limit,
} from "firebase/firestore";
import { db } from "../../firebase";

type Opt = { id: string; label?: string; name?: string; yearId?: string; zoneId?: string; active?: boolean };

export default function Setup() {
  // Data stores
  const [years, setYears] = useState<Opt[]>([]);
  const [zones, setZones] = useState<Opt[]>([]);
  const [subzones, setSubzones] = useState<Opt[]>([]);
  const [services, setServices] = useState<Opt[]>([]);

  // Forms
  const [yearLabel, setYearLabel] = useState("");
  const [zoneYearId, setZoneYearId] = useState("");
  const [zoneName, setZoneName] = useState("");
  const [subzoneYearId, setSubzoneYearId] = useState("");
  const [subzoneZoneId, setSubzoneZoneId] = useState("");
  const [subzoneName, setSubzoneName] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [serviceActive, setServiceActive] = useState(true);

  // Load initial data
  useEffect(() => {
    (async () => {
      const yq = query(collection(db, "years"), orderBy("createdAt", "desc"));
      const ys = await getDocs(yq);
      setYears(ys.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));

      const zq = query(collection(db, "zones"), orderBy("name"));
      const zs = await getDocs(zq);
      setZones(zs.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));

      const szq = query(collection(db, "subzones"), orderBy("name"));
      const szz = await getDocs(szq);
      setSubzones(szz.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));

      const svq = query(collection(db, "services"), orderBy("name"));
      const svs = await getDocs(svq);
      setServices(svs.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    })();
  }, []);

  // Filter zones by selected year (for Subzone form)
  const zonesForSubzone = useMemo(() => {
    if (!subzoneYearId) return [];
    return zones.filter((z) => z.yearId === subzoneYearId);
  }, [zones, subzoneYearId]);

  // Create handlers
  async function createYear(e: React.FormEvent) {
    e.preventDefault();
    if (!yearLabel.trim()) return;
    const ref = await addDoc(collection(db, "years"), {
      label: yearLabel.trim(),
      createdAt: serverTimestamp(),
    });
    setYears([{ id: ref.id, label: yearLabel.trim() }, ...years]);
    setYearLabel("");
  }

  async function createZone(e: React.FormEvent) {
    e.preventDefault();
    if (!zoneName.trim() || !zoneYearId) return;
    const ref = await addDoc(collection(db, "zones"), {
      name: zoneName.trim(),
      yearId: zoneYearId,
      createdAt: serverTimestamp(),
    });
    setZones([{ id: ref.id, name: zoneName.trim(), yearId: zoneYearId }, ...zones]);
    setZoneName("");
  }

  async function createSubzone(e: React.FormEvent) {
    e.preventDefault();
    if (!subzoneName.trim() || !subzoneZoneId) return;
    const ref = await addDoc(collection(db, "subzones"), {
      name: subzoneName.trim(),
      zoneId: subzoneZoneId,
      createdAt: serverTimestamp(),
    });
    setSubzones([{ id: ref.id, name: subzoneName.trim(), zoneId: subzoneZoneId }, ...subzones]);
    setSubzoneName("");
  }

  async function createService(e: React.FormEvent) {
    e.preventDefault();
    if (!serviceName.trim()) return;
    const ref = await addDoc(collection(db, "services"), {
      name: serviceName.trim(),
      active: serviceActive,
      createdAt: serverTimestamp(),
    });
    setServices([{ id: ref.id, name: serviceName.trim(), active: serviceActive }, ...services ]);
    setServiceName("");
    setServiceActive(true);
  }

  return (
    <div className="p-4 space-y-8">
      <h1 className="text-xl font-semibold">Paramétrage</h1>

      {/* Année */}
      <section className="grid md:grid-cols-2 gap-6">
        <div className="border rounded-xl p-4 bg-white">
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
        <div className="border rounded-xl p-4 bg-white">
          <h3 className="font-medium mb-2">Dernières années</h3>
          <ul className="text-sm space-y-1">
            {years.slice(0, 6).map((y) => (
              <li key={y.id} className="flex justify-between border-b py-1">
                <span>{y.label}</span>
                <span className="text-gray-500">{y.id.slice(0, 6)}…</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Zone */}
      <section className="grid md:grid-cols-2 gap-6">
        <div className="border rounded-xl p-4 bg-white">
          <h2 className="font-semibold mb-3">Créer une zone</h2>
          <form onSubmit={createZone} className="space-y-3">
            <select
              className="border p-2 w-full rounded"
              value={zoneYearId}
              onChange={(e) => setZoneYearId(e.target.value)}
              required
            >
              <option value="">-- Sélectionne l'année --</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label}
                </option>
              ))}
            </select>
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
        <div className="border rounded-xl p-4 bg-white">
          <h3 className="font-medium mb-2">Zones récentes</h3>
          <ul className="text-sm space-y-1">
            {zones.slice(0, 8).map((z) => (
              <li key={z.id} className="flex justify-between border-b py-1">
                <span>
                  {z.name}{" "}
                  <span className="text-gray-500">
                    ({years.find((y) => y.id === z.yearId)?.label ?? "?"})
                  </span>
                </span>
                <span className="text-gray-500">{z.id.slice(0, 6)}…</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Sous-zone */}
      <section className="grid md:grid-cols-2 gap-6">
        <div className="border rounded-xl p-4 bg-white">
          <h2 className="font-semibold mb-3">Créer une sous-zone</h2>
          <form onSubmit={createSubzone} className="space-y-3">
            <select
              className="border p-2 w-full rounded"
              value={subzoneYearId}
              onChange={(e) => {
                setSubzoneYearId(e.target.value);
                setSubzoneZoneId("");
              }}
              required
            >
              <option value="">-- Année --</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label}
                </option>
              ))}
            </select>
            <select
              className="border p-2 w-full rounded"
              value={subzoneZoneId}
              onChange={(e) => setSubzoneZoneId(e.target.value)}
              required
              disabled={!subzoneYearId}
            >
              <option value="">-- Zone --</option>
              {zonesForSubzone.map((z) => (
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
        <div className="border rounded-xl p-4 bg-white">
          <h3 className="font-medium mb-2">Sous-zones récentes</h3>
          <ul className="text-sm space-y-1">
            {subzones.slice(0, 10).map((s) => {
              const z = zones.find((zz) => zz.id === s.zoneId);
              const y = years.find((yy) => yy.id === z?.yearId);
              return (
                <li key={s.id} className="flex justify-between border-b py-1">
                  <span>
                    {s.name}{" "}
                    <span className="text-gray-500">
                      ({y?.label ?? "?"} / {z?.name ?? "?"})
                    </span>
                  </span>
                  <span className="text-gray-500">{s.id.slice(0, 6)}…</span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Service */}
      <section className="grid md:grid-cols-2 gap-6">
        <div className="border rounded-xl p-4 bg-white">
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
            <button className="bg-blue-600 text-white px-4 py-2 rounded">
              Enregistrer
            </button>
          </form>
        </div>
        <div className="border rounded-xl p-4 bg-white">
          <h3 className="font-medium mb-2">Services</h3>
          <ul className="text-sm space-y-1">
            {services.slice(0, 12).map((s) => (
              <li key={s.id} className="flex justify-between border-b py-1">
                <span>
                  {s.name}{" "}
                  <span className={`ml-2 text-xs ${s.active ? "text-green-600" : "text-gray-500"}`}>
                    {s.active ? "Actif" : "Inactif"}
                  </span>
                </span>
                <span className="text-gray-500">{s.id.slice(0, 6)}…</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

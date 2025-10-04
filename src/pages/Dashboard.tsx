import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Activity } from "../types";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

type Year = { id: string; label: string };
type Zone = { id: string; name: string };
type Subzone = { id: string; name: string; zoneId: string };

export default function Dashboard() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  // Référentiels
  const [years, setYears] = useState<Year[]>([]);
  const [zonesAll, setZonesAll] = useState<Zone[]>([]);
  const [subzonesAll, setSubzonesAll] = useState<Subzone[]>([]);

  // Filtres
  const [filterYearId, setFilterYearId] = useState<string>("");
  const [filterZoneId, setFilterZoneId] = useState<string>("");
  const [filterSubzoneId, setFilterSubzoneId] = useState<string>("");
  const [searchLabel, setSearchLabel] = useState<string>("");
  const [periodStart, setPeriodStart] = useState<string>(""); // yyyy-mm-dd
  const [periodEnd, setPeriodEnd] = useState<string>("");     // yyyy-mm-dd

  const { role } = useAuth();
  const isManager = role === "pdd_admin" || role === "pdd_respo";

  // Helpers
  function tsToDate(d: any): Date | null {
    try {
      if (!d) return null;
      if (typeof d?.toDate === "function") return d.toDate();
      if (d instanceof Date) return d;
      const parsed = new Date(d);
      return isNaN(parsed.getTime()) ? null : parsed;
    } catch { return null; }
  }

  // Charge activités (live), tri par startDate desc
  useEffect(() => {
    setLoading(true);
    const qAct = query(
      collection(db, "activities"),
      orderBy("startDate", "desc"),
      limit(200)
    );
    const unsub = onSnapshot(qAct, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Activity[];
      setActivities(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Référentiels
  useEffect(() => {
    (async () => {
      const [ys, zs, szs] = await Promise.all([
        getDocs(collection(db, "years")),
        getDocs(collection(db, "zones")),
        getDocs(collection(db, "subzones")),
      ]);
      setYears(ys.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setZonesAll(zs.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setSubzonesAll(szs.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    })();
  }, []);

  // Maps affichage
  const yearLabelById = useMemo(
    () => Object.fromEntries(years.map((y) => [y.id, y.label])),
    [years]
  );
  const zoneNameById = useMemo(
    () => Object.fromEntries(zonesAll.map((z) => [z.id, z.name])),
    [zonesAll]
  );
  const subzoneById = useMemo(
    () => Object.fromEntries(subzonesAll.map((s) => [s.id, s])),
    [subzonesAll]
  );

  // Déduction zone depuis subzone
  function zoneNameFromSubzoneId(subzoneId?: string) {
    if (!subzoneId) return "?";
    const sz = subzoneById[subzoneId];
    if (!sz) return "?";
    return zoneNameById[sz.zoneId] ?? "?";
  }

  // Options de sous-zones filtrées par zone (pour le sélecteur)
  const subzonesForFilter = useMemo(() => {
    if (!filterZoneId) return subzonesAll;
    return subzonesAll.filter((s) => s.zoneId === filterZoneId);
  }, [filterZoneId, subzonesAll]);

  // Appliquer les filtres côté client
  const filtered = useMemo(() => {
    const startBound = periodStart ? new Date(periodStart) : null;
    const endBound   = periodEnd ? new Date(periodEnd) : null;

    return activities.filter((a) => {
      // 1) Année
      if (filterYearId && (a as any).yearId !== filterYearId) return false;

      // 2) Zone via subzone
      if (filterZoneId) {
        const sz = subzoneById[(a as any).subzoneId];
        if (!sz || sz.zoneId !== filterZoneId) return false;
      }

      // 3) Sous-zone
      if (filterSubzoneId && (a as any).subzoneId !== filterSubzoneId) return false;

      // 4) Libellé (contains, insensible à la casse)
      if (searchLabel.trim()) {
        const needle = searchLabel.trim().toLowerCase();
        const label = (a.label || "").toLowerCase();
        if (!label.includes(needle)) return false;
      }

      // 5) Période — on filtre par chevauchement d’intervalles :
      // activité [aStart, aEnd] doit intersecter filtre [startBound, endBound]
      if (startBound || endBound) {
        const aStart = tsToDate((a as any).startDate);
        const aEnd   = tsToDate((a as any).endDate) || aStart;
        if (!aStart) return false;

        // Définir bornes manquantes comme -∞/+∞
        const fStart = startBound ?? new Date(-8640000000000000); // min Date
        const fEnd   = endBound   ?? new Date( 8640000000000000); // max Date

        // Test de chevauchement : aEnd >= fStart && aStart <= fEnd
        if ((aEnd ?? aStart) < fStart || aStart > fEnd) return false;
      }

      return true;
    });
  }, [activities, filterYearId, filterZoneId, filterSubzoneId, searchLabel, periodStart, periodEnd, subzoneById]);

  // Réinitialisation des filtres
  function resetFilters() {
    setFilterYearId("");
    setFilterZoneId("");
    setFilterSubzoneId("");
    setSearchLabel("");
    setPeriodStart("");
    setPeriodEnd("");
  }

  return (
    <div className="p-4 space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Activités</h1>
        {isManager && (
          <Link
            to="/activities/new"
            className="bg-blue-600 text-white px-3 py-2 rounded"
          >
            + Nouvelle activité
          </Link>
        )}
      </div>

      {/* Filtres */}
      <div className="border rounded-xl bg-white p-3">
        <div className="grid md:grid-cols-5 gap-2">
          {/* Année */}
          <select
            value={filterYearId}
            onChange={(e) => setFilterYearId(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="">Toutes les années</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>{y.label}</option>
            ))}
          </select>

          {/* Zone */}
          <select
            value={filterZoneId}
            onChange={(e) => {
              setFilterZoneId(e.target.value);
              setFilterSubzoneId(""); // reset subzone quand zone change
            }}
            className="border p-2 rounded"
          >
            <option value="">Toutes les zones</option>
            {zonesAll.map((z) => (
              <option key={z.id} value={z.id}>{z.name}</option>
            ))}
          </select>

          {/* Sous-zone */}
          <select
            value={filterSubzoneId}
            onChange={(e) => setFilterSubzoneId(e.target.value)}
            className="border p-2 rounded"
            disabled={!filterZoneId}
          >
            <option value="">
              {filterZoneId ? "Toutes les sous-zones" : "Choisir une zone d'abord"}
            </option>
            {subzonesForFilter.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* Libellé */}
          <input
            className="border p-2 rounded"
            placeholder="Rechercher un libellé…"
            value={searchLabel}
            onChange={(e) => setSearchLabel(e.target.value)}
          />

          {/* Période (debut/fin) */}
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              className="border p-2 rounded"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              title="Début de période"
            />
            <input
              type="date"
              className="border p-2 rounded"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              title="Fin de période"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-sm">
          <div className="text-gray-500">
            {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
          </div>
          <button
            onClick={resetFilters}
            className="border px-3 py-1 rounded hover:bg-gray-50"
          >
            Réinitialiser
          </button>
        </div>
      </div>

      {/* Liste */}
      {loading && <div>Chargement…</div>}
      {!loading && filtered.length === 0 && (
        <div className="text-gray-600">Aucune activité ne correspond aux filtres.</div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((a) => {
          const start =
            (a as any).startDate?.toDate?.().toLocaleDateString("fr-FR") ?? "";
          const end =
            (a as any).endDate?.toDate?.().toLocaleDateString("fr-FR") ?? "";
          const yearLabel = yearLabelById[(a as any).yearId] ?? "?";
          const zoneName = zoneNameFromSubzoneId((a as any).subzoneId);
          const subzoneName = subzoneById[(a as any).subzoneId]?.name ?? "?";

          return (
            <div key={a.id} className="border rounded-xl p-4 space-y-2 bg-white">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{a.label}</h2>
                <span title={a.isComplete ? "Complet" : "Incomplet"}>
                  {a.isComplete ? "🟢" : "🟠"}
                </span>
              </div>
              <div className="text-sm text-gray-600">{start} → {end}</div>

              <div className="text-xs text-gray-500">
                {yearLabel} / {zoneName} / {subzoneName}
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

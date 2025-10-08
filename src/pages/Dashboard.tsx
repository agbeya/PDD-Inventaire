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
  function fmtDateTime(d: any, fallback = ""): string {
    const val = tsToDate(d);
    if (!val) return fallback;
    return `${val.toLocaleDateString("fr-FR")} ${val.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
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
        <h1 className="text-2xl font-bold tracking-tight text-gray-800 flex items-center gap-2">
          <span role="img" aria-label="stats">📊</span>
          Activités
        </h1>
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
        {/* Ligne unique : filtres + bouton Réinitialiser */}
        <div className="flex flex-wrap items-end gap-2">
          {/* Année */}
          <select
            value={filterYearId}
            onChange={(e) => setFilterYearId(e.target.value)}
            className="border p-2 rounded flex-1 min-w-[120px]"
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
              setFilterSubzoneId("");
            }}
            className="border p-2 rounded flex-1 min-w-[120px]"
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
            className="border p-2 rounded flex-1 min-w-[150px]"
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
            className="border p-2 rounded flex-1 min-w-[150px]"
            placeholder="Rechercher un libellé…"
            value={searchLabel}
            onChange={(e) => setSearchLabel(e.target.value)}
          />

          {/* Dates */}
          <div className="flex gap-2">
            <input
              type="date"
              className="border p-2 rounded"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
            <input
              type="date"
              className="border p-2 rounded"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </div>

          {/* Bouton Réinitialiser sur la même ligne */}
          <button
            onClick={resetFilters}
            className="border px-3 py-2 rounded hover:bg-gray-50 whitespace-nowrap"
          >
            Réinitialiser
          </button>
        </div>

        {/* Résumé résultats */}
        <div className="mt-2 text-sm text-gray-500">
          {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
        </div>
      </div>


      {/* Liste */}
      {loading && <div>Chargement…</div>}
      {!loading && filtered.length === 0 && (
        <div className="text-gray-600">Aucune activité ne correspond aux filtres.</div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((a) => {
          const start = (a as any).startDate?.toDate?.().toLocaleDateString("fr-FR") ?? "";
          const end = (a as any).endDate?.toDate?.().toLocaleDateString("fr-FR") ?? "";
          const yearLabel = yearLabelById[(a as any).yearId] ?? "?";
          const zoneName = zoneNameFromSubzoneId((a as any).subzoneId);
          const subzoneName = subzoneById[(a as any).subzoneId]?.name ?? "?";
          const createdAt = fmtDateTime((a as any).createdAt, "");
          const createdByName = (a as any).createdByName ?? "";

          // 🎨 Couleur de fond selon complétion
          const bgColor = a.isComplete
            ? "bg-green-100 hover:bg-green-200 border-green-400"
            : "bg-orange-100 hover:bg-orange-200 border-orange-400";

          return (
            <Link
              key={a.id}
              to={`/activities/${a.id}/inventory`}
              className={`
                block border rounded-xl p-4 space-y-2 transition-all duration-300 ease-out 
                transform hover:scale-[1.02] hover:shadow-lg 
                ${a.isComplete 
                  ? "bg-green-100 hover:bg-green-200 border-green-400" 
                  : "bg-orange-100 hover:bg-orange-200 border-orange-400"}
              `}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold truncate" style={{ maxWidth: "70%" }}>{a.label}</h2>
                <span className="text-xs font-medium uppercase">
                  {a.isComplete ? "Complet" : "Incomplet"}
                </span>
              </div>

              <div className="text-sm text-gray-700">
                {start} → {end}
              </div>

              <div className="text-xs text-gray-600">
                {yearLabel} / {zoneName} / {subzoneName}
              </div>

              <div className="text-sm">
                Retours : {a.itemsReturned ?? 0}/{a.itemsTotal ?? 0}
              </div>

              {/* Ajout : Créateur et date de création */}
              <div className="text-xs text-gray-400 mt-1">
                {createdAt
                  ? <>Créée le {createdAt}{createdByName ? <> par {createdByName}</> : null}</>
                  : <>Date de création inconnue</>
                }
              </div>
            </Link>
          );
        })}
      </div>

    </div>
  );
}

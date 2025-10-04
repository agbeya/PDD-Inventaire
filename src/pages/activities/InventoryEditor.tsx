import { useAuth } from "../../contexts/AuthContext";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, serverTimestamp, orderBy
} from "firebase/firestore";
import { db } from "../../firebase";
import type { Activity, Item, Service } from "../../types";

// PDF utils
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// ==== Helpers dates
function tsToDate(d: any): Date | null {
  if (!d) return null;
  if (typeof d?.toDate === "function") return d.toDate();
  if (d instanceof Date) return d;
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : parsed;
}
function fmtDate(d: any, fallback = ""): string {
  const val = tsToDate(d);
  if (!val) return fallback;
  return format(val, "dd/MM/yyyy", { locale: fr });
}
function fmtDateTime(d: any, fallback = ""): string {
  const val = tsToDate(d);
  if (!val) return fallback;
  return format(val, "dd/MM/yyyy HH:mm", { locale: fr });
}

type EditDraft = { name: string; qty: number };

export default function InventoryEditor() {
  const { activityId } = useParams();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [itemsByService, setItemsByService] = useState<Record<string, Item[]>>({});
  const [observations, setObservations] = useState<string>("");
  const [savingObs, setSavingObs] = useState(false);
  const [loading, setLoading] = useState(true);

  // UI: filtre global (n’afficher que les objets non retournés)
  const [showOnlyPending, setShowOnlyPending] = useState(false);

  // UI: ajout inline par service
  const [addRowOpen, setAddRowOpen] = useState<Record<string, boolean>>({});
  const [addDraft, setAddDraft] = useState<Record<string, { name: string; qty: string }>>({});

  // UI: édition inline par item
  const [editing, setEditing] = useState<Record<string, EditDraft>>({});
  const [busyItemIds, setBusyItemIds] = useState<Set<string>>(new Set());
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      if (!activityId) return;
      setLoading(true);
      const a = await getDoc(doc(db, "activities", activityId));
      const data = a.data() as any;
      setActivity({ id: a.id, ...data });
      setObservations((data?.observations ?? "").toString());

      const sv = await getDocs(query(collection(db, "services")));
      const allSv = sv.docs
        .map(d => ({ id: d.id, ...(d.data() as any) }))
        .filter(s => s.active !== false);
      setServices(allSv);

      const res: Record<string, Item[]> = {};
      for (const s of allSv) {
        const snap = await getDocs(query(
          collection(db, "activities", activityId, "serviceItems", s.id, "items"),
          orderBy("createdAt", "asc")
        ));
        res[s.id] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      }
      setItemsByService(res);
      setLoading(false);
    })();
  }, [activityId]);

  async function saveObservations() {
    if (!activityId) return;
    try {
      setSavingObs(true);
      await updateDoc(doc(db, "activities", activityId), {
        observations: observations.trim(),
        updatedAt: serverTimestamp(),
      });
    } finally {
      setSavingObs(false);
    }
  }

  // === Ajout inline
  function openAddRow(serviceId: string) {
    setAddRowOpen(prev => ({ ...prev, [serviceId]: true }));
    setAddDraft(prev => ({ ...prev, [serviceId]: { name: "", qty: "1" } }));
  }
  function cancelAddRow(serviceId: string) {
    setAddRowOpen(prev => ({ ...prev, [serviceId]: false }));
    setAddDraft(prev => {
      const { [serviceId]: _, ...rest } = prev;
      return rest;
    });
  }
  async function submitAddRow(serviceId: string) {
    if (!activityId) return;
    const d = addDraft[serviceId];
    const name = (d?.name ?? "").trim();
    const qty = Number(d?.qty ?? "1") || 1;
    if (!name) return;

    const nowServer = serverTimestamp();
    const ref = await addDoc(
      collection(db, "activities", activityId, "serviceItems", serviceId, "items"),
      {
        activityId,
        name,
        qty,
        sortieChecked: true,
        sortieAt: nowServer,              // en base: horodatage serveur
        retourChecked: false,
        retourAt: null,
        createdAt: nowServer,
        updatedAt: nowServer,
      }
    );

    // ✅ État local optimiste avec Date() pour affichage immédiat (sortieAt/createdAt/updatedAt)
    const nowLocal = new Date();
    setItemsByService(prev => ({
      ...prev,
      [serviceId]: [
        ...(prev[serviceId] || []),
        {
          id: ref.id,
          name,
          qty,
          sortieChecked: true,
          sortieAt: nowLocal,             // << affiche tout de suite
          retourChecked: false,
          retourAt: null,
          createdAt: nowLocal,
          updatedAt: nowLocal,
        } as any,
      ],
    }));
    cancelAddRow(serviceId);
  }

  // === Toggle retour
  async function toggleRetour(serviceId: string, item: Item) {
    if (!activityId) return;
    setBusyItemIds(prev => new Set(prev).add(item.id));

    const retourChecked = !item.retourChecked;
    await updateDoc(
      doc(db, "activities", activityId, "serviceItems", serviceId, "items", item.id),
      {
        retourChecked,
        retourAt: retourChecked ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      }
    );

    // ✅ État local optimiste pour retourAt
    setItemsByService(prev => ({
      ...prev,
      [serviceId]: prev[serviceId].map(it =>
        it.id === item.id
          ? {
              ...it,
              retourChecked,
              retourAt: retourChecked ? new Date() : null, // << ici
              updatedAt: new Date(),
            }
          : it
      ),
    }));

    setBusyItemIds(prev => {
      const n = new Set(prev);
      n.delete(item.id);
      return n;
    });
  }

  // === Edit inline
  function startEdit(item: Item) {
    setEditing(prev => ({ ...prev, [item.id]: { name: item.name || "", qty: Number(item.qty || 1) } }));
  }
  function cancelEdit(itemId: string) {
    setEditing(prev => {
      const { [itemId]: _, ...rest } = prev;
      return rest;
    });
  }
  async function saveEdit(serviceId: string, item: Item) {
    if (!activityId) return;
    const draft = editing[item.id];
    if (!draft) return;
    setBusyItemIds(prev => new Set(prev).add(item.id));
    const ref = doc(db, "activities", activityId, "serviceItems", serviceId, "items", item.id);
    await updateDoc(ref, {
      name: draft.name.trim(),
      qty: Number(draft.qty) || 1,
      updatedAt: serverTimestamp(),
    });
    setItemsByService(prev => ({
      ...prev,
      [serviceId]: prev[serviceId].map(it =>
        it.id === item.id ? { ...it, name: draft.name.trim(), qty: Number(draft.qty) || 1 } : it
      )
    }));
    cancelEdit(item.id);
    setBusyItemIds(prev => {
      const n = new Set(prev);
      n.delete(item.id);
      return n;
    });
  }

  // === Delete
  async function deleteItem(serviceId: string, item: Item) {
    if (!activityId) return;
    if (!confirm(`Supprimer "${item.name}" ?`)) return;
    setBusyItemIds(prev => new Set(prev).add(item.id));
    const ref = doc(db, "activities", activityId, "serviceItems", serviceId, "items", item.id);
    await deleteDoc(ref);
    setItemsByService(prev => ({
      ...prev,
      [serviceId]: prev[serviceId].filter(it => it.id !== item.id)
    }));
    setBusyItemIds(prev => {
      const n = new Set(prev);
      n.delete(item.id);
      return n;
    });
  }

  // === Tout retourner (pour un service)
  async function markAllReturned(serviceId: string) {
    if (!activityId) return;
    const items = (itemsByService[serviceId] || []).filter(i => !i.retourChecked);
    if (items.length === 0) return;
    if (!confirm(`Marquer ${items.length} objet(s) comme retourné(s) ?`)) return;

    for (const it of items) {
      const ref = doc(db, "activities", activityId, "serviceItems", serviceId, "items", it.id);
      await updateDoc(ref, {
        retourChecked: true,
        retourAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    setItemsByService(prev => ({
      ...prev,
      [serviceId]: (prev[serviceId] || []).map(i => ({ ...i, retourChecked: true, retourAt: new Date() }))
    }));
  }

  // Statistiques live
  const stats = useMemo(() => {
    const all = Object.values(itemsByService).flat();
    const total = all.length;
    const returned = all.filter(i => i.retourChecked).length;
    return { total, returned, complete: total > 0 && total === returned };
  }, [itemsByService]);

  // Synchronise les compteurs activité
  useEffect(() => {
    if (!activityId) return;
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

  // Export PDF
  function exportPdf() {
    if (!activity) return;

    const exportedBy = user?.email ?? "Utilisateur inconnu";
    const nowStr = format(new Date(), "dd/MM/yyyy HH:mm", { locale: fr });

    const allItems = Object.values(itemsByService).flat();
    const total = allItems.length;
    const returned = allItems.filter(i => i.retourChecked).length;
    const isCompleteNow = total > 0 && total === returned;

    const docPdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth  = docPdf.internal.pageSize.getWidth();
    const pageHeight = docPdf.internal.pageSize.getHeight();

    const M = { top: 40, right: 40, bottom: 40, left: 40 };
    let y = M.top;

    const ensureSpace = (needed = 0) => {
      if (y + needed > pageHeight - M.bottom) {
        docPdf.addPage();
        y = M.top;
      }
    };

    docPdf.setFont("helvetica", "bold");
    docPdf.setFontSize(14);
    docPdf.text("Fiche des entrées / sorties – Inventaire", pageWidth / 2, y, { align: "center" });
    y += 24;

    docPdf.setFont("helvetica", "normal");
    docPdf.setFontSize(11);

    const startStr = fmtDate((activity as any).startDate, "");
    const endStr   = fmtDate((activity as any).endDate, "");

    ensureSpace(60);
    docPdf.text(`Activité : ${activity.label ?? ""}`, M.left, y); y += 16;
    docPdf.text(`Période : Du ${startStr} au ${endStr}`, M.left, y); y += 16;
    docPdf.text(`Statut : ${isCompleteNow ? "Complet" : "Incomplet"} (${returned}/${total})`, M.left, y);
    y += 24;

    services.forEach((s) => {
      const items = itemsByService[s.id] || [];

      ensureSpace(30);
      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(12);
      docPdf.text(`Service : ${s.name}`, M.left, y);
      y += 10;

      const rows = items.map(it => ([
        it.name || "",
        String(it.qty ?? ""),
        fmtDateTime(it.sortieAt, ""),
        it.sortieChecked ? "Y" : "N",
        fmtDateTime(it.retourAt, ""),
        it.retourChecked ? "Y" : "N",
      ]));

      autoTable(docPdf, {
        startY: y + 4,
        head: [[
          "Désignation du matériel",
          "Qté",
          "Date/heure de sortie",
          "Sortie",
          "Date/heure de retour",
          "Retour",
        ]],
        body: rows.length ? rows : [["(aucun objet)", "", "", "", "", ""]],
        styles: { fontSize: 9, cellPadding: 6 },
        headStyles: { fillColor: [30, 41, 59], textColor: 255 },
        theme: "striped",
        margin: { left: M.left, right: M.right },
        didDrawPage: () => {
          docPdf.setFont("helvetica", "normal");
          docPdf.setFontSize(9);
          const leftText = `Exporté le ${nowStr} — ${exportedBy}`;
          docPdf.text(leftText, M.left, pageHeight - 16, { align: "left" });
          const rightText = `Page ${docPdf.getNumberOfPages()}`;
          docPdf.text(rightText, pageWidth - M.right, pageHeight - 16, { align: "right" });
        },
      });

      // @ts-ignore
      y = (docPdf as any).lastAutoTable.finalY + 10;
    });

    // Observations avec textarea arrondi
    ensureSpace(40 + 80);
    docPdf.setFont("helvetica", "bold");
    docPdf.setFontSize(11);
    docPdf.text("Observations :", M.left, y);
    y += 10;

    const rectHeight = 80;
    const rectWidth  = pageWidth - M.left - M.right;

    docPdf.setDrawColor(30, 41, 59);
    docPdf.roundedRect(M.left, y, rectWidth, rectHeight, 6, 6);

    docPdf.setFont("helvetica", "normal");
    docPdf.setFontSize(10);
    const text = observations.trim().length ? observations.trim() : "Aucune observation.";
    const wrapped = docPdf.splitTextToSize(text, rectWidth - 10);

    let innerY = y + 14;
    for (const line of wrapped) {
      if (innerY > y + rectHeight - 10) break;
      docPdf.text(line, M.left + 5, innerY);
      innerY += 14;
    }
    y += rectHeight + 20;

    const fileName = `Inventaire - ${activity.label ?? activity.id}.pdf`;
    docPdf.save(fileName);
  }

  // ========= RENDER
  const startLabel = activity ? fmtDate((activity as any).startDate, "") : "";
  const endLabel   = activity ? fmtDate((activity as any).endDate, "") : "";

  return (
    <div className="p-4 space-y-4">
      {/* Barre d'action sticky */}
      <div className="sticky top-0 z-10 bg-gray-50/80 backdrop-blur border-b">
        <div className="py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Inventaire : {activity?.label}</h1>
            <div className="text-sm text-gray-600">Période : {startLabel} → {endLabel}</div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm inline-flex items-center gap-2 px-2 py-1 rounded border bg-white">
              <input
                type="checkbox"
                checked={showOnlyPending}
                onChange={(e)=>setShowOnlyPending(e.target.checked)}
              />
              N’afficher que les retours à faire
            </label>
            <button
              onClick={exportPdf}
              className="inline-flex items-center gap-2 border px-3 py-2 rounded hover:bg-white bg-gray-100"
              title="Télécharger en PDF"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M14 2H6a2 2 0 0 0-2 2v12h2V4h8V2Zm4 4H10a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2Zm0 2v12H10V8h8Zm-6 3h4v2h-4v-2Zm0 3h4v2h-4v-2Z" fill="currentColor"/>
              </svg>
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* Statut global */}
      <div className="p-3 border rounded bg-white flex items-center justify-between">
        <div>
          Statut activité : {stats.complete ? "🟢 Complet" : "🟠 Incomplet"} ({stats.returned}/{stats.total} retournés)
        </div>
        <div className="text-xs text-gray-500">
          {loading ? "Chargement…" : "Synchronisé"}
        </div>
      </div>

      {/* Observations UI */}
      <div className="p-3 border rounded bg-white">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Observations</h3>
          <button
            onClick={saveObservations}
            disabled={savingObs}
            className="text-sm bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-60"
          >
            {savingObs ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
        <textarea
          className="w-full border rounded p-2 min-h-[100px]"
          placeholder="Saisir ici les remarques générales, incidents, manquants/retours, etc."
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
        />
        <div className="text-xs text-gray-500 mt-1">
          {observations.trim().length === 0 ? "Aucune observation pour l’instant." : `${observations.length} caractères`}
        </div>
      </div>

      {/* Services */}
      {services.map(s => {
        const list = (itemsByService[s.id] || []);
        const visible = showOnlyPending ? list.filter(i=>!i.retourChecked) : list;
        const returnedCount = list.filter(i=>i.retourChecked).length;

        return (
          <div key={s.id} className="border rounded p-3 bg-white">
            {/* Bandeau service */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h2 className="font-semibold">{s.name}</h2>
                <div className="text-xs text-gray-500">
                  Retours : {returnedCount}/{list.length}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!addRowOpen[s.id] && (
                  <button onClick={() => openAddRow(s.id)} className="text-sm bg-blue-600 text-white px-3 py-1 rounded">
                    + Ajouter un objet
                  </button>
                )}
                <button
                  onClick={() => markAllReturned(s.id)}
                  disabled={list.length === 0 || returnedCount === list.length}
                  className="text-sm border px-3 py-1 rounded disabled:opacity-50"
                  title="Tout marquer comme retourné"
                >
                  Tout retourner
                </button>
              </div>
            </div>

            {/* Ligne d'ajout inline */}
            {addRowOpen[s.id] && (
              <div className="grid grid-cols-12 gap-2 items-center py-3 border-b mt-2 bg-gray-50 rounded">
                <div className="col-span-6">
                  <input
                    autoFocus
                    className="w-full border rounded p-2"
                    placeholder="Désignation du matériel"
                    value={addDraft[s.id]?.name ?? ""}
                    onChange={(e)=>setAddDraft(prev=>({
                      ...prev,
                      [s.id]: { ...(prev[s.id]||{ qty: "1" }), name: e.target.value }
                    }))}
                  />
                </div>
                <div className="col-span-3">
                  <input
                    type="number"
                    min={1}
                    className="w-full border rounded p-2"
                    placeholder="Qté"
                    value={addDraft[s.id]?.qty ?? "1"}
                    onChange={(e)=>setAddDraft(prev=>({
                      ...prev,
                      [s.id]: { ...(prev[s.id]||{ name: "" }), qty: e.target.value }
                    }))}
                  />
                </div>
                <div className="col-span-3 flex justify-end gap-2">
                  <button
                    onClick={()=>submitAddRow(s.id)}
                    className="text-sm bg-blue-600 text-white px-3 py-1 rounded"
                  >
                    Ajouter
                  </button>
                  <button
                    onClick={()=>cancelAddRow(s.id)}
                    className="text-sm border px-3 py-1 rounded"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {/* Liste */}
            <div className="mt-2">
              {visible.length === 0 && (
                <div className="text-gray-500 text-sm py-2">
                  {list.length === 0 ? "Aucun objet" : "Aucun objet en attente de retour"}
                </div>
              )}
              {visible.map(it => {
                const isBusy = busyItemIds.has(it.id);
                const isEditing = !!editing[it.id];
                const draft = editing[it.id];

                return (
                  <div key={it.id} className="grid grid-cols-12 gap-2 items-center py-2 border-b hover:bg-gray-50 transition">
                    {/* Nom + Qté */}
                    <div className="col-span-5">
                      {!isEditing ? (
                        <>
                          <div className="font-medium">{it.name}</div>
                          <div className="text-xs text-gray-500">Qté: {it.qty}</div>
                        </>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <input
                            className="border rounded p-2"
                            value={draft?.name ?? ""}
                            onChange={(e)=>setEditing(prev=>({ ...prev, [it.id]: { ...(prev[it.id] as EditDraft), name: e.target.value } }))}
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              className="border rounded p-2 w-28"
                              value={draft?.qty ?? 1}
                              onChange={(e)=>setEditing(prev=>({ ...prev, [it.id]: { ...(prev[it.id] as EditDraft), qty: Number(e.target.value || 1) } }))}
                            />
                            <span className="text-xs text-gray-500">pièce(s)</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Sortie */}
                    <div className="col-span-3">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" disabled checked={!!it.sortieChecked} />
                        <span>Sortie</span>
                      </label>
                      <div className="text-[11px] text-gray-500">
                        {fmtDateTime(it.sortieAt, "")}
                      </div>
                    </div>

                    {/* Retour */}
                    <div className="col-span-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!it.retourChecked}
                          onChange={() => toggleRetour(s.id, it)}
                          disabled={isBusy}
                        />
                        <span>Retour</span>
                      </label>
                      <div className="text-[11px] text-gray-500">
                        {it.retourChecked ? fmtDateTime(it.retourAt, "") : ""}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="col-span-2 flex justify-end items-center gap-2 text-gray-600">
                      {!isEditing ? (
                        <>
                          <button
                            onClick={() => startEdit(it)}
                            className="p-1 rounded hover:bg-gray-200"
                            title="Modifier"
                            aria-label="Modifier"
                            disabled={isBusy}
                          >
                            {/* Crayon */}
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none"
                              viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteItem(s.id, it)}
                            className="p-1 rounded hover:bg-red-50 hover:text-red-600"
                            title="Supprimer"
                            aria-label="Supprimer"
                            disabled={isBusy}
                          >
                            {/* Corbeille */}
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none"
                              viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18" />
                              <path d="M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            </svg>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => saveEdit(s.id, it)}
                            className="inline-flex items-center gap-1 bg-blue-600 text-white px-3 py-1 rounded text-sm disabled:opacity-60"
                            disabled={isBusy || !(draft?.name?.trim())}
                            title="Enregistrer"
                          >
                            {/* Check */}
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                              stroke="currentColor" strokeWidth="2">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                            Enregistrer
                          </button>
                          <button
                            onClick={() => cancelEdit(it.id)}
                            className="inline-flex items-center gap-1 border px-3 py-1 rounded text-sm"
                            title="Annuler"
                          >
                            {/* X */}
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                              stroke="currentColor" strokeWidth="2">
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                            Annuler
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

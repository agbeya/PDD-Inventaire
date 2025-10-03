import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
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

export default function InventoryEditor() {
  const { activityId } = useParams();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [itemsByService, setItemsByService] = useState<Record<string, Item[]>>({});
  const [observations, setObservations] = useState<string>("");
  const [savingObs, setSavingObs] = useState(false);

  // Chargement activité + services + items
  useEffect(() => {
    (async () => {
      if (!activityId) return;
      const a = await getDoc(doc(db, "activities", activityId));
      const data = a.data() as any;
      setActivity({ id: a.id, ...data });
      setObservations((data?.observations ?? "").toString());

      const sv = await getDocs(query(collection(db, "services")));
      const allSv = sv.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter(s => s.active !== false);
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

  async function addItem(serviceId: string) {
    if (!activityId) return;
    const name = prompt("Nom de l'objet ?");
    if (!name) return;
    const qtyStr = prompt("Quantité ?", "1");
    const qty = Number(qtyStr ?? 1) || 1;
    const sortieChecked = true;
    const now = serverTimestamp();
    const ref = await addDoc(
      collection(db, "activities", activityId, "serviceItems", serviceId, "items"), {
        activityId,
        name, qty,
        sortieChecked, sortieAt: now,
        retourChecked: false, retourAt: null,
        createdAt: now, updatedAt: now
      }
    );
    setItemsByService(prev => ({
      ...prev,
      [serviceId]: [...(prev[serviceId] || []), {
        id: ref.id, name, qty,
        sortieChecked, sortieAt: null,
        retourChecked: false, retourAt: null,
        createdAt: null, updatedAt: null
      }]
    }));
  }

  async function toggleRetour(serviceId: string, item: Item) {
    if (!activityId) return;
    const ref = doc(db, "activities", activityId, "serviceItems", serviceId, "items", item.id);
    const retourChecked = !item.retourChecked;
    await updateDoc(ref, {
      retourChecked,
      retourAt: retourChecked ? serverTimestamp() : null,
      updatedAt: serverTimestamp()
    });
    setItemsByService(prev => ({
      ...prev,
      [serviceId]: prev[serviceId].map(it => it.id === item.id ? { ...it, retourChecked, retourAt: null } : it)
    }));
  }

  const stats = useMemo(() => {
    const all = Object.values(itemsByService).flat();
    const total = all.length;
    const returned = all.filter(i => i.retourChecked).length;
    return { total, returned, complete: total > 0 && total === returned };
  }, [itemsByService]);

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

    // 🔁 Calcule les compteurs à la volée depuis l’état actuel
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
    // ⬇️ on utilise les compteurs recalculés (pas ceux du doc activité)
    docPdf.text(`Statut : ${isCompleteNow ? "Complet" : "Incomplet"} (${returned}/${total})`, M.left, y);
    y += 24;

    // Sections par service
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
            const str = `Page ${docPdf.getNumberOfPages()}`;
            docPdf.text(str, pageWidth - M.right, pageHeight - 16, { align: "right" });
        },
        });

        // @ts-ignore
        y = (docPdf as any).lastAutoTable.finalY + 10;
    });

    // Observations avec "textarea" tracé arrondi
    ensureSpace(40 + 80); // on s’assure d’avoir la place avant de dessiner (40 marge + 80 hauteur du bloc)
    docPdf.setFont("helvetica", "bold");
    docPdf.setFontSize(11);
    docPdf.text("Observations :", M.left, y);
    y += 10;

    // Dimensions du rectangle
    const rectHeight = 80;
    const rectWidth  = pageWidth - M.left - M.right;

    // Cadre arrondi avec couleur entête tableau
    docPdf.setDrawColor(30, 41, 59); 
    docPdf.roundedRect(M.left, y, rectWidth, rectHeight, 6, 6);

    // Texte à l’intérieur du rectangle
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

    // avance y après le bloc
    y += rectHeight + 20;


    const fileName = `Inventaire - ${activity.label ?? activity.id}.pdf`;
    docPdf.save(fileName);
}


  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Inventaire : {activity?.label}</h1>
          <div className="text-sm">
            Période : {(activity as any)?.startDate?.toDate?.()?.toLocaleDateString("fr-FR")} → {(activity as any)?.endDate?.toDate?.()?.toLocaleDateString("fr-FR")}
          </div>
        </div>

        <button
          onClick={exportPdf}
          className="inline-flex items-center gap-2 border px-3 py-2 rounded hover:bg-gray-50"
          title="Télécharger en PDF"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6a2 2 0 0 0-2 2v12h2V4h8V2Zm4 4H10a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2Zm0 2v12H10V8h8Zm-6 3h4v2h-4v-2Zm0 3h4v2h-4v-2Z" fill="currentColor"/>
          </svg>
          PDF
        </button>
      </div>

      <div className="p-3 border rounded bg-white">
        Statut activité : {stats.complete ? "🟢 Complet" : "🟠 Incomplet"} ({stats.returned}/{stats.total} retournés)
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
          placeholder="Saisir ici les remarques générales, incidents, manquants/retards, etc."
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
        />
        <div className="text-xs text-gray-500 mt-1">
          {observations.trim().length === 0 ? "Aucune observation pour l’instant." : `${observations.length} caractères`}
        </div>
      </div>

      {services.map(s => (
        <div key={s.id} className="border rounded p-3 bg-white">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{s.name}</h2>
            <button onClick={() => addItem(s.id)} className="text-sm bg-blue-600 text-white px-3 py-1 rounded">
              + Ajouter un objet
            </button>
          </div>
          <div className="mt-2">
            {(itemsByService[s.id] || []).length === 0 && <div className="text-gray-500 text-sm">Aucun objet</div>}
            {(itemsByService[s.id] || []).map(it => (
              <div key={it.id} className="grid grid-cols-12 gap-2 items-center py-2 border-b">
                <div className="col-span-4">
                  <div className="font-medium">{it.name}</div>
                  <div className="text-xs text-gray-500">Qté: {it.qty}</div>
                </div>
                <div className="col-span-3">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" disabled checked={!!it.sortieChecked} />
                    <span>Sortie</span>
                  </label>
                </div>
                <div className="col-span-3">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!it.retourChecked} onChange={() => toggleRetour(s.id, it)} />
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

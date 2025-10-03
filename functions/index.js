// functions/index.js
"use strict";

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

/**
 * Recalcule les compteurs d'une activité à chaque écriture d'item.
 * - Compte les items via collectionGroup('items') filtrés par activityId
 * - Balaye aussi /activities/{activityId}/serviceItems/*
 *   items pour rattraper d'éventuels anciens items sans activityId
 * - Déduplique par ref.path pour éviter le double-compte
 */
exports.onItemWrite = functions.firestore
  .document("activities/{activityId}/serviceItems/{serviceId}/items/{itemId}")
  .onWrite(async (_change, context) => {
    const { activityId } = context.params;

    // 1) Items ayant activityId (nouvelle logique)
    const cgSnap = await db
      .collectionGroup("items") // <<< guillemets OBLIGATOIRES
      .where("activityId", "==", activityId)
      .get();

    const seen = new Set();
    let total = 0;
    let returned = 0;

    cgSnap.forEach((d) => {
      const p = d.ref.path;
      if (seen.has(p)) return;
      seen.add(p);
      total += 1;
      if (d.get("retourChecked") === true) returned += 1;
    });

    // 2) Rattrapage sous l'activité (anciens items sans activityId)
    const servicesSnap = await db
      .collection(`activities/${activityId}/serviceItems`)
      .get();

    for (const svc of servicesSnap.docs) {
      const its = await svc.ref.collection("items").get();
      its.forEach((d) => {
        const p = d.ref.path;
        if (seen.has(p)) return;
        seen.add(p);
        total += 1;
        if (d.get("retourChecked") === true) returned += 1;
      });
    }

    await db.doc(`activities/${activityId}`).set(
      {
        itemsTotal: total,
        itemsReturned: returned,
        isComplete: total > 0 && total === returned,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

/** Sync du rôle Firestore -> Custom claims Auth */
exports.syncUserRoleToClaims = functions.firestore
  .document("users/{uid}")
  .onWrite(async (change, context) => {
    const { uid } = context.params;
    const after = change.after.exists ? change.after.data() : null;
    if (!after) return null;

    const role = after.role || "pdd_member";
    const allowed = new Set(["pdd_admin", "pdd_respo", "pdd_member"]);
    const safeRole = allowed.has(role) ? role : "pdd_member";

    await admin.auth().setCustomUserClaims(uid, { role: safeRole });
    await db.doc(`users/${uid}`).update({
      claimsSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return null;
  });

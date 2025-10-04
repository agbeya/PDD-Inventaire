const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");

// options globales (region EU pour Paris ; ajuste si besoin)
setGlobalOptions({
  region: "europe-west1",
  memoryMiB: 256,
  timeoutSeconds: 60,
});

/** Recalcule les compteurs d'une activité quand on modifie un item */
exports.onItemWrite = onDocumentWritten(
  "activities/{activityId}/serviceItems/{serviceId}/items/{itemId}",
  async (event) => {
    const { activityId } = event.params;

    // IMPORTANT : ne rien faire au cold start autre que du code léger.
    // Tout I/O (Firestore) doit rester dans le handler.

    const itemsSnap = await db
      .collectionGroup("items")
      .where("activityId", "==", activityId)
      .get();

    const total = itemsSnap.size;
    let returned = 0;
    itemsSnap.forEach((d) => {
      const data = d.data() || {};
      if (data.retourChecked === true) returned++;
    });

    await db.doc(`activities/${activityId}`).set(
      {
        itemsTotal: total,
        itemsReturned: returned,
        isComplete: total > 0 && total === returned,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
);

/** Sync du rôle Firestore -> Custom claims Auth */
exports.syncUserRoleToClaims = onDocumentWritten("users/{uid}", async (event) => {
  const { uid } = event.params;
  const after = event.data?.after?.data() || null;
  if (!after) return;

  const role = after.role || "pdd_member";
  const allowed = new Set(["pdd_admin", "pdd_respo", "pdd_member"]);
  const safeRole = allowed.has(role) ? role : "pdd_member";

  await admin.auth().setCustomUserClaims(uid, { role: safeRole });
  await db.doc(`users/${uid}`).set(
    {
      claimsSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
});


// Cloud Function d'exemple : recompte les items d'une activité
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

exports.onItemWrite = functions.firestore
  .document("activities/{activityId}/serviceItems/{serviceId}/items/{itemId}")
  .onWrite(async (change, context) => {
    const { activityId } = context.params;

    // Recompte simple (pour débuter) : itère chaque service sous l'activité
    const servicesSnap = await db.collection(`activities/${activityId}/serviceItems`).get();
    let total = 0, returned = 0;
    for (const svc of servicesSnap.docs) {
      const its = await svc.ref.collection("items").get();
      total += its.size;
      returned += its.docs.filter(d => d.data().retourChecked === true).length;
    }
    await db.doc(`activities/${activityId}`).update({
      itemsTotal: total,
      itemsReturned: returned,
      isComplete: total > 0 && total === returned,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });


# PDD Inventaire (React + Firebase)

Application de gestion d'inventaire pour PDD (Parole de Dieu) autour des activités, services et objets sortis/retournés.

## Stack
- React + Vite + TypeScript
- Tailwind CSS
- Firebase (Auth + Firestore)
- (Optionnel) Cloud Functions pour compter automatiquement les retours

## Démarrage

1. **Cloner / extraire le projet**, puis :
```bash
npm install
cp .env.example .env   # remplis avec tes variables Firebase
```

2. **Configurer Firebase** :
   - Crée un projet Firebase, active **Auth (Email/Password)** et **Firestore**.
   - Récupère la config Web et mets-la dans `.env`.
   - Déploie l'hébergement si besoin :
     ```bash
     npm run build
     # firebase login
     # firebase init (Hosting + Functions si tu veux)
     # firebase deploy
     ```

3. **Règles Firestore** (exemple de base, à adapter) :
   Va dans Firebase Console → Firestore → Rules et colle celles du fichier `firestore.rules` ci-dessous.

4. **Lancer en local** :
```bash
npm run dev
```

## Structure
- Paramétrage : années, zones, sous-zones, services
- Activités liées à Année → Zone → Sous-zone
- Inventaire par activité : objets par service, sortie/retour, compteur et statut

## Cloud Functions (optionnel)
Dans `functions/index.js` tu as un exemple de fonction pour recalculer le nombre total d'objets et le nombre retourné à chaque modification d'item.
Pour déployer :
```bash
cd functions
npm install
cd ..
# firebase deploy --only functions
```

## Sécurité
Commence avec des règles souples pour le dev, puis restreins par rôles selon ton besoin.

Bon dev !

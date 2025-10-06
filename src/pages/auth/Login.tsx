import { useEffect, useState } from "react";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "../../firebase";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  signOut,
} from "firebase/auth";
import { auth } from "../../firebase";
import { useNavigate } from "react-router-dom";

type EnsureUserExtra = {
  firstName?: string | null;
  lastName?: string | null;
};

export default function Login() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nav = useNavigate();

  // Redirection uniquement si l'utilisateur est actif
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      try {
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);
        const active = (snap.data() as any)?.active === true;
        if (active) {
          nav("/", { replace: true });
        } else {
          await signOut(auth);
          setError("Votre compte est en attente d'activation par un responsable. Vous recevrez un accès une fois validé.");
        }
      } catch {
        // en cas d'erreur de lecture Firestore, on évite de bloquer,
        // mais c'est plus sûr de ne pas rediriger
        await signOut(auth);
        setError("Impossible de vérifier l'état du compte pour l'instant. Réessayez plus tard.");
      }
    });
    return () => unsub();
  }, [nav]);

  // ————————————————————————————————————————————————————————
  // Helpers
  function splitDisplayName(name?: string | null): EnsureUserExtra {
    const n = (name || "").trim();
    if (!n) return { firstName: null, lastName: null };
    const parts = n.split(/\s+/);
    if (parts.length === 1) return { firstName: parts[0], lastName: null };
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
  }

  async function ensureUserDoc(
    uid: string,
    email: string,
    displayName?: string | null,
    photoURL?: string | null,
    extra?: EnsureUserExtra
  ) {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);

    const inferred = splitDisplayName(displayName);
    const first = extra?.firstName ?? inferred.firstName ?? null;
    const last = extra?.lastName ?? inferred.lastName ?? null;

    if (!snap.exists()) {
      await setDoc(ref, {
        email,
        displayName: displayName || null,
        photoURL: photoURL || null,
        firstName: first,
        lastName: last,
        role: "pdd_member",
        active: false, // ⛔️ nouvel utilisateur inactif par défaut
        createdAt: serverTimestamp(),
        claimsSyncedAt: null,
      });
    } else {
      await setDoc(
        ref,
        {
          email,
          displayName: displayName || (snap.data() as any).displayName || null,
          photoURL: photoURL || (snap.data() as any).photoURL || null,
          firstName:
            typeof (snap.data() as any).firstName === "string"
              ? (snap.data() as any).firstName
              : first,
          lastName:
            typeof (snap.data() as any).lastName === "string"
              ? (snap.data() as any).lastName
              : last,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  }

  // ————————————————————————————————————————————————————————
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "login") {
        // Connexion puis vérification "active"
        const cred = await signInWithEmailAndPassword(auth, email, pass);
        const ref = doc(db, "users", cred.user.uid);
        const snap = await getDoc(ref);
        const active = (snap.data() as any)?.active === true;
        if (!active) {
          await signOut(auth);
          setError("Votre compte n'est pas encore activé par un responsable.");
          return;
        }
        // onAuthStateChanged redirigera de toute façon
      } else {
        // Création
        const cred = await createUserWithEmailAndPassword(auth, email, pass);

        // Met à jour le displayName (Prénom Nom) côté Auth
        const fullName = `${firstName || ""} ${lastName || ""}`.trim() || undefined;
        if (fullName) {
          await updateProfile(cred.user, { displayName: fullName });
        }

        // Doc Firestore (inactif par défaut)
        await ensureUserDoc(
          cred.user.uid,
          cred.user.email || email,
          fullName || cred.user.displayName,
          cred.user.photoURL,
          { firstName: firstName || null, lastName: lastName || null }
        );

        // Déconnecte immédiatement + message clair
        await signOut(auth);
        setMode("login");
        setFirstName("");
        setLastName("");
        setPass("");
        setError("Compte créé. En attente d'activation par un responsable.");
      }
    } catch (err: any) {
      setError(err?.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const cred = await signInWithPopup(auth, provider);
      const u = cred.user;

      // Crée/MAJ le doc (nouvel utilisateur => active:false)
      await ensureUserDoc(u.uid, u.email || "", u.displayName, u.photoURL);

      // Vérifie l'activation
      const ref = doc(db, "users", u.uid);
      const snap = await getDoc(ref);
      const active = (snap.data() as any)?.active === true;

      if (!active) {
        await signOut(auth);
        setError("Votre compte Google a été enregistré, mais doit être activé par un responsable.");
        return;
      }
      // onAuthStateChanged fera la redirection si actif
    } catch (err: any) {
      if (err?.code === "auth/account-exists-with-different-credential") {
        setError("Un compte existe déjà avec une autre méthode de connexion pour cet email.");
      } else if (err?.code === "auth/popup-blocked") {
        setError("La fenêtre de connexion a été bloquée par le navigateur. Autorisez les popups et réessayez.");
      } else {
        setError(err?.message ?? "Échec de la connexion Google.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    if (!email) {
      setError("Renseigne d'abord ton email.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      alert("Email de réinitialisation envoyé.");
    } catch (err: any) {
      setError(err?.message ?? "Échec de l'envoi.");
    } finally {
      setLoading(false);
    }
  }

  // ————————————————————————————————————————————————————————
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-sm">
        {/* En-tête application (icône + titre) */}
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="h-12 w-12 rounded-2xl bg-gray-900 text-white flex items-center justify-center shadow">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A 2 2 0 0 0 21 16Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3.3 7L12 12l8.7-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 22V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">PDD Inventaire</h1>
          <p className="text-xs text-gray-500">Gestion des entrées / sorties</p>
        </div>

        {/* Carte formulaire */}
        <form
          onSubmit={handleSubmit}
          className="w-full border rounded-xl p-6 space-y-4 bg-white shadow-sm"
        >
          <h2 className="text-lg font-semibold text-center">
            {mode === "login" ? "Connexion" : "Créer un compte"}
          </h2>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-2 rounded">
              {error}
            </div>
          )}

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full border rounded p-2 flex items-center justify-center gap-2 hover:bg-gray-50 disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 533.5 544.3" aria-hidden="true">
              <path fill="#4285F4" d="M533.5 278.4c0-18.6-1.5-37-4.6-54.8H272v103.7h146.9c-6.3 34.1-25.3 62.9-54 82.2v68h87.2c51.1-47.1 81.4-116.6 81.4-199.1z"/>
              <path fill="#34A853" d="M272 544.3c73.5 0 135.2-24.3 180.3-66.1l-87.2-68c-24.2 16.2-55.1 25.8-93.1 25.8-71.5 0-132-48.3-153.7-113.4H28.6v71.3C73.9 490.7 166.6 544.3 272 544.3z"/>
              <path fill="#FBBC05" d="M118.3 322.6c-5.5-16.5-8.6-34.1-8.6-52.6s3.1-36.1 8.6-52.6V146H28.6C10.4 182.1 0 222.5 0 265.9s10.4 83.8 28.6 119.9l89.7-63.2z"/>
              <path fill="#EA4335" d="M272 107.7c39.9 0 75.7 13.7 103.9 40.6l78.1-78.1C407.2 26.7 345.5 0 272 0 166.6 0 73.9 53.6 28.6 146l89.7 71.4C140 156 200.5 107.7 272 107.7z"/>
            </svg>
            Continuer avec Google
          </button>

          {/* Séparateur */}
          <div className="flex items-center gap-3">
            <div className="h-px bg-gray-200 flex-1" />
            <span className="text-xs text-gray-500">ou</span>
            <div className="h-px bg-gray-200 flex-1" />
          </div>

          {/* Champs spécifiques inscription */}
          {mode === "signup" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-sm">Prénom</label>
                <input
                  className="border rounded w-full p-2"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ex: Jean"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm">Nom</label>
                <input
                  className="border rounded w-full p-2"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Ex: Dupont"
                />
              </div>
            </div>
          )}

          {/* Email / Mot de passe */}
          <div className="space-y-1">
            <label className="text-sm">Email</label>
            <input
              className="border rounded w-full p-2"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemple@domaine.com"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm">Mot de passe</label>
            <input
              className="border rounded w-full p-2"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          <button
            className="w-full bg-blue-600 text-white rounded p-2 disabled:opacity-60"
            disabled={loading}
          >
            {loading
              ? "Veuillez patienter…"
              : mode === "login"
              ? "Se connecter"
              : "Créer le compte"}
          </button>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              className="underline"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
            >
              {mode === "login" ? "Créer un compte" : "J'ai déjà un compte"}
            </button>
            <button type="button" className="underline" onClick={handleReset}>
              Mot de passe oublié ?
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


import { useEffect, useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "../../firebase";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) nav("/", { replace: true });
    });
    return () => unsub();
  }, [nav]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, pass);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        // crée le profil user avec rôle par défaut
        await setDoc(doc(db, "users", cred.user.uid), {
          email,
          role: "pdd_member",
          createdAt: serverTimestamp()
        });
      }
    } catch (err: any) {
      setError(err?.message ?? "Erreur inconnue");
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

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm border rounded-xl p-6 space-y-4 bg-white"
      >
        <h1 className="text-xl font-semibold text-center">
          {mode === "login" ? "Connexion" : "Créer un compte"}
        </h1>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-2 rounded">
            {error}
          </div>
        )}

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
            {mode === "login"
              ? "Créer un compte"
              : "J'ai déjà un compte"}
          </button>
          <button type="button" className="underline" onClick={handleReset}>
            Mot de passe oublié ?
          </button>
        </div>
      </form>
    </div>
  );
}

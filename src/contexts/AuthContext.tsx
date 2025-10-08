import { createContext, useContext, useEffect, useState } from "react";
import { onIdTokenChanged, User, getIdTokenResult } from "firebase/auth";
import { auth } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

type Ctx = {
  user: User | null;
  loading: boolean;
  role: "pdd_admin" | "pdd_respo" | "pdd_member" | null;
  profile?: {
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  };
  active: boolean;
};

const AuthCtx = createContext<Ctx>({
  user: null,
  loading: true,
  role: null,
  active: false,
  profile: {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Ctx["role"]>(null);
  const [active, setActive] = useState(false);
  const [profile, setProfile] = useState<Ctx["profile"]>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubUser: (() => void) | null = null;

    const unsub = onIdTokenChanged(auth, async (u) => {
      setUser(u || null);

      // Nettoie l'abonnement précédent si on change d'utilisateur
      if (unsubUser) {
        unsubUser();
        unsubUser = null;
      }

      if (u) {
        try {
          const res = await getIdTokenResult(u, true);
          const r = (res.claims.role as any) || "pdd_member";
          setRole(r);
        } catch (e) {
          console.warn("getIdTokenResult error:", e);
          setRole("pdd_member");
        }

        // Écoute temps-réel du profil Firestore
        const ref = doc(db, "users", u.uid);
        unsubUser = onSnapshot(
          ref,
          async (snap) => {
            if (!snap.exists()) {
              setActive(false);
              setProfile({
                email: u.email ?? null,
                displayName: u.displayName ?? null,
                photoURL: u.photoURL ?? null,
                firstName: null,
                lastName: null,
              });
              setLoading(false);
              return;
            }
            const d = snap.data() as any;
            setActive(!!d.active);
            setProfile({
              email: d.email ?? u.email ?? null,
              displayName: d.displayName ?? u.displayName ?? null,
              photoURL: d.photoURL ?? u.photoURL ?? null,
              firstName: d.firstName ?? null,
              lastName: d.lastName ?? null,
            });
            setLoading(false);
          },
          (err) => {
            console.error("onSnapshot users error:", err);
            setLoading(false);
          }
        );
      } else {
        // Pas d’utilisateur
        setActive(false);
        setRole(null);
        setProfile({});
        setLoading(false);
      }
    });

    return () => {
      if (unsubUser) unsubUser();
      unsub();
    };
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, role, active, profile }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}

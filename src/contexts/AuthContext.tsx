// src/contexts/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from "react";
import { onIdTokenChanged, User, getIdTokenResult } from "firebase/auth";
import { auth } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

type Ctx = {
  user: User|null;
  loading: boolean;
  role: "pdd_admin"|"pdd_respo"|"pdd_member"|null;
  profile?: { email?:string|null; displayName?:string|null; photoURL?:string|null; firstName?:string|null; lastName?:string|null; };
  active: boolean;
};
const AuthCtx = createContext<Ctx>({user:null,loading:true,role:null,active:false});

export function AuthProvider({children}:{children:React.ReactNode}) {
  const [user,setUser] = useState<User|null>(null);
  const [role,setRole] = useState<Ctx["role"]>(null);
  const [active,setActive] = useState(false);
  const [profile,setProfile] = useState<Ctx["profile"]>({});
  const [loading,setLoading] = useState(true);

  useEffect(()=>{
    let unsubscribeUser: (()=>void)|null = null;

    const unsubscribeAuth = onIdTokenChanged(auth, async (u)=>{
      setUser(u||null);

      // Nettoie un éventuel ancien listener
      if (unsubscribeUser) { unsubscribeUser(); unsubscribeUser = null; }

      if (!u) {
        setActive(false);
        setRole(null);
        setProfile({});
        setLoading(false);          // ✅ on est fixés
        return;
      }

      // Récupère le rôle des claims (si présent)
      try {
        const res = await getIdTokenResult(u, true);
        setRole(((res.claims.role as any) || "pdd_member") as Ctx["role"]);
      } catch {
        setRole("pdd_member");
      }

      // Écoute du doc user
      const ref = doc(db,"users",u.uid);
      unsubscribeUser = onSnapshot(ref, (snap)=>{
        if (!snap.exists()) {
          setActive(false);
          setProfile({
            email: u.email ?? null,
            displayName: u.displayName ?? null,
            photoURL: u.photoURL ?? null,
            firstName: null,
            lastName: null,
          });
          setLoading(false);        // ✅ on a un état stabilisé
          return;
        }
        const d = snap.data() as any;
        setActive(!!d.active);
        setProfile({
          email: d.email ?? u.email ?? null,
          displayName: d.displayName ?? u.displayName ?? null,
          photoURL: d.photoURL ?? u.photoURL ?? null,
          firstName: d.firstName ?? null,
          lastName:  d.lastName  ?? null,
        });
        setLoading(false);          // ✅ on a reçu les données
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
    };
  },[]);

  return <AuthCtx.Provider value={{user,loading,role,active,profile}}>{children}</AuthCtx.Provider>
}

export function useAuth(){ return useContext(AuthCtx); }

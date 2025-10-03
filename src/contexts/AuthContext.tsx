import { createContext, useContext, useEffect, useState } from "react";
import { onIdTokenChanged, User, getIdTokenResult } from "firebase/auth";
import { auth } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

type Ctx = { user: User|null; loading: boolean; role: "pdd_admin"|"pdd_respo"|"pdd_member"|null; };
const AuthCtx = createContext<Ctx>({user:null,loading:true,role:null});
export const useAuth = ()=>useContext(AuthCtx);

export function AuthProvider({children}:{children:React.ReactNode}) {
  const [user,setUser] = useState<User|null>(null);
  const [role,setRole] = useState<Ctx["role"]>(null);
  const [loading,setLoading] = useState(true);

  useEffect(()=>{
    const unsub = onIdTokenChanged(auth, async (u)=>{
      setUser(u||null);
      if (u) {
        const res = await getIdTokenResult(u, true);
        const r = (res.claims.role as any) || "pdd_member";
        setRole(r);
      } else {
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsub();
  },[]);

  // écoute le doc user pour forcer refresh des claims si claimsSyncedAt change
  useEffect(()=>{
    if(!user) return;
    const ref = doc(db,"users",user.uid);
    const unsub = onSnapshot(ref, async snap=>{
      if (!snap.exists()) return;
      // à chaque MAJ (ex: rôle), on force le refresh du token
      await user.getIdToken(true);
      const res = await getIdTokenResult(user, true);
      setRole((res.claims.role as any) || "pdd_member");
    });
    return ()=>unsub();
  },[user]);

  return <AuthCtx.Provider value={{user,loading,role}}>{children}</AuthCtx.Provider>
}

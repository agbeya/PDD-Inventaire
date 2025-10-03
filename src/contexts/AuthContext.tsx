
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../firebase";

const AuthCtx = createContext<{user:User|null,loading:boolean}>({user:null,loading:true});
export const useAuth = ()=>useContext(AuthCtx);

export function AuthProvider({children}:{children:React.ReactNode}) {
  const [user,setUser] = useState<User|null>(null);
  const [loading,setLoading] = useState(true);
  useEffect(()=>onAuthStateChanged(auth,(u)=>{ setUser(u); setLoading(false); }),[]);
  return <AuthCtx.Provider value={{user,loading}}>{children}</AuthCtx.Provider>
}

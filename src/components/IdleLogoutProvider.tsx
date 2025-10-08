import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Config par défaut :
 * - 15 minutes d'inactivité -> avertissement 60s -> déconnexion
 */
const IDLE_MAX_MS = 15 * 60 * 1000; // 15 min
const WARNING_BEFORE_LOGOUT_MS = 60 * 1000; // 60s
const STORAGE_KEY_LAST_ACTIVE = "idle:lastActiveAt";
const STORAGE_KEY_FORCE_LOGOUT = "idle:forceLogout";
const STORAGE_KEY_RESET = "idle:reset";

type IdleContextType = {
  msBeforeLogout: number;
  isWarning: boolean;
  secondsLeft: number;
  extendSession: () => void;
};
export const IdleContext = createContext<IdleContextType>({
  msBeforeLogout: IDLE_MAX_MS,
  isWarning: false,
  secondsLeft: 0,
  extendSession: () => {},
});

function now() {
  return Date.now();
}

/**
 * Très petit composant modal. Remplace-le par ta modale UI habituelle si tu veux.
 */
function WarningModal({
  open,
  secondsLeft,
  onStay,
}: {
  open: boolean;
  secondsLeft: number;
  onStay: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-5">
        <h3 className="text-lg font-semibold mb-1">Inactivité détectée</h3>
        <p className="text-sm text-gray-600">
          Vous allez être déconnecté(e) dans <strong>{secondsLeft}</strong> seconde(s) par
          sécurité. Voulez-vous rester connecté(e) ?
        </p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onStay}
            className="inline-flex items-center bg-blue-600 text-white px-4 py-2 rounded"
          >
            Rester connecté
          </button>
        </div>
      </div>
    </div>
  );
}

export default function IdleLogoutProvider({
  children,
  idleMaxMs = IDLE_MAX_MS,
  warningMs = WARNING_BEFORE_LOGOUT_MS,
}: {
  children: React.ReactNode;
  /** Durée d’inactivité totale avant déconnexion */
  idleMaxMs?: number;
  /** Délai d’avertissement avant déconnexion (inclus dans idleMaxMs) */
  warningMs?: number;
}) {
  const location = useLocation();
  const { user } = useAuth();

  // Ignore la logique sur la page /login
  const disabled = location.pathname === "/login";

  // État d’avertissement
  const [isWarning, setIsWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Réfs pour timers
  const logoutTimerRef = useRef<number | null>(null);
  const warningTimerRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);

  // BroadcastChannel (multi-onglets moderne)
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Utils: clear timers
  const clearTimers = useCallback(() => {
    if (logoutTimerRef.current) window.clearTimeout(logoutTimerRef.current);
    if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
    if (countdownRef.current) window.clearInterval(countdownRef.current);
    logoutTimerRef.current = null;
    warningTimerRef.current = null;
    countdownRef.current = null;
  }, []);

  const forceLogout = useCallback(async () => {
    clearTimers();
    // Notifie les autres onglets
    try {
      localStorage.setItem(STORAGE_KEY_FORCE_LOGOUT, String(now()));
      channelRef.current?.postMessage({ type: "FORCE_LOGOUT" });
    } catch {}
    await signOut(auth);
    // Redirection simple (évite état incohérent)
    window.location.href = "/login";
  }, [clearTimers]);

  const scheduleTimers = useCallback(() => {
    clearTimers();
    setIsWarning(false);
    setSecondsLeft(0);

    const lastActive = Number(localStorage.getItem(STORAGE_KEY_LAST_ACTIVE) || now());
    const elapsed = now() - lastActive;

    const timeUntilLogout = Math.max(0, idleMaxMs - elapsed);
    const timeUntilWarning = Math.max(0, timeUntilLogout - warningMs);

    // Avertissement
    warningTimerRef.current = window.setTimeout(() => {
      setIsWarning(true);
      // décompte visuel (1s)
      let left = Math.ceil(warningMs / 1000);
      setSecondsLeft(left);
      countdownRef.current = window.setInterval(() => {
        left -= 1;
        setSecondsLeft(left);
      }, 1000);
    }, timeUntilWarning);

    // Déconnexion
    logoutTimerRef.current = window.setTimeout(() => {
      forceLogout();
    }, timeUntilLogout);
  }, [idleMaxMs, warningMs, clearTimers, forceLogout]);

  /** Reset d’inactivité (activité utilisateur) */
  const touch = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, String(now()));
      localStorage.setItem(STORAGE_KEY_RESET, String(now())); // ping autres onglets
      channelRef.current?.postMessage({ type: "RESET" });
    } catch {}
    scheduleTimers();
  }, [scheduleTimers]);

  // Exposé au contexte (si tu veux afficher un badge minuterie, etc.)
  const ctx = useMemo<IdleContextType>(() => ({
    msBeforeLogout: idleMaxMs,
    isWarning,
    secondsLeft,
    extendSession: touch,
  }), [idleMaxMs, isWarning, secondsLeft, touch]);

  // Setup listeners
  useEffect(() => {
    if (disabled || !user) {
      clearTimers();
      setIsWarning(false);
      setSecondsLeft(0);
      return;
    }

    // Init horodatage si absent
    if (!localStorage.getItem(STORAGE_KEY_LAST_ACTIVE)) {
      localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, String(now()));
    }

    // Écoute activité utilisateur
    const EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart", "visibilitychange"];
    const onEvent = () => {
      // Ignorer si onglet caché & event programmatique
      if (document.hidden) return;
      touch();
    };
    EVENTS.forEach((ev) => window.addEventListener(ev, onEvent, { passive: true }));

    // Multi-onglets (LocalStorage)
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_FORCE_LOGOUT && e.newValue) {
        forceLogout();
      }
      if (e.key === STORAGE_KEY_RESET && e.newValue) {
        scheduleTimers();
      }
    };
    window.addEventListener("storage", onStorage);

    // BroadcastChannel
    channelRef.current = "BroadcastChannel" in window ? new BroadcastChannel("idle") : null;
    channelRef.current?.addEventListener("message", (ev: MessageEvent) => {
      if (ev.data?.type === "FORCE_LOGOUT") forceLogout();
      if (ev.data?.type === "RESET") scheduleTimers();
    });

    // Premier scheduling
    scheduleTimers();

    return () => {
      EVENTS.forEach((ev) => window.removeEventListener(ev, onEvent));
      window.removeEventListener("storage", onStorage);
      channelRef.current?.close();
      channelRef.current = null;
      clearTimers();
    };
  }, [disabled, user, scheduleTimers, clearTimers, touch, forceLogout]);

  // Action bouton “Rester connecté”
  const extendSession = useCallback(() => {
    setIsWarning(false);
    touch();
  }, [touch]);

  return (
    <IdleContext.Provider value={{ ...ctx, extendSession }}>
      {children}
      <WarningModal open={isWarning} secondsLeft={secondsLeft} onStay={extendSession} />
    </IdleContext.Provider>
  );
}

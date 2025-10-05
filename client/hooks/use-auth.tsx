import { useEffect, useRef, useState } from "react";

function readStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    const admin = window.localStorage.getItem("inTuneAdmin");
    const student = window.localStorage.getItem("inTuneStudent");
    if (admin) return JSON.parse(admin);
    if (student) return JSON.parse(student);
  } catch (error) {
    console.error("Failed to read stored user", error);
  }
  return null;
}

function persistUser(user: any | null) {
  if (typeof window === "undefined") return;
  try {
    if (!user) {
      window.localStorage.removeItem("inTuneAdmin");
      window.localStorage.removeItem("inTuneStudent");
      return;
    }
    if (user.role === "admin") {
      window.localStorage.setItem("inTuneAdmin", JSON.stringify(user));
      window.localStorage.removeItem("inTuneStudent");
    } else {
      window.localStorage.setItem("inTuneStudent", JSON.stringify(user));
      window.localStorage.removeItem("inTuneAdmin");
    }
  } catch (error) {
    console.error("Failed to persist user", error);
  }
}

export default function useAuth() {
  const fallbackUser = readStoredUser();
  const fallbackRef = useRef(fallbackUser);
  const [user, setUser] = useState<any | null>(fallbackUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = typeof window !== 'undefined' ? window.localStorage.getItem('inTuneToken') : null;
        const headers: any = token ? { Authorization: `Bearer ${token}` } : undefined;
        const res = await fetch("/api/auth/me", { credentials: "include", headers });
        if (!res.ok) {
          // clear any stored user if server rejects the session to avoid stale local fallbacks
          persistUser(null);
          if (mounted) setUser(null);
          return;
        }
        const next = await res.json();
        if (!mounted) return;
        setUser(next);
        persistUser(next);
      } catch (error) {
        // on network/error, clear fallback to avoid incorrect redirects
        persistUser(null);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return { user, loading };
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRandomImage } from "@/lib/unsplash";
import useAuth from "@/hooks/use-auth";

export default function AdminLogin() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [img, setImg] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (user.role === "admin") {
      navigate("/admin", { replace: true });
    } else {
      navigate("/dashboard", { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    (async () => {
      const queries = [
        "nature",
        "guitar",
        "musical instruments",
        "acoustic guitar",
        "piano",
      ];
      // try several queries until we get an image
      let u: string | null = null;
      for (let q of queries) {
        u = await getRandomImage(q);
        if (u) break;
      }
      setImg(u);
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error || "Login failed");
        return;
      }
      const user = await res.json();
      // store token if provided (fallback for environments where cookies are blocked)
      try {
        if (user.token) {
          localStorage.setItem("inTuneToken", user.token);
        }
      } catch (e) {
        console.error("Failed to persist token", e);
      }
      if (user.role === "admin") {
        localStorage.setItem("inTuneAdmin", JSON.stringify(user));
        localStorage.removeItem("inTuneStudent");
        navigate("/admin");
      } else {
        localStorage.setItem("inTuneStudent", JSON.stringify(user));
        localStorage.removeItem("inTuneAdmin");
        navigate("/dashboard");
      }
    } catch (err: any) {
      setErr(err?.message || "Login failed");
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        backgroundImage: img
          ? `linear-gradient(rgba(2,6,23,0.5), rgba(2,6,23,0.5)), url(${img})`
          : undefined,
        backgroundSize: "cover",
      }}
    >
      <div className="bg-card/95 rounded-lg p-8 shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold">Login</h1>
        <p className="text-sm text-foreground/70 mt-2">
          Sign in with username or email and password.
        </p>
        <form onSubmit={submit} className="mt-4">
          <input
            name="identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="w-full h-10 rounded-md border px-3 mb-2"
            placeholder="Username or email"
            autoComplete="username"
          />
          <input
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-10 rounded-md border px-3"
            placeholder="Password"
            type="password"
            autoComplete="current-password"
          />
          {err && <div className="text-sm text-red-600 mt-2">{err}</div>}
          <div className="mt-4 flex justify-end">
            <button className="h-10 px-4 rounded-md bg-primary text-primary-foreground">
              Sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

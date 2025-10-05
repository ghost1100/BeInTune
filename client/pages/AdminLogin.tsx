import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRandomImage } from "@/lib/unsplash";

export default function AdminLogin() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [img, setImg] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const u = await getRandomImage("music teacher");
      setImg(u);
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error || "Login failed");
        return;
      }
      const user = await res.json();
      if (user.role === "admin") {
        localStorage.setItem("inTuneAdmin", JSON.stringify(user));
        navigate("/admin");
      } else {
        // student or other role
        localStorage.setItem("inTuneStudent", JSON.stringify(user));
        navigate("/");
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
        <p className="text-sm text-foreground/70 mt-2">Sign in with username or email and password.</p>
        <form onSubmit={submit} className="mt-4">
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="w-full h-10 rounded-md border px-3 mb-2"
            placeholder="Username or email"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-10 rounded-md border px-3"
            placeholder="Password"
            type="password"
          />
          {err && <div className="text-sm text-red-600 mt-2">{err}</div>}
          <div className="mt-4 flex justify-between">
            <button className="h-10 px-4 rounded-md bg-primary text-primary-foreground">Sign in</button>
            <button
              type="button"
              onClick={() => {
                setIdentifier("Darryle");
                setPassword("123654intune");
                setErr("");
              }}
              className="h-10 px-4 rounded-md border"
            >
              Fill test
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

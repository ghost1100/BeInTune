import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRandomImage } from "@/lib/unsplash";

export default function AdminLogin() {
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "123654intune") {
      localStorage.setItem("inTuneAdmin", "true");
      navigate("/admin");
    } else {
      setErr("Incorrect password");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundImage: img ? `linear-gradient(rgba(2,6,23,0.5), rgba(2,6,23,0.5)), url(${img})` : undefined, backgroundSize: 'cover' }}>
      <div className="bg-card/95 rounded-lg p-8 shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold">Admin login</h1>
        <p className="text-sm text-foreground/70 mt-2">Enter the admin password to manage teachers.</p>
        <form onSubmit={submit} className="mt-4">
          <input value={password} onChange={(e) => setPassword(e.target.value)} className="w-full h-10 rounded-md border px-3" placeholder="Password" type="password" />
          {err && <div className="text-sm text-red-600 mt-2">{err}</div>}
          <div className="mt-4 flex justify-between">
            <button className="h-10 px-4 rounded-md bg-slate-800 text-white">Sign in</button>
            <button type="button" onClick={() => { setPassword('123654intune'); setErr(''); }} className="h-10 px-4 rounded-md border">Fill test</button>
          </div>
        </form>
      </div>
    </div>
  );
}

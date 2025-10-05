import { useEffect, useState } from "react";

export default function CookieBanner() {
  const [accepted, setAccepted] = useState(() => {
    try {
      return !!localStorage.getItem("inTuneCookiesAccepted");
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (accepted) localStorage.setItem("inTuneCookiesAccepted", "1");
  }, [accepted]);

  if (accepted) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 max-w-3xl mx-auto p-4 rounded-lg shadow-lg bg-card border flex items-center justify-between z-50">
      <div className="text-sm text-foreground/90">
        This site uses cookies for essential features and analytics. By continuing to use the site you accept our <a href="/privacy" className="underline">privacy policy</a>.
      </div>
      <div className="ml-4">
        <button onClick={() => setAccepted(true)} className="px-3 py-1 rounded bg-primary text-primary-foreground">Accept</button>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle(){
  const [mode, setMode] = useState<'light'|'dark'>(()=>{
    try {
      const v = localStorage.getItem('inTuneThemeMode');
      return (v === 'dark' ? 'dark' : 'light');
    } catch { return 'light'; }
  });

  useEffect(()=>{
    const root = document.documentElement;
    if(mode === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
    try{ localStorage.setItem('inTuneThemeMode', mode); }catch{}
  },[mode]);

  return (
    <button onClick={()=>setMode(m=> m === 'dark' ? 'light' : 'dark')} className="p-2 rounded-md border bg-background">
      {mode === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

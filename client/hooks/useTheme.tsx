import { useCallback, useEffect, useState } from "react";

export type ThemePayload = { primary?: string, brand1?: string, brand2?: string, secondary?: string };

export function applyThemeToRoot(t: ThemePayload){
  const root = document.documentElement;
  if(t.primary) root.style.setProperty('--primary', t.primary);
  if(t.brand1) root.style.setProperty('--brand-1', t.brand1);
  if(t.brand2) root.style.setProperty('--brand-2', t.brand2);
  if(t.secondary) root.style.setProperty('--secondary', t.secondary);
}

export default function useTheme(){
  const [mode, setMode] = useState<'light'|'dark'>(()=>{
    try{ const v = localStorage.getItem('inTuneThemeMode'); return v === 'dark' ? 'dark' : 'light'; }catch{ return 'light'; }
  });

  const [theme, setTheme] = useState<ThemePayload>(()=>{
    try{ const s = localStorage.getItem('inTuneTheme'); return s ? JSON.parse(s) : {}; }catch{return {};}
  });

  useEffect(()=>{
    // apply mode
    const root = document.documentElement;
    if(mode === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
    try{ localStorage.setItem('inTuneThemeMode', mode); }catch{}
  },[mode]);

  useEffect(()=>{
    applyThemeToRoot(theme);
  },[theme]);

  const saveTheme = useCallback((payload:ThemePayload)=>{
    setTheme(payload);
    try{ localStorage.setItem('inTuneTheme', JSON.stringify(payload)); }catch{}
    applyThemeToRoot(payload);
  },[]);

  const previewTheme = useCallback((payload:ThemePayload)=>{
    // apply without saving
    applyThemeToRoot(payload);
  },[]);

  const restoreTheme = useCallback(()=>{
    // read from storage and apply
    try{ const s = localStorage.getItem('inTuneTheme'); if(s){ const p = JSON.parse(s); applyThemeToRoot(p); setTheme(p); } }catch{}
  },[]);

  return { mode, setMode, theme, saveTheme, previewTheme, restoreTheme };
}

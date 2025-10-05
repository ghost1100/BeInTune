import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import useTheme from "@/hooks/useTheme";

export default function ThemeToggle() {
  const { mode, setMode } = useTheme();
  return (
    <button
      onClick={() => setMode(mode === "dark" ? "light" : "dark")}
      className="p-2 rounded-md border bg-background"
    >
      {mode === "dark" ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </button>
  );
}

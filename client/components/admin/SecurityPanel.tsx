import React, { useEffect, useState } from "react";

export default function SecurityPanel() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/audit-logs");
        if (!res.ok) return;
        const data = await res.json();
        setLogs(data);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const userLogs = logs.filter((l) => l.role !== "admin");
  const adminLogs = logs.filter((l) => l.role === "admin");

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <h3 className="font-semibold mb-2">User actions</h3>
        <div className="space-y-2 max-h-[60vh] overflow-auto">
          {userLogs.map((l) => (
            <div key={l.id} className="rounded-md border p-2">
              <div className="text-sm text-foreground/70">
                {new Date(l.created_at).toLocaleString()}
              </div>
              <div className="font-medium">
                {l.username || l.email || "Unknown"}
              </div>
              <div className="text-sm">{l.action}</div>
              <div className="text-xs text-foreground/60">
                {JSON.stringify(l.meta)}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="font-semibold mb-2">Admin / Teacher actions</h3>
        <div className="space-y-2 max-h-[60vh] overflow-auto">
          {adminLogs.map((l) => (
            <div key={l.id} className="rounded-md border p-2">
              <div className="text-sm text-foreground/70">
                {new Date(l.created_at).toLocaleString()}
              </div>
              <div className="font-medium">
                {l.username || l.email || "Unknown"}
              </div>
              <div className="text-sm">{l.action}</div>
              <div className="text-xs text-foreground/60">
                {JSON.stringify(l.meta)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

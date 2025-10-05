import React, { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function MyLearning() {
  const [students, setStudents] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [resources, setResources] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();
  const { user, loading } = (await import('@/hooks/use-auth')).default();

  useEffect(() => {
    (async () => {
      try {
        const j = await (await import('@/lib/api')).apiFetch('/api/admin/students');
        setStudents(j as any[] || []);
        if ((j as any[])?.length) setSelected((j as any[])[0].student_id || (j as any[])[0].id);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selected) return;
    (async () => {
      try {
        const j = await (await import("@/lib/api")).apiFetch(`/api/admin/learning/${selected}`);
        const arr = Array.isArray(j) ? j : (j && (j as any).rows ? (j as any).rows : []);
        setResources(arr as any[]);
      } catch (e) {
        console.error(e);
        setResources([]);
      }
    })();
  }, [selected]);

  async function uploadResources(files: FileList | null) {
    if (!files || !selected) return;
    try {
      const uploaded: any[] = [];
      for (const f of Array.from(files)) {
        const b64 = await fileToBase64(f);
        const p = await (await import("@/lib/api")).apiFetch("/api/admin/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: f.name, data: b64 }),
        });
        if (!p || typeof p === "string") throw new Error("Upload failed");
        uploaded.push({ id: (p as any).id, url: (p as any).url, mime: f.type });
      }
      // create a learning resource record
      const r = await (await import("@/lib/api")).apiFetch(`/api/admin/learning/${selected}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Resources", description: "", media: uploaded }),
      });
      const arr = Array.isArray(r) ? r : (r && (r as any).rows ? (r as any).rows : []);
      if (!arr.length) {
        toast({ title: "Uploaded" });
      } else {
        toast({ title: "Uploaded" });
      }
      setResources(arr as any[]);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Upload failed" });
    }
  }

  return (
    <div className="container mx-auto py-8">
      <h2 className="text-xl font-semibold">My Learning (resources)</h2>
      <div className="mt-4 flex gap-4">
        <div className="w-64">
          <h3 className="font-medium">Students</h3>
          <div className="mt-2 space-y-2">
            {students.map((s) => (
              <div
                key={s.student_id}
                className={`p-2 rounded border ${selected === (s.student_id || s.id) ? "bg-muted" : ""}`}
                onClick={() => setSelected(s.student_id || s.id)}
              >
                <div className="font-medium">{s.name || s.email}</div>
                <div className="text-sm text-foreground/70">{s.email}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <div className="bg-card p-4 rounded">
            <div className="flex items-center gap-2">
              <input
                type="file"
                multiple
                ref={fileRef}
                className="hidden"
                onChange={(e) => uploadResources(e.target.files)}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                Upload resources
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {resources.map((r: any) => (
                <div key={r.id} className="p-2 border rounded">
                  <div className="font-medium">{r.title || "Resource"}</div>
                  <div className="text-sm text-foreground/70">
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                  {r.media && r.media.length > 0 && (
                    <div className="mt-2">
                      {r.media.map((m: any) => (
                        <a
                          key={m.url}
                          href={m.url}
                          className="block text-primary underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Download
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function MyLearning() {
  const [students, setStudents] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [resources, setResources] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/students");
      if (!res.ok) return;
      const j = await res.json();
      setStudents(j);
      if (j.length) setSelected(j[0].student_id || j[0].id);
    })();
  }, []);

  useEffect(() => {
    if (!selected) return;
    (async () => {
      const res = await fetch(`/api/admin/learning/${selected}`);
      if (!res.ok) return setResources([]);
      const j = await res.json();
      setResources(j);
    })();
  }, [selected]);

  async function uploadResources(files: FileList | null) {
    if (!files || !selected) return;
    try {
      const form = new FormData();
      for (const f of Array.from(files)) form.append("files", f, f.name);
      const res = await fetch(`/api/admin/learning/${selected}`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      toast({ title: "Uploaded" });
      const j = await res.json();
      setResources(j);
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
              <div key={s.student_id} className={`p-2 rounded border ${selected === (s.student_id||s.id) ? 'bg-muted':''}`} onClick={()=>setSelected(s.student_id||s.id)}>
                <div className="font-medium">{s.name || s.email}</div>
                <div className="text-sm text-foreground/70">{s.email}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <div className="bg-card p-4 rounded">
            <div className="flex items-center gap-2">
              <input type="file" multiple ref={fileRef} className="hidden" onChange={(e)=>uploadResources(e.target.files)} />
              <Button variant="outline" size="sm" onClick={()=>fileRef.current?.click()}>Upload resources</Button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {resources.map((r:any)=> (
                <div key={r.id} className="p-2 border rounded">
                  <div className="font-medium">{r.title || 'Resource'}</div>
                  <div className="text-sm text-foreground/70">{new Date(r.created_at).toLocaleString()}</div>
                  {r.media && r.media.length>0 && (
                    <div className="mt-2">
                      {r.media.map((m:any)=> (
                        <a key={m.url} href={m.url} className="block text-primary underline" target="_blank" rel="noreferrer">Download</a>
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

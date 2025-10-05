import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function Chats() {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const { toast } = useToast();

  async function load() {
    try {
      const j = await (await import("@/lib/api")).apiFetch(
        "/api/admin/messages?limit=50"
      );
      const arr = Array.isArray(j) ? j : (j && (j as any).rows ? (j as any).rows : []);
      setMessages(arr);
    } catch (e) {
      console.error(e);
      setMessages([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function send() {
    if (!text) return;
    try {
      const r = await (await import("@/lib/api")).apiFetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      setText("");
      toast({ title: "Sent" });
      // reload messages
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed" });
    }
  }

  async function search(q: string) {
    setQuery(q);
    if (!q || q.length < 2) return setSearchResults([]);
    try {
      const j = await (await import("@/lib/api")).apiFetch('/api/admin/students');
      const list = Array.isArray(j) ? j : (j && (j as any).rows ? (j as any).rows : []);
      const filtered = list.filter((s: any) => (s.name || s.email || '').toLowerCase().includes(q.toLowerCase()));
      setSearchResults(filtered);
    } catch (e) {
      console.error(e);
      setSearchResults([]);
    }
  }

  return (
    <div className="container mx-auto py-8">
      <h2 className="text-xl font-semibold">Chats</h2>
      <div className="mt-4 bg-card p-4 rounded">
        <div className="mb-3 flex gap-2">
          <input className="flex-1 p-2 rounded border" placeholder="Search users by name" value={query} onChange={(e)=>search(e.target.value)} />
        </div>
        {searchResults.length>0 && (
          <div className="mb-3">
            {searchResults.map((s)=> (
              <div key={s.student_id} className="p-2 border rounded mb-1">{s.name || s.email}</div>
            ))}
          </div>
        )}
        <div className="space-y-2 max-h-72 overflow-auto">
          {(Array.isArray(messages) ? messages : []).map((m) => (
            <div key={m.id} className="p-2 border rounded">
              <div className="font-medium">{m.sender_id || "User"}</div>
              <div className="text-sm text-foreground/70">{m.content}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            className="flex-1 p-2 rounded border"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button onClick={send}>Send</Button>
        </div>
      </div>
    </div>
  );
}

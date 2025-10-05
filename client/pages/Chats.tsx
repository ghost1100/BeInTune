import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import useAuth from "@/hooks/use-auth";

export default function Chats() {
  const [messages, setMessages] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();

  async function loadMessages() {
    try {
      const j = await (await import("@/lib/api")).apiFetch("/api/admin/messages?limit=200");
      const arr = Array.isArray(j) ? j : (j && (j as any).rows ? (j as any).rows : []);
      setMessages(arr.reverse()); // oldest first
    } catch (e) {
      console.error(e);
      setMessages([]);
    }
  }

  async function loadStudents() {
    try {
      const j = await (await import("@/lib/api")).apiFetch('/api/admin/students');
      const list = Array.isArray(j) ? j : (j && (j as any).rows ? (j as any).rows : []);
      setStudents(list);
    } catch (e) {
      console.error(e);
      setStudents([]);
    }
  }

  useEffect(() => {
    loadStudents();
    loadMessages();
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${window.location.host}/ws`);
    ws.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'message:new') {
          // append
          setMessages((m) => [msg.payload, ...m]);
        }
      } catch (e) {
        // ignore
      }
    });
    return () => ws.close();
  }, []);

  function conversationMessages() {
    if (!selected || !user) return [];
    const uid = user.id;
    const other = selected.user_id || selected.userId || selected.id;
    return messages.filter((m) => {
      return (
        (m.sender_id === uid && m.recipient_id === other) ||
        (m.sender_id === other && m.recipient_id === uid)
      );
    });
  }

  async function send() {
    if (!text || !selected) return;
    try {
      const recipient = selected.user_id || selected.userId || selected.id;
      await (await import("@/lib/api")).apiFetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, recipient_id: recipient }),
      });
      setText("");
      toast({ title: "Sent" });
      // optimistic append will be done via websocket; reload fallback
      setTimeout(() => loadMessages(), 500);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed" });
    }
  }

  async function search(q: string) {
    setQuery(q);
    if (!q || q.length < 1) return setSearchResults([]);
    try {
      const filtered = students.filter((s: any) => (s.name || s.email || '').toLowerCase().includes(q.toLowerCase()));
      setSearchResults(filtered);
    } catch (e) {
      console.error(e);
      setSearchResults([]);
    }
  }

  return (
    <div className="container mx-auto py-8">
      <h2 className="text-xl font-semibold">Chats</h2>
      <div className="mt-4 bg-card p-4 rounded flex gap-4">
        <aside className="w-64 border rounded p-2">
          <input className="w-full p-2 rounded border mb-2" placeholder="Search students" value={query} onChange={(e)=>search(e.target.value)} />
          <div className="space-y-2 max-h-[60vh] overflow-auto">
            {(searchResults.length?searchResults:students).map((s)=> (
              <div key={s.student_id || s.id} className={`p-2 rounded cursor-pointer ${selected && (selected.student_id||selected.id) === (s.student_id||s.id) ? 'bg-muted':''}`} onClick={()=>setSelected(s)}>
                <div className="font-medium">{s.name || s.email}</div>
                <div className="text-sm text-foreground/70">{s.email}</div>
              </div>
            ))}
          </div>
        </aside>
        <section className="flex-1 flex flex-col">
          <div className="flex-1 overflow-auto p-2 space-y-2 max-h-[60vh]">
            {conversationMessages().map((m)=> (
              <div key={m.id} className={`p-2 rounded ${m.sender_id===user?.id? 'bg-primary/10 self-end text-right':'bg-card/90 self-start text-left'}`}>
                <div className="text-sm text-foreground/80">{m.content}</div>
                <div className="text-xs text-foreground/60 mt-1">{new Date(m.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input className="flex-1 p-2 rounded border" value={text} onChange={(e)=>setText(e.target.value)} placeholder={selected?`Message ${selected.name||selected.email}`:'Select a student to chat'} />
            <Button onClick={send} disabled={!selected}>Send</Button>
          </div>
        </section>
      </div>
    </div>
  );
}

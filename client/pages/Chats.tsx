import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function Chats() {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/messages?limit=50");
        if (!res.ok) return;
        const j = await res.json();
        setMessages(j.rows || j);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  async function send() {
    if (!text) return;
    try {
      const res = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) throw new Error("Send failed");
      setText("");
      toast({ title: "Sent" });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed" });
    }
  }

  return (
    <div className="container mx-auto py-8">
      <h2 className="text-xl font-semibold">Chats</h2>
      <div className="mt-4 bg-card p-4 rounded">
        <div className="space-y-2 max-h-96 overflow-auto">
          {messages.map((m) => (
            <div key={m.id} className="p-2 border rounded">
              <div className="font-medium">{m.sender_id || 'User'}</div>
              <div className="text-sm text-foreground/70">{m.content}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input className="flex-1 p-2 rounded border" value={text} onChange={(e)=>setText(e.target.value)} />
          <Button onClick={send}>Send</Button>
        </div>
      </div>
    </div>
  );
}

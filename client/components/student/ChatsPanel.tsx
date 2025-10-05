import { useEffect, useState } from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import useAuth from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface StudentRecord {
  id?: string;
  student_id?: string;
  user_id?: string;
  name?: string;
  email?: string;
}

interface MessageRecord {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at?: string;
}

export default function ChatsPanel({ className }: { className?: string }) {
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [selected, setSelected] = useState<StudentRecord | null>(null);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    loadStudents();
    loadMessages();
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.host}/ws`);
    ws.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "message:new") {
          setMessages((prev) => [message.payload, ...prev].slice(0, 200));
        }
      } catch (error) {
        console.error(error);
      }
    });
    return () => ws.close();
  }, []);

  async function loadMessages() {
    try {
      const response = await (
        await import("@/lib/api")
      ).apiFetch("/api/admin/messages?limit=200");
      const list = Array.isArray(response)
        ? (response as MessageRecord[])
        : response && (response as any).rows
          ? ((response as any).rows as MessageRecord[])
          : [];
      setMessages(list.reverse());
    } catch (error) {
      console.error(error);
      setMessages([]);
    }
  }

  async function loadStudents() {
    try {
      const response = await (
        await import("@/lib/api")
      ).apiFetch("/api/admin/students");
      const list = Array.isArray(response)
        ? (response as StudentRecord[])
        : response && (response as any).rows
          ? ((response as any).rows as StudentRecord[])
          : [];
      setStudents(list);
    } catch (error) {
      console.error(error);
      setStudents([]);
    }
  }

  function filteredStudents() {
    if (!query) return students;
    return students.filter((student) =>
      (student.name || student.email || "")
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  }

  function conversationMessages() {
    if (!selected || !user) return [];
    const currentUser = user.id;
    const otherUser = selected.user_id || selected.id || selected.student_id || "";
    return messages.filter((message) => {
      return (
        (message.sender_id === currentUser && message.recipient_id === otherUser) ||
        (message.sender_id === otherUser && message.recipient_id === currentUser)
      );
    });
  }

  async function sendMessage() {
    if (!text || !selected) return;
    try {
      const recipient = selected.user_id || selected.id || selected.student_id;
      await (
        await import("@/lib/api")
      ).apiFetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, recipient_id: recipient }),
      });
      setText("");
      toast({ title: "Message sent" });
      setTimeout(() => loadMessages(), 300);
    } catch (err: any) {
      toast({
        title: "Unable to send message",
        description: err?.message || "Please try again",
      });
    }
  }

  return (
    <section className={cn("space-y-6", className)}>
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">Chats</h2>
        <p className="text-sm text-foreground/70">
          Directly message your tutors and classmates to stay in sync.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px,1fr]">
        <aside className="rounded-lg border bg-card p-4">
          <label htmlFor="studentSearch" className="sr-only">
            Search students
          </label>
          <input
            id="studentSearch"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded border p-2 text-sm"
            placeholder="Search students"
          />
          <div className="mt-3 max-h-[60vh] space-y-2 overflow-auto">
            {(query ? filteredStudents() : students).map((student) => {
              const id = student.student_id || student.id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelected(student)}
                  className={cn(
                    "w-full rounded border p-2 text-left text-sm transition-colors",
                    selected && (selected.student_id || selected.id) === id
                      ? "bg-muted"
                      : "hover:bg-muted/70",
                  )}
                >
                  <div className="font-medium">{student.name || student.email}</div>
                  <div className="text-xs text-foreground/70">{student.email}</div>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="flex flex-col rounded-lg border bg-card p-4">
          <div className="flex-1 space-y-2 overflow-auto">
            {conversationMessages().map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-sm rounded p-2 text-sm",
                  message.sender_id === user?.id
                    ? "ml-auto bg-primary/10 text-right"
                    : "mr-auto bg-muted/60 text-left",
                )}
              >
                <p>{message.content}</p>
                {message.created_at && (
                  <time className="mt-1 block text-xs text-foreground/60">
                    {new Date(message.created_at).toLocaleString()}
                  </time>
                )}
              </div>
            ))}
            {!selected && (
              <p className="text-sm text-foreground/70">
                Select a student to start chatting.
              </p>
            )}
            {selected && conversationMessages().length === 0 && (
              <p className="text-sm text-foreground/70">
                Start a new conversation with {selected.name || selected.email}.
              </p>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <label htmlFor="chatMessage" className="sr-only">
              Message
            </label>
            <input
              id="chatMessage"
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="flex-1 rounded border p-2 text-sm"
              placeholder={
                selected ? `Message ${selected.name || selected.email}` : "Select a conversation"
              }
            />
            <Button onClick={sendMessage} disabled={!selected}>
              Send
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

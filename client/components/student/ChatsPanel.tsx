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
  const [rooms, setRooms] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    loadStudents();
    loadAdmins();
    loadMessages();
    loadRooms();
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

  // load admin users so we can pin them above student list
  async function loadAdmins() {
    try {
      const resp = await (
        await import("@/lib/api")
      ).apiFetch("/api/admin/students/admins");
      const list = Array.isArray(resp) ? resp : [];
      if (list.length) {
        // prepare a synthetic StudentRecord for admin
        const admin = {
          id: list[0].user_id || list[0].id,
          user_id: list[0].user_id || list[0].id,
          name: list[0].name || "Admin",
          email: list[0].email || "admin@local",
          isAdmin: true,
        } as any as StudentRecord & { isAdmin?: boolean };
        setStudents((prev) => {
          // ensure admin is first and not duplicated
          const filtered = prev.filter(
            (p) => p.user_id !== admin.user_id && p.id !== admin.id,
          );
          return [admin as any, ...filtered];
        });
      }
    } catch (err) {
      console.error("Failed to load admins", err);
    }
  }

  async function toggleSaveMessage(messageId: string, saved: boolean) {
    try {
      if (saved) {
        await (
          await import("@/lib/api")
        ).apiFetch(`/api/admin/messages/${messageId}/save`, { method: "POST" });
      } else {
        await (
          await import("@/lib/api")
        ).apiFetch(`/api/admin/messages/${messageId}/save`, {
          method: "DELETE",
        });
      }
      setTimeout(() => loadMessages(), 200);
    } catch (err) {
      console.error("Failed to toggle save", err);
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
    const otherUser =
      selected.user_id || selected.id || selected.student_id || "";
    return messages.filter((message) => {
      return (
        (message.sender_id === currentUser &&
          message.recipient_id === otherUser) ||
        (message.sender_id === otherUser &&
          message.recipient_id === currentUser)
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

  async function handleMessageReaction(
    messageId: string,
    reaction: string,
    current?: string | null,
  ) {
    try {
      if (current === reaction) {
        await (
          await import("@/lib/api")
        ).apiFetch(`/api/admin/messages/${messageId}/reactions`, {
          method: "DELETE",
        });
      } else {
        await (
          await import("@/lib/api")
        ).apiFetch(`/api/admin/messages/${messageId}/reactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: reaction }),
        });
      }
      setTimeout(() => loadMessages(), 200);
    } catch (err) {
      console.error(err);
    }
  }

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState("");

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
              const id = student.student_id || student.id || student.user_id;
              const isAdmin = (student as any).isAdmin;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelected(student)}
                  className={cn(
                    "w-full rounded border p-2 text-left text-sm transition-colors flex items-center justify-between",
                    selected &&
                      (selected.student_id ||
                        selected.id ||
                        selected.user_id) === id
                      ? "bg-muted"
                      : "hover:bg-muted/70",
                    isAdmin ? "border-l-4 border-primary" : "",
                  )}
                >
                  <div>
                    <div className="font-medium">
                      {student.name || student.email}
                    </div>
                    <div className="text-xs text-foreground/70">
                      {student.email}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="text-xs text-primary">Pinned</div>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        <div className="flex flex-col rounded-lg border bg-card p-4">
          <div className="flex-1 space-y-2 overflow-auto">
            {selected && (
              <div className="mb-2">
                <button
                  onClick={() => setSelected(null)}
                  className="text-sm text-foreground/70"
                >
                  ← Back
                </button>
                <div className="text-lg font-semibold mt-1">
                  {selected.name || selected.email}
                </div>
              </div>
            )}
            {conversationMessages().map((message) => (
              <div key={message.id} className="relative">
                <div
                  className={cn(
                    "max-w-sm rounded p-2 text-sm",
                    message.sender_id === user?.id
                      ? "ml-auto bg-primary/10 text-right"
                      : "mr-auto bg-muted/60 text-left",
                  )}
                >
                  {editingMessageId === message.id ? (
                    <div>
                      <input
                        value={editingMessageText}
                        onChange={(e) => setEditingMessageText(e.target.value)}
                        className="w-full rounded border p-2 text-sm"
                      />
                      <div className="flex gap-2 mt-2 justify-end">
                        <button
                          className="px-3 py-1 rounded bg-primary text-primary-foreground"
                          onClick={async () => {
                            try {
                              await (
                                await import("@/lib/api")
                              ).apiFetch(`/api/admin/messages/${message.id}`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  content: editingMessageText,
                                }),
                              });
                              setEditingMessageId(null);
                              setEditingMessageText("");
                              loadMessages();
                              toast({ title: "Message updated" });
                            } catch (err: any) {
                              toast({
                                title: "Unable to update",
                                description: err?.message,
                              });
                            }
                          }}
                        >
                          Save
                        </button>
                        <button
                          className="px-3 py-1 rounded border"
                          onClick={() => {
                            setEditingMessageId(null);
                            setEditingMessageText("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p>{message.content}</p>
                      {message.created_at && (
                        <time className="mt-1 block text-xs text-foreground/60">
                          {new Date(message.created_at).toLocaleString()}
                        </time>
                      )}
                    </>
                  )}
                </div>

                {/* reactions and controls */}
                <div className="mt-1 flex items-center gap-2 text-xs ml-2">
                  {[
                    ["heart", "❤️"],
                    ["like", "👍"],
                    ["smile", "😊"],
                  ].map(([type, icon]) => {
                    const count =
                      ((message as any).reactions &&
                        ((message as any).reactions as any)[type]) ||
                      0;
                    const active = (message as any).user_reaction === type;
                    return (
                      <button
                        key={type}
                        onClick={() =>
                          handleMessageReaction(
                            message.id,
                            type as string,
                            (message as any).user_reaction,
                          )
                        }
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded ${active ? "bg-primary/20" : "hover:bg-muted/20"}`}
                      >
                        <span aria-hidden>{icon}</span>
                        <span className="text-xs font-medium">{count}</span>
                      </button>
                    );
                  })}

                  {/* edited tag */}
                  {message.edited_at && (
                    <div className="text-xs text-black dark:text-blue-400">
                      edited
                    </div>
                  )}

                  {/* save/unsave toggle */}
                  <button
                    className={`text-sm px-2 ${((message as any).saved_by || []).includes(user?.id) ? "text-primary" : ""}`}
                    onClick={async () => {
                      const saved = ((message as any).saved_by || []).includes(
                        user?.id,
                      );
                      await toggleSaveMessage(message.id, !saved);
                    }}
                  >
                    {((message as any).saved_by || []).includes(user?.id)
                      ? "Saved"
                      : "Save"}
                  </button>

                  {/* edit/delete for sender */}
                  {message.sender_id === user?.id && (
                    <div className="ml-auto flex items-center gap-2 border-dashed border rounded px-2 py-1">
                      <button
                        className="text-sm px-2"
                        onClick={() => {
                          setEditingMessageId(message.id);
                          setEditingMessageText(message.content);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="text-sm text-destructive"
                        onClick={async () => {
                          if (!confirm("Delete this message?")) return;
                          try {
                            await (
                              await import("@/lib/api")
                            ).apiFetch(`/api/admin/messages/${message.id}`, {
                              method: "DELETE",
                            });
                            loadMessages();
                            toast({ title: "Message deleted" });
                          } catch (err: any) {
                            toast({
                              title: "Unable to delete",
                              description: err?.message,
                            });
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
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
                selected
                  ? `Message ${selected.name || selected.email}`
                  : "Select a conversation"
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

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

export default function Discussion() {
  const [posts, setPosts] = useState<any[]>([]);
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<any[]>([]);
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    load();
    // setup websocket for realtime
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.host}/ws`);
    ws.addEventListener("message", (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "post:new") {
          // reload posts
          load();
        }
      } catch (e) {
        // ignore
      }
    });
    return () => {
      ws.close();
    };
  }, []);

  async function load() {
    try {
      const j = await (await import("@/lib/api")).apiFetch("/api/posts");
      const arr = Array.isArray(j)
        ? j
        : j && (j as any).rows
          ? (j as any).rows
          : [];
      setPosts(arr as any[]);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to load" });
    }
  }

  async function handleUploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    for (const f of Array.from(files)) {
      try {
        const b64 = await fileToBase64(f);
        const p = await (
          await import("@/lib/api")
        ).apiFetch("/api/admin/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: f.name, data: b64 }),
        });
        // apiFetch returns parsed JSON or text
        if (!p || typeof p === "string") throw new Error("Upload failed");
        setAttachments((a) => [
          ...a,
          { id: (p as any).id, url: (p as any).url, mime: f.type },
        ]);
      } catch (err: any) {
        toast({
          title: "Upload error",
          description: err?.message || "Upload failed",
        });
      }
    }
  }

  async function submitPost() {
    if (!body && attachments.length === 0) return;
    try {
      const r = await (
        await import("@/lib/api")
      ).apiFetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          attachments: attachments.map((a) => a.id),
        }),
      });
      setBody("");
      setAttachments([]);
      toast({ title: "Posted" });
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed" });
    }
  }

  return (
    <div className="container mx-auto py-8">
      <h2 className="text-xl font-semibold">Community Discussion</h2>
      <div className="mt-4 bg-card p-4 rounded">
        <label htmlFor="postBody" className="sr-only">
          Share something
        </label>
        <textarea
          id="postBody"
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full min-h-[80px] p-2 rounded border"
          placeholder="Share something..."
        />
        <div className="flex items-center gap-2 mt-2">
          <input
            id="postAttachments"
            name="attachments"
            type="file"
            multiple
            ref={fileRef}
            onChange={(e) => handleUploadFiles(e.target.files)}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            size="sm"
          >
            Upload
          </Button>
          <Button onClick={submitPost} size="sm">
            Post
          </Button>
        </div>
        {attachments.length > 0 && (
          <div className="mt-2 flex gap-2 flex-wrap">
            {attachments.map((a) => (
              <div
                key={a.id}
                className="w-24 h-24 overflow-hidden rounded border"
              >
                <img
                  src={a.url}
                  alt="attachment"
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 space-y-4">
        {posts.map((p) => (
          <div key={p.id} className="bg-card p-4 rounded">
            <div className="flex items-start gap-3">
              <div className="font-semibold">
                {(p.metadata && p.metadata.author_name) ||
                  p.author_name ||
                  "Anonymous"}
              </div>
              <div className="text-sm text-foreground/70">
                {new Date(p.created_at).toLocaleString()}
              </div>
            </div>
            <div className="mt-2">{p.body}</div>
            {p.media && p.media.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {p.media.map((m: any) => (
                  <div
                    key={m.id}
                    className="w-full h-40 overflow-hidden rounded"
                  >
                    {m.mime && m.mime.startsWith("video") ? (
                      <video
                        src={m.url}
                        controls
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img
                        src={m.url}
                        alt="media"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 flex items-center gap-3 text-sm text-foreground/70">
              <div className="flex items-center gap-2">
                {["heart", "like", "smile", "clap", "wow", "sad"].map((r) => (
                  <button
                    key={r}
                    className="text-lg"
                    onClick={async () => {
                      try {
                        await (
                          await import("@/lib/api")
                        ).apiFetch(`/api/posts/${p.id}/reactions`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ type: r }),
                        });
                        load();
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                  >
                    {
                      {
                        heart: "❤️",
                        like: "👍",
                        smile: "😊",
                        clap: "👏",
                        wow: "😮",
                        sad: "😢",
                      }[r]
                    }
                  </button>
                ))}
              </div>
              <div>
                {Object.entries(p.reactions || {})
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" • ")}
              </div>
              <div>{p.comment_count} comments</div>
            </div>
            <div className="mt-2">
              <Comments postId={p.id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Comments({ postId }: { postId: string }) {
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState("");
  useEffect(() => {
    (async () => {
      try {
        const j = await (
          await import("@/lib/api")
        ).apiFetch(`/api/posts/${postId}/comments`);
        const arr = Array.isArray(j)
          ? j
          : j && (j as any).rows
            ? (j as any).rows
            : [];
        setComments(arr);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [postId]);

  async function add() {
    if (!text) return;
    try {
      await (
        await import("@/lib/api")
      ).apiFetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      setText("");
      const j = await (
        await import("@/lib/api")
      ).apiFetch(`/api/posts/${postId}/comments`);
      const arr = Array.isArray(j)
        ? j
        : j && (j as any).rows
          ? (j as any).rows
          : [];
      setComments(arr);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div>
      <div className="space-y-2">
        {comments.map((c) => (
          <div key={c.id} className="p-2 border rounded">
            <div className="font-medium">{c.author_name || "User"}</div>
            <div className="text-sm text-foreground/70">{c.body}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <label htmlFor="commentInput" className="sr-only">
          Add comment
        </label>
        <input
          id="commentInput"
          name="comment"
          className="flex-1 p-2 rounded border"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          onClick={add}
          className="h-10 px-4 rounded-md bg-primary text-primary-foreground"
        >
          Comment
        </button>
      </div>
    </div>
  );
}

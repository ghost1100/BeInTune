import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Attachment {
  id: string;
  url: string;
  mime?: string;
}

interface DiscussionPost {
  id: string;
  body?: string;
  created_at?: string;
  metadata?: Record<string, unknown> | null;
  author_name?: string | null;
  comment_count?: number;
  media?: Attachment[];
  reactions?: Record<string, number>;
}

type CommentRecord = {
  id: string;
  author_name?: string | null;
  body?: string;
};

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

import useAuth from "@/hooks/use-auth";

export default function DiscussionFeed({ className }: { className?: string }) {
  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { user } = useAuth();
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");

  useEffect(() => {
    loadPosts();
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.host}/ws`);
    ws.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "post:new") {
          loadPosts();
        }
      } catch (error) {
        console.error(error);
      }
    });
    return () => {
      ws.close();
    };
  }, []);

  async function loadPosts() {
    try {
      const response = await (await import("@/lib/api")).apiFetch("/api/posts");
      const list = Array.isArray(response)
        ? (response as DiscussionPost[])
        : response && (response as any).rows
          ? ((response as any).rows as DiscussionPost[])
          : [];
      setPosts(list);
    } catch (err: any) {
      toast({
        title: "Unable to load posts",
        description: err?.message || "Something went wrong",
      });
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      try {
        const data = await fileToBase64(file);
        const payload = await (
          await import("@/lib/api")
        ).apiFetch("/api/admin/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, data }),
        });
        if (!payload || typeof payload === "string") {
          throw new Error("Upload failed");
        }
        setAttachments((prev) => [
          ...prev,
          {
            id: (payload as any).id,
            url: (payload as any).url,
            mime: file.type,
          },
        ]);
      } catch (err: any) {
        toast({
          title: "Upload error",
          description: err?.message || "Unable to upload file",
        });
      }
    }
  }

  async function submitPost() {
    if (!body && attachments.length === 0) return;
    try {
      await (
        await import("@/lib/api")
      ).apiFetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          attachments: attachments.map((attachment) => attachment.id),
        }),
      });
      setBody("");
      setAttachments([]);
      toast({ title: "Posted" });
      loadPosts();
    } catch (err: any) {
      toast({
        title: "Unable to post",
        description: err?.message || "Please try again",
      });
    }
  }

  async function handleReaction(postId: string, reaction: string, current?: string | null) {
    try {
      if (current === reaction) {
        // remove
        await (await import("@/lib/api")).apiFetch(`/api/posts/${postId}/reactions`, {
          method: "DELETE",
        });
      } else {
        await (
          await import("@/lib/api")
        ).apiFetch(`/api/posts/${postId}/reactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: reaction }),
        });
      }
      loadPosts();
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <section className={cn("space-y-6", className)}>
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">Discussion</h2>
        <p className="text-sm text-foreground/70">
          Share updates, ask questions, and collaborate with your class
          community.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <label htmlFor="discussionBody" className="sr-only">
          Share something with the community
        </label>
        <textarea
          id="discussionBody"
          name="discussionBody"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="w-full min-h-[80px] rounded border p-2"
          placeholder="Share something..."
        />
        <div className="mt-3 flex items-center gap-2">
          <input
            ref={fileRef}
            id="discussionAttachments"
            type="file"
            multiple
            className="hidden"
            onChange={(event) => handleUpload(event.target.files)}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            Upload
          </Button>
          <Button size="sm" onClick={submitPost}>
            Post
          </Button>
        </div>
        {attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="h-24 w-24 overflow-hidden rounded border"
              >
                <img
                  src={attachment.url}
                  alt="Attachment preview"
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {posts.map((post) => (
          <article key={post.id} className="rounded-lg border bg-card p-4">
            <header className="flex flex-wrap items-start justify-between gap-2">
              <div className="font-medium">
                {(post.metadata && (post.metadata as any).author_name) ||
                  post.author_name ||
                  "Anonymous"}
              </div>
              <div className="text-right">
                {post.created_at && (
                  <div>
                    <time
                      className="text-xs text-foreground/60"
                      dateTime={post.created_at}
                    >
                      {new Date(post.created_at).toLocaleString()}
                    </time>
                  </div>
                )}
                {/* edited tag */}
                {(post.metadata && (post.metadata as any).edited) && (
                  <div className="text-xs mt-1 text-black dark:text-blue-400">edited</div>
                )}
              </div>
            </header>

            {/* editable body inline */}
            {editingPostId === post.id ? (
              <div className="mt-2">
                <textarea
                  value={editingBody}
                  onChange={(e) => setEditingBody(e.target.value)}
                  className="w-full rounded border p-2"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    className="px-3 py-1 rounded bg-primary text-primary-foreground"
                    onClick={async () => {
                      try {
                        await (await import("@/lib/api")).apiFetch(`/api/posts/${post.id}`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ body: editingBody }),
                        });
                        setEditingPostId(null);
                        setEditingBody("");
                        loadPosts();
                        toast({ title: "Post updated" });
                      } catch (err: any) {
                        toast({ title: "Unable to update", description: err?.message });
                      }
                    }}
                  >
                    Save
                  </button>
                  <button
                    className="px-3 py-1 rounded border"
                    onClick={() => {
                      setEditingPostId(null);
                      setEditingBody("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              post.body && (
                <p className="mt-2 text-sm text-foreground/90">{post.body}</p>
              )
            )}
            {post.media && post.media.length > 0 && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {post.media.map((media) => (
                  <div key={media.id} className="overflow-hidden rounded">
                    {media.mime?.startsWith("video") ? (
                      <video
                        src={media.url}
                        controls
                        className="h-40 w-full object-cover"
                      />
                    ) : (
                      <img
                        src={media.url}
                        alt="Post attachment"
                        className="h-40 w-full object-cover"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
            <footer className="mt-3 flex flex-wrap items-center gap-3 text-xs text-foreground/70">
              <div className="flex items-center gap-2">
                {[
                  ["heart", "❤️"],
                  ["like", "👍"],
                  ["smile", "😊"],
                  ["clap", "👏"],
                  ["wow", "😮"],
                  ["sad", "😢"],
                ].map(([type, icon]) => {
                  const count = (post.reactions && (post.reactions as any)[type]) || 0;
                  const active = post.user_reaction === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => addReaction(post.id, type)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded ${active ? "bg-primary/20" : "hover:bg-muted/20"}`}
                    >
                      <span aria-hidden>{icon}</span>
                      <span className="text-xs font-medium">{count}</span>
                    </button>
                  );
                })}
              </div>
              <div className="text-xs">
                {typeof post.comment_count === "number"
                  ? `${post.comment_count} comments`
                  : "Comments"}
              </div>

              {/* edit / delete controls for original poster */}
              {user && (post.author_id === user.id || (post.metadata && (post.metadata as any).author_name === user.name)) && (
                <div className="ml-auto flex items-center gap-2 border-dashed border rounded px-2 py-1">
                  <button
                    type="button"
                    className="text-sm px-2"
                    onClick={() => {
                      setEditingPostId(post.id);
                      setEditingBody(post.body || "");
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-sm text-destructive"
                    onClick={async () => {
                      if (!confirm("Delete this post?")) return;
                      try {
                        await (await import("@/lib/api")).apiFetch(`/api/posts/${post.id}`, { method: "DELETE" });
                        loadPosts();
                        toast({ title: "Post deleted" });
                      } catch (err: any) {
                        toast({ title: "Unable to delete", description: err?.message });
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </footer>
            <div className="mt-3">
              <Comments postId={post.id} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Comments({ postId }: { postId: string }) {
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    loadComments();
  }, [postId]);

  async function loadComments() {
    try {
      const response = await (
        await import("@/lib/api")
      ).apiFetch(`/api/posts/${postId}/comments`);
      const list = Array.isArray(response)
        ? (response as CommentRecord[])
        : response && (response as any).rows
          ? ((response as any).rows as CommentRecord[])
          : [];
      setComments(list);
    } catch (error) {
      console.error(error);
    }
  }

  async function submitComment() {
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
      loadComments();
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {comments.map((comment) => (
          <div key={comment.id} className="rounded border p-2">
            <div className="text-xs font-medium text-foreground/70">
              {comment.author_name || "User"}
            </div>
            <div className="text-sm text-foreground/90">{comment.body}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <label htmlFor={`comment-${postId}`} className="sr-only">
          Add comment
        </label>
        <input
          id={`comment-${postId}`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="flex-1 rounded border p-2"
          placeholder="Add a comment"
        />
        <Button size="sm" onClick={submitComment}>
          Comment
        </Button>
      </div>
    </div>
  );
}

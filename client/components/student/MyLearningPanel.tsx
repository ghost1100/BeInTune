import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import useAuth from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import Lightbox from "@/components/ui/Lightbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface StudentRecord {
  id?: string;
  student_id?: string;
  user_id?: string;
  name?: string;
  email?: string;
}

interface ResourceMedia {
  id: string;
  url: string;
  mime?: string;
}

interface LearningResource {
  id: string;
  title?: string;
  created_at?: string;
  media?: ResourceMedia[];
}

interface BookingRecord {
  id: string;
  student_id?: string;
  student_user_id?: string;
  created_at?: string;
  start_time?: string;
  end_time?: string;
  metadata?: Record<string, unknown> | null;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function getVideoDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const vid = document.createElement("video");
    vid.preload = "metadata";
    vid.src = url;
    vid.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(vid.duration || 0);
    };
    vid.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
  });
}

function filesToFileList(files: File[]) {
  const dt = new DataTransfer();
  files.forEach((f) => dt.items.add(f));
  return dt.files;
}

export default function MyLearningPanel({ className }: { className?: string }) {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [upcoming, setUpcoming] = useState<BookingRecord | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxMime, setLightboxMime] = useState<string | null>(null);

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [dialogFiles, setDialogFiles] = useState<File[]>([]);
  const dialogInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const j = await (
          await import("@/lib/api")
        ).apiFetch("/api/admin/students");
        const list = Array.isArray(j)
          ? (j as StudentRecord[])
          : j && (j as any).rows
            ? ((j as any).rows as StudentRecord[])
            : [];
        if (user && user.role === "student") {
          const mine = list.find((s) => s.user_id === user.id);
          if (mine) {
            setStudents([mine]);
            setSelected(mine.student_id || mine.id || null);
          } else {
            setStudents([]);
            setSelected(null);
          }
        } else {
          setStudents(list);
          if (list.length)
            setSelected(list[0].student_id || list[0].id || null);
        }
      } catch (e) {
        console.error(e);
        setStudents([]);
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!selected) {
      setResources([]);
      setUpcoming(null);
      return;
    }
    (async () => {
      try {
        const j = await (
          await import("@/lib/api")
        ).apiFetch(`/api/admin/learning/${selected}`);
        const arr = Array.isArray(j)
          ? (j as LearningResource[])
          : j && (j as any).rows
            ? ((j as any).rows as LearningResource[])
            : [];
        // ensure newest first
        arr.sort((a, b) => {
          const at = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bt - at;
        });
        setResources(arr);
      } catch (e) {
        console.error(e);
        setResources([]);
      }
    })();

    (async () => {
      try {
        const response = await (
          await import("@/lib/api")
        ).apiFetch("/api/admin/bookings");
        const list = Array.isArray(response)
          ? (response as BookingRecord[])
          : response && (response as any).rows
            ? ((response as any).rows as BookingRecord[])
            : [];
        const next = list
          .filter((booking) =>
            booking.student_id === selected
              ? true
              : Boolean(
                  booking.student_user_id &&
                    user &&
                    booking.student_user_id === user.id,
                ),
          )
          .sort((a, b) => {
            const aTime = bookingDate(a);
            const bTime = bookingDate(b);
            return aTime - bTime;
          })[0];
        setUpcoming(next || null);
      } catch (e) {
        console.error(e);
        setUpcoming(null);
      }
    })();
  }, [selected, user]);

  async function uploadResources(files: FileList | null) {
    if (!files || !selected) return;
    try {
      const uploaded: ResourceMedia[] = [];
      for (const file of Array.from(files)) {
        if (file.type.startsWith("video")) {
          const dur = await getVideoDuration(file);
          if (dur > 180)
            throw new Error("Video too long. Maximum allowed is 3 minutes.");
        }
        const content = await fileToBase64(file);
        const payload = await (
          await import("@/lib/api")
        ).apiFetch("/api/admin/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, data: content }),
        });
        if (!payload || typeof payload === "string") {
          throw new Error("Upload failed");
        }
        uploaded.push({
          id: (payload as any).id,
          url: (payload as any).url,
          mime: file.type,
        });
      }

      const response = await (
        await import("@/lib/api")
      ).apiFetch(`/api/admin/learning/${selected}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Resources",
          description: "",
          media: uploaded,
        }),
      });
      const arr = Array.isArray(response)
        ? (response as LearningResource[])
        : response && (response as any).rows
          ? ((response as any).rows as LearningResource[])
          : [];
      setResources(arr);
      toast({ title: "Resources uploaded" });
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err?.message || "Unable to upload resources",
      });
    }
  }

  function bookingDate(booking: BookingRecord) {
    const value = booking.start_time || booking.created_at || "";
    return value ? new Date(value).getTime() : Number.POSITIVE_INFINITY;
  }

  function activeStudents() {
    if (!students.length) {
      return (
        <p className="text-sm text-foreground/70">
          No student records found for your account yet.
        </p>
      );
    }

    return (
      <div className="mt-2 space-y-2">
        {students.map((student) => {
          const id = student.student_id || student.id;
          const isSelected = selected === id;
          return (
            <div
              key={id}
              className={cn(
                "w-full rounded border p-2 flex items-center justify-between transition-colors",
                isSelected ? "bg-muted" : "bg-background",
              )}
            >
              <button
                type="button"
                onClick={() => setSelected(id || null)}
                className="text-left flex-1"
              >
                <div className="font-medium">
                  {student.name || student.email}
                </div>
                <div className="text-sm text-foreground/70">
                  {student.email}
                </div>
              </button>

              {user?.role === "admin" && (
                <div className="ml-3 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelected(id || null);
                      setDialogFiles([]);
                      setUploadDialogOpen(true);
                    }}
                  >
                    Upload material
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function resourceCards() {
    if (!resources.length) {
      return (
        <div className="rounded border border-dashed p-6 text-center text-sm text-foreground/70">
          No learning resources uploaded yet.
        </div>
      );
    }

    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {resources.map((resource) => (
          <article key={resource.id} className="rounded border p-3">
            <header className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold">
                {resource.title || "Resource"}
              </h3>
              {resource.created_at && (
                <time
                  dateTime={resource.created_at}
                  className="text-xs text-foreground/70"
                >
                  {new Date(resource.created_at).toLocaleString()}
                </time>
              )}
            </header>
            {resource.media && resource.media.length > 0 && (
              <div className="mt-3 space-y-2">
                {resource.media.map((media) => (
                  <div key={media.id || media.url}>
                    {media.mime?.startsWith("video") ? (
                      <button
                        type="button"
                        className="block w-full h-40 overflow-hidden rounded"
                        onClick={() => {
                          setLightboxSrc(media.url);
                          setLightboxMime(media.mime || null);
                        }}
                      >
                        <video
                          src={media.url}
                          className="h-40 w-full object-cover"
                          aria-hidden
                        />
                      </button>
                    ) : media.mime?.startsWith("image") ? (
                      <button
                        type="button"
                        className="block w-full h-40 overflow-hidden rounded"
                        onClick={() => {
                          setLightboxSrc(media.url);
                          setLightboxMime(media.mime || null);
                        }}
                      >
                        <img
                          src={media.url}
                          alt="resource"
                          className="h-40 w-full object-cover"
                        />
                      </button>
                    ) : (
                      <a
                        href={media.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-sm font-medium text-primary underline"
                      >
                        Download {media.mime?.split("/")[1] || "file"}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    );
  }

  function onDialogDrop(e: React.DragEvent) {
    e.preventDefault();
    const dt = e.dataTransfer;
    if (!dt || !dt.files) return;
    const arr = Array.from(dt.files);
    setDialogFiles((prev) => [...prev, ...arr]);
  }

  function onDialogDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDialogInputChange(
    e: React.ChangeEvent<HTMLInputElement> | null,
  ) {
    if (!e) return;
    const files = e.target.files;
    if (!files) return;
    setDialogFiles((prev) => [...prev, ...Array.from(files)]);
    e.target.value = "";
  }

  function removeDialogFile(index: number) {
    setDialogFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function startDialogUpload() {
    if (!dialogFiles.length || !selected) return;
    const fl = filesToFileList(dialogFiles);
    await uploadResources(fl);
    setDialogFiles([]);
    setUploadDialogOpen(false);
  }

  return (
    <>
      <Lightbox
        src={lightboxSrc}
        mime={lightboxMime}
        onClose={() => {
          setLightboxSrc(null);
          setLightboxMime(null);
        }}
      />

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload material</DialogTitle>
            <DialogDescription>
              Drag and drop files here or click select. Videos must be 3 minutes
              or shorter.
            </DialogDescription>
          </DialogHeader>

          <div
            onDrop={onDialogDrop}
            onDragOver={onDialogDragOver}
            className="mt-4 flex h-44 flex-col items-center justify-center rounded border border-dashed bg-background/80 p-4 text-center"
          >
            <input
              ref={dialogInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleDialogInputChange(e)}
            />
            <p className="text-sm text-foreground/70">Drop files here</p>
            <div className="mt-3 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => dialogInputRef.current?.click()}
              >
                Select files
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDialogFiles([]);
                }}
              >
                Clear
              </Button>
            </div>
          </div>

          {dialogFiles.length > 0 && (
            <div className="mt-4 max-h-40 overflow-auto">
              {dialogFiles.map((f, idx) => (
                <div
                  key={`${f.name}-${idx}`}
                  className="flex items-center justify-between border-b py-2"
                >
                  <div className="text-sm">{f.name}</div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-foreground/70">
                      {(f.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeDialogFile(idx)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="mt-4">
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => setUploadDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={!dialogFiles.length}
                onClick={startDialogUpload}
              >
                Upload
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <section className={cn("space-y-6", className)}>
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">My learning</h2>
          <p className="text-sm text-foreground/70">
            Access shared lesson material, upcoming bookings, and practise
            files.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[240px,1fr]">
          <aside className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-medium text-foreground/80">Students</h3>
            {activeStudents()}
          </aside>

          <div className="space-y-4">
            {upcoming && (
              <div className="rounded-lg border bg-muted/40 p-4">
                <h3 className="text-sm font-semibold text-foreground/80">
                  Next lesson
                </h3>
                <p className="text-sm text-foreground/70">
                  {upcoming.start_time
                    ? new Date(upcoming.start_time).toLocaleString()
                    : upcoming.created_at
                      ? new Date(upcoming.created_at).toLocaleString()
                      : "Scheduled details coming soon."}
                </p>
                {upcoming.metadata && (
                  <pre className="mt-2 rounded bg-background/80 p-2 text-xs text-foreground/70">
                    {JSON.stringify(upcoming.metadata, null, 2)}
                  </pre>
                )}
              </div>
            )}

            <div className="rounded-lg border bg-card p-4">
              {user && user.role === "admin" && (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-foreground/70">
                    Upload resources to share with the selected student.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileRef}
                      id="learningResources"
                      type="file"
                      name="learningResources"
                      multiple
                      className="hidden"
                      onChange={(event) => uploadResources(event.target.files)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileRef.current?.click()}
                    >
                      Upload
                    </Button>
                  </div>
                </div>
              )}

              <div className={cn(user?.role === "admin" ? "mt-4" : "")}>
                {resourceCards()}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

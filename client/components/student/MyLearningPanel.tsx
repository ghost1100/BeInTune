import { useEffect, useRef, useState } from "react";
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

export default function MyLearningPanel({
  className,
}: {
  className?: string;
}) {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [upcoming, setUpcoming] = useState<BookingRecord | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

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
          if (list.length) setSelected(list[0].student_id || list[0].id || null);
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
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSelected(id || null)}
              className={cn(
                "w-full rounded border p-2 text-left transition-colors hover:bg-muted",
                selected === id ? "bg-muted" : "bg-background",
              )}
            >
              <div className="font-medium">{student.name || student.email}</div>
              <div className="text-sm text-foreground/70">{student.email}</div>
            </button>
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
                  <a
                    key={media.id || media.url}
                    href={media.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-sm font-medium text-primary underline"
                  >
                    Download {media.mime?.split("/")[1] || "file"}
                  </a>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    );
  }

  return (
    <section className={cn("space-y-6", className)}>
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">My learning</h2>
        <p className="text-sm text-foreground/70">
          Access shared lesson material, upcoming bookings, and practise files.
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

            <div className={cn(user?.role === "admin" ? "mt-4" : "")}>{resourceCards()}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

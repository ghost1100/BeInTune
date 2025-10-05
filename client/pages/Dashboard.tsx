import { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import useAuth from "@/hooks/use-auth";
import MyLearningPanel from "@/components/student/MyLearningPanel";
import DiscussionFeed from "@/components/student/DiscussionFeed";
import ChatsPanel from "@/components/student/ChatsPanel";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState("learning");

  const [bookings, setBookings] = useState<any[]>([]);

  // Load upcoming bookings for this student
  useEffect(() => {
    (async () => {
      try {
        const res = await (await import("@/lib/api")).apiFetch(`/api/admin/bookings`);
        const rows = Array.isArray(res) ? res : res && (res as any).rows ? (res as any).rows : [];
        const mine = user ? rows.filter((b: any) => b.student_user_id === user.id) : [];
        // helper to normalize date/time
        function toTimestamp(item: any) {
          try {
            // normalize date-only string YYYY-MM-DD
            let dateOnly: string | null = null;
            if (!item || !item.date) return Number.POSITIVE_INFINITY;
            if (typeof item.date === "string") {
              dateOnly = item.date.split("T")[0];
            } else if (item.date instanceof Date) {
              dateOnly = item.date.toISOString().slice(0, 10);
            } else {
              dateOnly = String(item.date);
            }
            // normalize time to HH:MM:SS (strip zone)
            const time = item.time ? String(item.time).split("+")[0] : "00:00:00";
            // ensure time has seconds
            const timeParts = time.split(":");
            let timeNorm = time;
            if (timeParts.length === 2) timeNorm = `${timeParts[0]}:${timeParts[1]}:00`;

            const iso = `${dateOnly}T${timeNorm}`;
            const ts = new Date(iso).getTime();
            if (Number.isNaN(ts)) return Number.POSITIVE_INFINITY;
            return ts;
          } catch (e) {
            return Number.POSITIVE_INFINITY;
          }
        }

        // sort by date/time
        mine.sort((a: any, b: any) => toTimestamp(a) - toTimestamp(b));
        setBookings(mine);
      } catch (err) {
        console.error("Failed to load bookings", err);
        setBookings([]);
      }
    })();
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "student") return <Navigate to="/admin" replace />;

  const displayName = user.username || user.name || user.email;

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch (e) {
      console.error("Logout request failed", e);
    }

    try {
      localStorage.removeItem("inTuneStudent");
      localStorage.removeItem("inTuneAdmin");
      localStorage.removeItem("inTuneToken");
      localStorage.removeItem("inTuneContent");
      sessionStorage.clear();

      if (typeof window !== "undefined" && (window as any).caches) {
        const keys = await (window as any).caches.keys();
        await Promise.all(keys.map((k: string) => (window as any).caches.delete(k)));
      }

      if (typeof document !== "undefined") {
        document.cookie.split(";").forEach((cookie) => {
          const eqPos = cookie.indexOf("=");
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        });
      }

      if (typeof navigator !== "undefined" && navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch (err) {
      console.error("Error clearing client data during logout", err);
    }

    navigate("/");
  };

  return (
    <div className="bg-muted/40 py-10">
      <div className="container mx-auto space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-foreground/60">
              Welcome back{displayName ? `, ${displayName}` : ""}
            </p>
            <h1 className="text-3xl font-semibold">Student dashboard</h1>
            <p className="text-sm text-foreground/70">
              Manage your lessons, join discussions, and stay connected with your
              tutors.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={logout}>Logout</Button>
          </div>
        </header>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">

        {/* Upcoming lessons */}
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-lg font-semibold">Upcoming lessons</h2>
          {bookings.length === 0 ? (
            <p className="text-sm text-foreground/70 mt-2">No upcoming lessons scheduled.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {bookings.map((b) => (
                <li key={b.id} className="flex items-center justify-between rounded border p-2">
                  <div>
                    <div className="font-medium">
                      {b.student_name || b.student_email}
                    </div>
                    <div className="text-xs text-foreground/70">
                      {new Date(`${b.date}T${b.time}`).toLocaleString()} • {b.lesson_type || "Lesson"}
                    </div>
                  </div>
                  <div>
                    <a href={`/admin/slots?date=${b.date}`} className="text-sm text-primary underline">View</a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
          <TabsList className="w-fit">
            <TabsTrigger value="learning">My learning</TabsTrigger>
            <TabsTrigger value="discussion">Discussion</TabsTrigger>
            <TabsTrigger value="chats">Chats</TabsTrigger>
          </TabsList>

          <TabsContent value="learning" className="mt-4">
            <MyLearningPanel />
          </TabsContent>
          <TabsContent value="discussion" className="mt-4">
            <DiscussionFeed />
          </TabsContent>
          <TabsContent value="chats" className="mt-4">
            <ChatsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

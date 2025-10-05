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

  if (loading) return null;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "student") return <Navigate to="/admin" replace />;

  const displayName = user.username || user.name || user.email;

  const [bookings, setBookings] = useState<any[]>([]);

  // Load upcoming bookings for this student
  useEffect(() => {
    (async () => {
      try {
        const res = await (await import("@/lib/api")).apiFetch(`/api/admin/bookings`);
        const rows = Array.isArray(res) ? res : res && (res as any).rows ? (res as any).rows : [];
        const mine = rows.filter((b: any) => b.student_user_id === user.id);
        // sort by date/time
        mine.sort((a: any, b: any) => {
          const da = new Date(`${a.date}T${a.time}`).getTime();
          const db = new Date(`${b.date}T${b.time}`).getTime();
          return da - db;
        });
        setBookings(mine);
      } catch (err) {
        console.error("Failed to load bookings", err);
        setBookings([]);
      }
    })();
  }, [user]);

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

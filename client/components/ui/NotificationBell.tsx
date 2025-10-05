import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import useAuth from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";

export default function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  async function fetchNotifications() {
    if (!user) return;
    try {
      const { apiFetch } = await import("@/lib/api");
      const data = await apiFetch("/api/notifications");
      const list = Array.isArray(data) ? data : [];
      setNotifications(list);
      setUnreadCount(list.filter((n: any) => !n.is_read).length);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 15000);
    return () => clearInterval(id);
  }, [user]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  async function markRead(id: string) {
    try {
      const { apiFetch } = await import("@/lib/api");
      await apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      fetchNotifications();
    } catch (e) {
      console.error(e);
    }
  }

  function handleNotificationClick(n: any) {
    // mark read
    if (!n.is_read) markRead(n.id);
    // navigate based on type/meta
    const meta = n.meta || {};
    if (n.type === "message") {
      // open chats; if actor present, open chat with them
      navigate(`/chats${meta.actor_id ? `?user=${meta.actor_id}` : ""}`);
    } else if (n.type.startsWith("post")) {
      navigate(`/discussion${meta.postId ? `?post=${meta.postId}` : ""}`);
    } else if (n.type === "mention") {
      navigate(`/discussion${meta.postId ? `?post=${meta.postId}` : ""}`);
    } else {
      navigate("/discussion");
    }
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative p-2 rounded-full"
        title="Notifications"
      >
        <svg className="h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-xs w-5 h-5">{unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] max-w-[95vw] rounded bg-card shadow-lg z-50">
          <div className="p-3 border-b">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Notifications</div>
              <button className="text-sm text-foreground/70" onClick={() => { setNotifications([]); setUnreadCount(0); }}>Clear</button>
            </div>
          </div>
          <div className="max-h-72 overflow-auto p-2 space-y-2">
            {notifications.length === 0 && <div className="text-sm text-foreground/60 p-3">No notifications</div>}
            {notifications.map((n) => (
              <div key={n.id} className={cn("p-2 rounded hover:bg-muted cursor-pointer flex items-start gap-2", n.is_read ? "opacity-80" : "bg-background/60 border-l-4 border-primary")}
                onClick={() => handleNotificationClick(n)}>
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">🔔</div>
                </div>
                <div className="flex-1 text-sm">
                  <div className="font-medium">
                    <button
                      onClick={(e) => { e.stopPropagation(); if (n.actor_id) navigate(`/chats?user=${n.actor_id}`); }}
                      className="text-left text-sm font-medium text-foreground/90"
                    >
                      {n.actor_name || (n.actor_id ? "Someone" : "System")}
                    </button>
                    {n.type === 'post:edited_by_admin' && <span className="ml-2 text-xs text-destructive">edited by admin</span>}
                    {n.type === 'post:deleted_by_admin' && <span className="ml-2 text-xs text-destructive">deleted by admin</span>}
                  </div>
                  <div className="text-xs text-foreground/70 mt-1">{(n.meta && n.meta.snippet) || n.meta?.message || n.type}</div>
                  <div className="text-xs text-foreground/50 mt-1">{new Date(n.created_at).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

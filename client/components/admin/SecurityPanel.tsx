import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import useAuth from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

type AuditLog = {
  id: string;
  created_at: string;
  action: string;
  meta: Record<string, unknown>;
  role?: string | null;
  displayName: string;
  targetDisplayName?: string | null;
};

const ADMIN_ROLES = new Set(["admin", "teacher"]);

function formatDate(value: string) {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  } catch {
    return value;
  }
}

function MetaPreview({ meta }: { meta: Record<string, unknown> }) {
  const hasEntries = useMemo(() => {
    if (!meta || typeof meta !== "object") return false;
    return Object.keys(meta).length > 0;
  }, [meta]);

  if (!hasEntries) {
    return (
      <div className="text-xs text-foreground/60">No additional metadata</div>
    );
  }

  return (
    <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-xs text-foreground/80">
      {JSON.stringify(meta, null, 2)}
    </pre>
  );
}

export default function SecurityPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [identifier, setIdentifier] = useState(" ");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const loadLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/audit-logs");
      if (!res.ok) throw new Error("Failed to load logs");
      const data = await res.json();
      if (!Array.isArray(data)) {
        setLogs([]);
        return;
      }
      const sanitised: AuditLog[] = data.map((entry: any) => {
        const meta =
          entry && typeof entry.meta === "object" && entry.meta !== null
            ? entry.meta
            : {};
        const displayName =
          entry?.displayName ||
          entry?.username ||
          entry?.email ||
          "System";
        return {
          id: String(entry.id),
          created_at: entry.created_at,
          action: entry.action,
          meta,
          role: entry.role,
          displayName,
          targetDisplayName: entry?.targetDisplayName ?? null,
        };
      });
      setLogs(sanitised);
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to load audit logs",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (!user) return;
    if (identifier.trim()) return;
    const nextIdentifier = user.username || user.email;
    if (nextIdentifier) setIdentifier(nextIdentifier);
  }, [user, identifier]);

  const adminLogs = logs.filter((log) =>
    ADMIN_ROLES.has((log.role ?? "").toLowerCase()),
  );
  const userLogs = logs.filter(
    (log) => !ADMIN_ROLES.has((log.role ?? "").toLowerCase()),
  );

  const resetForm = () => {
    setCurrentPassword("");
    setNewUsername("");
    setNewPassword("");
    setConfirmPassword("");
    if (user?.username || user?.email) {
      setIdentifier(user.username || user.email);
    }
  };

  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedIdentifier = identifier.trim();
    const trimmedUsername = newUsername.trim();

    if (!trimmedIdentifier) {
      toast({
        title: "Identifier required",
        description: "Enter your current username or email.",
        variant: "destructive",
      });
      return;
    }
    if (!currentPassword) {
      toast({
        title: "Current password required",
        description: "Enter your existing password to confirm changes.",
        variant: "destructive",
      });
      return;
    }
    if (!trimmedUsername && !newPassword) {
      toast({
        title: "Nothing to update",
        description: "Provide a new username or a new password.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Confirm password must match the new password.",
        variant: "destructive",
      });
      return;
    }

    const payload: Record<string, string> = {
      identifier: trimmedIdentifier,
      currentPassword,
    };
    if (trimmedUsername) payload.newUsername = trimmedUsername;
    if (newPassword) payload.newPassword = newPassword;

    try {
      setSaving(true);
      const res = await fetch("/api/admin/me/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          data?.error || data?.message || "Unable to update credentials";
        throw new Error(message);
      }

      toast({
        title: "Credentials updated",
        description: "Your admin profile has been updated.",
      });

      if (trimmedUsername) {
        setIdentifier(trimmedUsername);
      }
      resetForm();
      await loadLogs();
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Update failed",
        description: error?.message || "Please verify your details and retry.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const renderLogCard = (log: AuditLog) => (
    <div key={log.id} className="rounded-lg border bg-card/40 p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-foreground/70">
        <span>{formatDate(log.created_at)}</span>
        {log.role && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wide text-foreground/80">
            {log.role}
          </span>
        )}
      </div>
      <div className="mt-1 text-sm font-semibold text-foreground">
        {log.displayName}
      </div>
      {log.targetDisplayName && (
        <div className="text-xs text-foreground/70">
          Target: <span className="font-medium text-foreground">{log.targetDisplayName}</span>
        </div>
      )}
      <div className="mt-2 text-sm font-medium text-primary">{log.action}</div>
      <MetaPreview meta={log.meta} />
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 font-semibold">User actions</h3>
          <div className="space-y-2 rounded-lg border p-3">
            {userLogs.length === 0 && (
              <div className="text-sm text-foreground/70">
                No user actions recorded yet.
              </div>
            )}
            <div className="max-h-[60vh] space-y-2 overflow-auto pr-1">
              {userLogs.map(renderLogCard)}
            </div>
          </div>
        </div>
        <div>
          <h3 className="mb-2 font-semibold">Admin / Teacher actions</h3>
          <div className="space-y-2 rounded-lg border p-3">
            {adminLogs.length === 0 && (
              <div className="text-sm text-foreground/70">
                No admin or teacher events recorded yet.
              </div>
            )}
            <div className="max-h-[60vh] space-y-2 overflow-auto pr-1">
              {adminLogs.map(renderLogCard)}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Update admin credentials</h3>
            <p className="text-sm text-foreground/70">
              Change your username or password. You must confirm changes with
              your current password.
            </p>
          </div>
        </div>
        <form
          onSubmit={handleUpdateCredentials}
          className="mt-4 grid gap-3 md:grid-cols-2"
        >
          <div className="md:col-span-2">
            <label
              htmlFor="identifier"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Username or email
            </label>
            <input
              id="identifier"
              name="identifier"
              className="h-10 w-full rounded-md border px-3"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="md:col-span-2">
            <label
              htmlFor="currentPassword"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Current password
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              className="h-10 w-full rounded-md border px-3"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div>
            <label
              htmlFor="newUsername"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              New username (optional)
            </label>
            <input
              id="newUsername"
              name="newUsername"
              className="h-10 w-full rounded-md border px-3"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div>
            <label
              htmlFor="newPassword"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              New password (optional)
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              className="h-10 w-full rounded-md border px-3"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="md:col-span-2">
            <label
              htmlFor="confirmPassword"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              className="h-10 w-full rounded-md border px-3"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="md:col-span-2 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
              className="w-full sm:w-auto"
            >
              Clear
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={saving}
            >
              {saving ? "Saving changes..." : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

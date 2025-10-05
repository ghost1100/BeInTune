import { useEffect, useState } from "react";
import { getStudents } from "@/lib/students";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

function randomPassword(len = 12) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export default function StudentPasswordControls() {
  const [students, setStudents] = useState<any[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/students");
        if (!res.ok) return setStudents([]);
        const data = await res.json();
        setStudents(data);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const setPasswordForUser = async (userId: string, password: string) => {
    setLoadingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error("Failed to set password");
      toast({
        title: "Password set",
        description: "Password updated successfully.",
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Error",
        description: err?.message || "Unable to set password.",
      });
    } finally {
      setLoadingId(null);
    }
  };

  const sendReset = async (email: string) => {
    try {
      const res = await fetch(`/api/auth/send-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("Failed to send reset email");
      toast({
        title: "Reset sent",
        description: `Password reset email sent to ${email}`,
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Unable to send reset email.",
      });
    }
  };

  return (
    <div>
      <h3 className="font-semibold">Student password controls</h3>
      <p className="text-sm text-foreground/70">
        Set or randomize passwords for students, or trigger reset emails.
      </p>

      <div className="mt-3 space-y-2">
        {students.length === 0 && (
          <div className="text-foreground/70">No students yet.</div>
        )}
        {students.map((s: any) => (
          <div
            key={s.student_id}
            className="flex items-center justify-between gap-2 p-2 rounded-md border"
          >
            <div>
              <div className="font-medium">{s.name || s.email}</div>
              <div className="text-sm text-foreground/70">{s.email}</div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  const pw = randomPassword();
                  setPasswordForUser(s.user_id, pw);
                }}
                variant="outline"
              >
                Randomize
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const pw = prompt("Enter new password for user", "");
                  if (pw) setPasswordForUser(s.user_id, pw);
                }}
                variant="ghost"
              >
                Set
              </Button>
              <Button
                size="sm"
                onClick={() => sendReset(s.email)}
                variant="destructive"
              >
                Send reset
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

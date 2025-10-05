export type Student = {
  id: string;
  name: string;
  age?: number;
  isElderly?: boolean;
  email?: string;
  phone?: string;
  address?: string;
  emergencyContacts?: string;
  parentGuardianName?: string;
  parentGuardianEmail?: string;
  parentGuardianPhone?: string;
  medications?: string; // optional medical/medications disclosure
  marketingConsent?: boolean;
  allergies?: string;
  instruments?: string[];
  bandName?: string;
};

export const API = {
  async list() {
    const res = await fetch("/api/admin/students");
    if (!res.ok) return [];
    return res.json();
  },
  async create(payload: any) {
    const res = await fetch("/api/admin/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || "Failed to create student");
    }
    return res.json();
  },
  async update(id: string, payload: any) {
    const res = await fetch(`/api/admin/students/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || "Failed to update student");
    }
    return res.json();
  },
  async remove(id: string) {
    if (!id) throw new Error("Missing student id");
    const res = await fetch(`/api/admin/students/${id}`, { method: "DELETE" });
    let body: any = null;
    try {
      body = await res.json();
    } catch (e) {
      body = null;
    }
    if (res.status === 404) {
      // Already gone; treat as success so UI stays in sync
      return { ok: true, skipped: true };
    }
    if (!res.ok) {
      const message =
        body?.error || body?.message || "Failed to delete student";
      throw new Error(message);
    }
    if (body && typeof body === "object" && body.ok === false) {
      const message = body.error || body.message || "Failed to delete student";
      throw new Error(message);
    }
    return body || { ok: true };
  },
};

export type Student = {
  id: string;
  name: string;
  age?: number;
  isElderly?: boolean;
  email?: string;
  phone?: string;
  address?: string;
  emergencyContacts?: string;
  parentGuardianName?: string;
  parentGuardianEmail?: string;
  parentGuardianPhone?: string;
  medications?: string; // optional medical/medications disclosure
  marketingConsent?: boolean;
  allergies?: string;
  instruments?: string[];
  bandName?: string;
};

export default API;

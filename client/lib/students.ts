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
    return res.json();
  },
  async update(id: string, payload: any) {
    const res = await fetch(`/api/admin/students/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  },
  async remove(id: string) {
    const res = await fetch(`/api/admin/students/${id}`, { method: "DELETE" });
    return res.json();
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

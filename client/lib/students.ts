export const API = {
  async list() {
    const { apiFetch } = await import("@/lib/api");
    try {
      const res = await apiFetch("/api/admin/students");
      return Array.isArray(res) ? res : (res && (res as any).rows) || [];
    } catch (e) {
      console.error("students.list error", e);
      return [];
    }
  },
  async create(payload: any) {
    const { apiFetch } = await import("@/lib/api");
    const res = await apiFetch("/api/admin/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res;
  },
  async update(id: string, payload: any) {
    const { apiFetch } = await import("@/lib/api");
    const res = await apiFetch(`/api/admin/students/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res;
  },
  async remove(id: string) {
    if (!id) throw new Error("Missing student id");
    const { apiFetch } = await import("@/lib/api");
    const res = await apiFetch(`/api/admin/students/${id}`, {
      method: "DELETE",
    });
    return res;
  },
};

export default API;

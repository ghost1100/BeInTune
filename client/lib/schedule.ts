export type Booking = {
  id: string;
  // either studentId is provided or free-text name/email/phone
  studentId?: string;
  name?: string;
  email?: string;
  phone?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (24h)
  lessonType?: string;
};

function normalizeTime(value: any): string {
  if (!value && value !== 0) return "";
  if (typeof value === "string") {
    const match = value.match(/(\d{2}:\d{2})/);
    if (match) return match[1];
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(11, 16);
  }
  return String(value);
}

const AV_KEY = "inTuneAvailability";
const BK_KEY = "inTuneBookings";

async function readAvail(date?: string): Promise<Record<string, string[]>> {
  try {
    const d = date || new Date().toISOString().slice(0, 10);
    const api = (await import("@/lib/api")).apiFetch;
    const rows = await api(`/api/admin/slots?date=${d}`);
    const map: Record<string, string[]> = {};
    const list = Array.isArray(rows)
      ? rows
      : rows && Array.isArray((rows as any).rows)
        ? (rows as any).rows
        : [];
    if (list.length === 0) {
      map[d] = getSlotsForDay(d);
      return map;
    }
    map[d] = list
      .filter((r: any) => r.is_available !== false)
      .map((r: any) => normalizeTime(r.slot_time || r.slotTime || r.time));
    return map;
  } catch (e) {
    console.error("readAvail error", e);
    return {};
  }
}

async function writeAvail(a: Record<string, string[]>) {
  // Not implemented server-side as batch; caller should use slots API to create/delete slots.
}

async function readBookings(date?: string): Promise<Booking[]> {
  try {
    const q = date ? `?date=${date}` : "";
    const api = (await import("@/lib/api")).apiFetch;
    const rows = await api(`/api/admin/bookings${q}`);
    if (!rows) return [];
    const list = Array.isArray(rows)
      ? rows
      : rows && Array.isArray((rows as any).rows)
        ? (rows as any).rows
        : [];
    return list.map((r: any) => ({
      ...r,
      time: normalizeTime(r.time || r.slot_time || r.slotTime),
    }));
  } catch (e) {
    console.error("readBookings error", e);
    return [];
  }
}

async function writeBookings(b: Booking[]) {
  // Not used
}

export function getSlotsForDay(date: string, from = 8, to = 20): string[] {
  const slots: string[] = [];
  for (let h = from; h < to; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
}

export async function getAvailability(date: string): Promise<string[]> {
  const a = await readAvail(date);
  return a[date] || [];
}

export async function toggleAvailability(date: string, time: string) {
  try {
    const api = (await import("@/lib/api")).apiFetch;
    const rows = await api(`/api/admin/slots?date=${date}`);
    const existing = Array.isArray(rows) ? rows.find((r: any) => r.slot_time === time) : null;
    if (existing) {
      await api(`/api/admin/slots/${existing.id}`, { method: "DELETE" });
    } else {
      await api(`/api/admin/slots`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot_date: date, slot_time: time }) });
    }
  } catch (e) {
    console.error(e);
  }
}

export async function getBookings(date?: string): Promise<Booking[]> {
  return readBookings(date);
}

function getStudentById(id: string) {
  try {
    const raw = localStorage.getItem("inTuneStudents");
    if (!raw) return null;
    const list = JSON.parse(raw);
    return list.find((s: any) => s.id === id) || null;
  } catch (e) {
    return null;
  }
}

export async function addBooking(
  booking: Omit<Booking, "id">,
): Promise<Booking | null> {
  try {
    const api = (await import("@/lib/api")).apiFetch;
    const res = await api(`/api/admin/bookings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(booking) });
    return res as any;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function removeBooking(id: string) {
  try {
    const api = (await import("@/lib/api")).apiFetch;
    await api(`/api/admin/bookings/${id}`, { method: "DELETE" });
  } catch (e) {
    console.error(e);
  }
}


export function isSlotBooked(date: string, time: string): boolean {
  // synchronous check not supported for API-backed storage
  return false;
}

// Expose helper for other modules
export {
  getAvailability as getAvailabilityForDay,
  toggleAvailability as toggleSlotAvailability,
};

export function clearAllSchedule() {
  localStorage.removeItem(AV_KEY);
  localStorage.removeItem(BK_KEY);
}

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

    const defaults = new Set(getSlotsForDay(d));
    const allowedTimes = new Set(defaults);

    if (list.length === 0) {
      map[d] = Array.from(defaults);
      return map;
    }

    for (const entry of list) {
      const time = normalizeTime(
        entry.slot_time || entry.slotTime || entry.time,
      );
      if (!time || !allowedTimes.has(time)) continue;
      if (entry.is_available === false) {
        defaults.delete(time);
      } else {
        defaults.add(time);
      }
    }

    map[d] = Array.from(defaults).sort();
    return map;
  } catch (e) {
    console.error("readAvail error", e);
    const d = date || new Date().toISOString().slice(0, 10);
    return { [d]: getSlotsForDay(d) };
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
      slot_id: r.slot_id || r.slotId || null,
      student_name: r.student_name || r.name,
      student_email: r.student_email || r.email,
      phone: r.phone || null,
      lessonType: r.lesson_type || r.lessonType || null,
    }));
  } catch (e) {
    console.error("readBookings error", e);
    return [];
  }
}

async function writeBookings(b: Booking[]) {
  // Not used
}

export function getSlotsForDay(date: string, from = 8, to = 17): string[] {
  const slots: string[] = [];
  const startMinutes = from * 60;
  const endMinutes = to * 60;
  for (let minutes = startMinutes; minutes <= endMinutes; minutes += 30) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    slots.push(`${String(hours).padStart(2, "0")}:${mins === 0 ? "00" : "30"}`);
  }
  return slots;
}

export async function getAvailability(date: string): Promise<string[]> {
  const a = await readAvail(date);
  return a[date] || [];
}

export async function getSlotsWithMeta(date: string) {
  const api = (await import("@/lib/api")).apiFetch;
  const rows = await api(`/api/admin/slots?date=${date}`);
  return Array.isArray(rows)
    ? rows
    : rows && Array.isArray((rows as any).rows)
      ? (rows as any).rows
      : [];
}

export async function toggleAvailability(date: string, time: string) {
  try {
    const api = (await import("@/lib/api")).apiFetch;
    const rows = await api(`/api/admin/slots?date=${date}`);
    const list = Array.isArray(rows)
      ? rows
      : rows && Array.isArray((rows as any).rows)
        ? (rows as any).rows
        : [];
    const existing = list.find(
      (r: any) => normalizeTime(r.slot_time || r.slotTime || r.time) === time,
    );
    if (existing) {
      await api(`/api/admin/slots/${existing.id}`, { method: "DELETE" });
    } else {
      await api(`/api/admin/slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_date: date, slot_time: time }),
      });
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
    const slots = await api(`/api/admin/slots?date=${booking.date}`);
    const list = Array.isArray(slots)
      ? slots
      : slots && Array.isArray((slots as any).rows)
        ? (slots as any).rows
        : [];
    let match = list.find((s: any) => {
      const time = normalizeTime(s.slot_time || s.slotTime || s.time);
      const available = s.is_available !== false;
      return available && time === booking.time;
    });

    if (!match || !match.id) {
      const create = await api(`/api/admin/slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot_date: booking.date,
          slot_time: booking.time,
        }),
      }).catch(() => null);
      if (!create || !create.id) {
        return null;
      }
      match = { id: create.id };
    }

    const payload: any = {
      slot_id: match.id,
      student_id: booking.studentId || (booking as any).student_id || null,
      lesson_type: booking.lessonType || (booking as any).lesson_type || null,
    };
    // Include guest details when booking without a student
    if (!payload.student_id) {
      if ((booking as any).name) payload.name = (booking as any).name;
      if ((booking as any).email) payload.email = (booking as any).email;
      if ((booking as any).phone) payload.phone = (booking as any).phone;
    }
    // Include recurrence rule when provided (RRULE string)
    if ((booking as any).recurrence) {
      payload.recurrence = (booking as any).recurrence;
    }
    const res = await api(`/api/admin/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res as any;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function removeBooking(
  id: string,
  options?: { reason?: string | null; notify?: boolean },
) {
  try {
    const api = (await import("@/lib/api")).apiFetch;
    const opts: any = { method: "DELETE" };
    if (options) {
      opts.headers = { "Content-Type": "application/json" };
      const body: any = {
        reason: options.reason || null,
        notify: options.notify !== false,
      };
      if (typeof (options as any).deleteSeries !== "undefined") {
        body.deleteSeries = (options as any).deleteSeries;
      }
      opts.body = JSON.stringify(body);
    }
    await api(`/api/admin/bookings/${id}`, opts);
  } catch (e) {
    console.error(e);
    throw e;
  }
}

export async function cancelAllBookingsForDate(date: string, reason?: string) {
  try {
    const api = (await import("@/lib/api")).apiFetch;
    const res = await api(`/api/admin/bookings/cancel-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, reason }),
    });
    return res;
  } catch (e) {
    console.error(e);
    throw e;
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

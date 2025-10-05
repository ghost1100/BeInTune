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

const AV_KEY = 'inTuneAvailability';
const BK_KEY = 'inTuneBookings';

async function readAvail(date?: string): Promise<Record<string, string[]>> {
  try {
    const d = date || new Date().toISOString().slice(0,10);
    const res = await fetch(`/api/admin/slots?date=${d}`);
    if (!res.ok) return {};
    const rows = await res.json();
    // transform into map
    const map: Record<string, string[]> = {};
    map[d] = rows.filter((r:any)=>r.is_available).map((r:any)=>r.slot_time);
    return map;
  } catch (e) {
    return {};
  }
}

async function writeAvail(a: Record<string, string[]>) {
  // Not implemented server-side as batch; caller should use slots API to create/delete slots.
}

async function readBookings(date?: string): Promise<Booking[]> {
  try {
    const q = date ? `?date=${date}` : "";
    const res = await fetch(`/api/admin/bookings${q}`);
    if (!res.ok) return [];
    return res.json();
  } catch (e) {
    return [];
  }
}

async function writeBookings(b: Booking[]) {
  // Not used
}

export function getSlotsForDay(date: string, from = 8, to = 20): string[] {
  const slots: string[] = [];
  for (let h = from; h < to; h++) {
    slots.push(`${String(h).padStart(2,'0')}:00`);
    slots.push(`${String(h).padStart(2,'0')}:30`);
  }
  return slots;
}

export function getAvailability(date: string): string[] {
  const a = readAvail();
  return a[date] || [];
}

export function toggleAvailability(date: string, time: string) {
  const a = readAvail();
  const day = a[date] || [];
  if (day.includes(time)) {
    a[date] = day.filter((t) => t !== time);
  } else {
    a[date] = [...day, time].sort();
  }
  writeAvail(a);
}

export function getBookings(date?: string): Booking[] {
  const b = readBookings();
  if (date) return b.filter((bk) => bk.date === date);
  return b;
}

function getStudentById(id: string) {
  try {
    const raw = localStorage.getItem('inTuneStudents');
    if (!raw) return null;
    const list = JSON.parse(raw);
    return list.find((s: any) => s.id === id) || null;
  } catch (e) {
    return null;
  }
}

export function addBooking(booking: Omit<Booking, 'id'>): Booking | null {
  // Ensure slot is available and not already booked
  const { date, time } = booking;
  const avail = getAvailability(date);
  const bookings = getBookings(date);
  const alreadyBooked = bookings.find((b) => b.time === time);
  if (!avail.includes(time) || alreadyBooked) return null;

  let filled = { ...booking } as Omit<Booking, 'id'>;
  if (booking.studentId) {
    const s = getStudentById(booking.studentId);
    if (s) {
      filled = { ...filled, name: s.name, email: s.email, phone: s.phone };
    }
  }

  const bk: Booking = { ...filled, id: String(Date.now()) };
  const next = [...readBookings(), bk];
  writeBookings(next);
  return bk;
}

export function removeBooking(id: string) {
  const next = readBookings().filter((b) => b.id !== id);
  writeBookings(next);
}

export function isSlotBooked(date: string, time: string): boolean {
  return !!getBookings(date).find((b) => b.time === time);
}

// Expose helper for other modules
export { getAvailability as getAvailabilityForDay, toggleAvailability as toggleSlotAvailability };

export function clearAllSchedule() {
  localStorage.removeItem(AV_KEY);
  localStorage.removeItem(BK_KEY);
}

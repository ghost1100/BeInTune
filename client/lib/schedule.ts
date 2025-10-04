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

function readAvail(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(AV_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function writeAvail(a: Record<string, string[]>) {
  localStorage.setItem(AV_KEY, JSON.stringify(a));
}

function readBookings(): Booking[] {
  try {
    const raw = localStorage.getItem(BK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function writeBookings(b: Booking[]) {
  localStorage.setItem(BK_KEY, JSON.stringify(b));
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

import { getStudentById } from "@/lib/students";

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

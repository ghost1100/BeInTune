import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getSlotsForDay,
  getAvailability,
  addBooking,
  getBookings,
} from "@/lib/schedule";
import { getSiteContent } from "@/lib/siteContent";

export default function BookingForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [lesson, setLesson] = useState("Guitar");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<string[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const loadSlots = async () => {
    // show admin/teacher available slots from 08:00 - 17:00
    const all = getSlotsForDay(date, 8, 17);
    const avail = await getAvailability(date);
    const bookingsRes = await getBookings(date);
    const bookings = Array.isArray(bookingsRes)
      ? bookingsRes.map((b: any) => b.time)
      : [];
    const free = (avail || []).filter((t) => !bookings.includes(t));
    setSlots(all);
    setAvailableSlots(free);
    setSelectedSlot(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) {
      setMessage("Please select an available slot");
      return;
    }
    const bk = await addBooking({
      name,
      email,
      phone,
      date,
      time: selectedSlot,
      lessonType: lesson,
    });
    if (!bk) {
      setMessage(
        "Selected slot is no longer available. Refresh and try again.",
      );
      return;
    }
    setMessage("Booked! We will contact you by email.");
    // clear form
    setName("");
    setEmail("");
    setPhone("");
    setSelectedSlot(null);
    setAvailableSlots((as) => as.filter((s) => s !== selectedSlot));
  };

  return (
    <div>
      <form onSubmit={submit} className="mt-4 grid gap-3">
        <input
          className="h-10 rounded-md border px-3"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="h-10 rounded-md border px-3"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="h-10 rounded-md border px-3"
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <select
          className="h-10 rounded-md border px-3"
          value={lesson}
          onChange={(e) => setLesson(e.target.value)}
        >
          <option>Guitar</option>
          <option>Singing</option>
          <option>Piano</option>
          <option>Drums</option>
          <option>Bass</option>
          <option>Ukulele</option>
        </select>
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="h-10 rounded-md border px-3"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button
            type="button"
            onClick={loadSlots}
            className="px-3 py-2 rounded-md border"
          >
            Find slots
          </button>
        </div>

        {availableSlots.length > 0 && (
          <div className="mt-2">
            <div className="text-sm font-medium mb-2">Available slots</div>
            <div className="grid grid-cols-3 gap-2">
              {availableSlots.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setSelectedSlot(s)}
                  className={`h-10 rounded-md ${selectedSlot === s ? "bg-primary text-primary-foreground" : "bg-muted border"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button size="lg" variant="gradient">
            Enquire
          </Button>
          <a href={`tel:${getSiteContent().phone}`} className="inline-block">
            <Button size="lg" variant="ghost">
              Call
            </Button>
          </a>
        </div>
        {message && (
          <div className="text-sm mt-2 text-foreground/70">{message}</div>
        )}
      </form>
    </div>
  );
}

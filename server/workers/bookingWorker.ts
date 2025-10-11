import { Worker } from 'bullmq';
import { query } from '../db';
import { sendMail } from '../lib/mailer';

const redisUrl = process.env.REDIS_URL || process.env.REDIS || null;
const connection = redisUrl
  ? { url: redisUrl }
  : {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
      password: process.env.REDIS_PASSWORD || undefined,
    } as any;

async function processBooking(job: any) {
  const bookingId = job.data && job.data.bookingId;
  if (!bookingId) throw new Error('Missing bookingId');

  // Load booking info
  const infoQ = await query(`
    SELECT b.id, b.lesson_type, b.guest_name, b.guest_email, b.guest_phone, b.calendar_event_id, b.recurrence_id, b.recurrence, s.user_id as student_user_id, u.email as user_email, u.name as user_name, s.instruments as student_instruments, u.phone as user_phone, s.phone as student_phone, sl.id as slot_id, sl.slot_time as time, sl.slot_date as date, sl.teacher_id, sl.duration_minutes
    FROM bookings b
    LEFT JOIN slots sl ON b.slot_id = sl.id
    LEFT JOIN students s ON b.student_id = s.id
    LEFT JOIN users u ON s.user_id = u.id
    WHERE b.id = $1 LIMIT 1
  `, [bookingId]);

  const info = infoQ.rows[0];
  if (!info) throw new Error('Booking not found: ' + bookingId);

  // Try decrypt guest fields if needed
  try {
    const { decryptText } = await import('../lib/crypto');
    if (info.guest_name) {
      try { const parsed = typeof info.guest_name === 'string' ? JSON.parse(info.guest_name) : info.guest_name; const dec = decryptText(parsed); if (dec) info.guest_name = dec; } catch (e) {}
    }
    if (info.guest_email) {
      try { const parsed = typeof info.guest_email === 'string' ? JSON.parse(info.guest_email) : info.guest_email; const dec = decryptText(parsed); if (dec) info.guest_email = dec; } catch (e) {}
    }
    if (info.guest_phone) {
      try { const parsed = typeof info.guest_phone === 'string' ? JSON.parse(info.guest_phone) : info.guest_phone; const dec = decryptText(parsed); if (dec) info.guest_phone = dec; } catch (e) {}
    }
  } catch (e) {
    // ignore
  }

  // Send email (best-effort)
  try {
    const toEmail = info.user_email || info.guest_email || null;
    const toName = info.user_name || info.guest_name || '';
    if (toEmail) {
      const subject = `Lesson booked: ${info.date} ${info.time}`;
      const plain = `Hello ${toName},\n\nYour lesson has been booked for ${info.date} at ${info.time}.\n\nDetails:\n- Lesson: ${info.lesson_type || 'Lesson'}\n\nSee you then.`;
      const html = `<p>Hello ${toName},</p><p>Your lesson has been booked for <strong>${info.date} at ${info.time}</strong>.</p>`;
      await sendMail({ to: toEmail, from: process.env.FROM_EMAIL || 'no-reply@example.com', subject, text: plain, html });
    }
  } catch (err) {
    console.error('Booking worker: email failed', err);
  }

  // Calendar: create event and, if recurrence present, create DB bookings for occurrences
  try {
    const { createCalendarEvent, listInstances } = await import('../lib/calendar');
    const date = info.date;
    const time = info.time;
    const duration = info.duration_minutes || 30;

    function makeIso(dStr: any, tStr: string, durMin: number) {
      if (!dStr || !tStr) throw new Error('Missing date/time');
      let y: number, m: number, day: number;
      if (dStr instanceof Date) { const dt = dStr as Date; y = dt.getFullYear(); m = dt.getMonth() + 1; day = dt.getDate(); }
      else if (typeof dStr === 'string') {
        if (dStr.includes('T')) { const dt = new Date(dStr); if (isNaN(dt.getTime())) throw new Error('Invalid date'); y = dt.getFullYear(); m = dt.getMonth() + 1; day = dt.getDate(); }
        else { const parts = dStr.split('-').map(Number); [y, m, day] = parts; }
      } else throw new Error('Unsupported date type');
      const [hh, mm] = String(tStr).split(':').map(Number);
      const pad = (n: number) => String(n).padStart(2, '0');
      const start = `${y}-${pad(m)}-${pad(day)}T${pad(hh || 0)}:${pad(mm || 0)}:00`;
      const endDt = new Date(y, (m || 1) - 1, day, hh || 0, mm || 0, 0);
      endDt.setMinutes(endDt.getMinutes() + (durMin || 30));
      const end = `${endDt.getFullYear()}-${pad(endDt.getMonth()+1)}-${pad(endDt.getDate())}T${pad(endDt.getHours())}:${pad(endDt.getMinutes())}:00`;
      return { startIso: start, endIso: end };
    }

    const { startIso, endIso } = makeIso(date, time, duration);

    let ev: any = null;
    try {
      const existsQ = await query('SELECT calendar_event_id, recurrence_id FROM bookings WHERE slot_id = $1 AND (calendar_event_id IS NOT NULL OR recurrence_id IS NOT NULL) LIMIT 1', [info.slot_id]);
      if (existsQ.rows && existsQ.rows[0]) {
        ev = { id: existsQ.rows[0].calendar_event_id || existsQ.rows[0].recurrence_id };
        await query('UPDATE bookings SET calendar_event_id = $1, recurrence_id = $2 WHERE id = $3', [ev.id, existsQ.rows[0].recurrence_id || null, bookingId]);
      }
    } catch (e) { console.warn('Booking worker: reuse check failed', e); }

    if (!ev) {
      ev = await createCalendarEvent({ summary: `Lesson: ${info.lesson_type || 'Lesson'}`, description: `Booking for ${info.guest_name || info.user_name || ''}`, startDateTime: startIso, endDateTime: endIso, recurrence: info.recurrence ? [String(info.recurrence)] : undefined });
    }

    if (ev && ev.id) {
      try { await query('UPDATE bookings SET calendar_event_id = $1, recurrence_id = $2 WHERE id = $3', [ev.id, info.recurrence ? ev.id : null, bookingId]); } catch (e) { console.warn('Booking worker: persist event id failed', e); }

      // map instance if possible
      try {
        const startIsoInstance = `${date}T${time}:00`;
        const endInstance = new Date(startIsoInstance); endInstance.setSeconds(endInstance.getSeconds()+1);
        const instances = await listInstances(ev.id, startIsoInstance, endInstance.toISOString());
        const found = instances.find((it:any) => (it.start && (it.start.dateTime || it.start.date) || '').startsWith(startIsoInstance.slice(0,19)));
        if (found && found.id) await query('UPDATE bookings SET calendar_instance_id = $1 WHERE id = $2', [found.id, bookingId]);
      } catch (e) { console.warn('Booking worker: map instance failed', e); }

      // simple recurrence expansion: COUNT or UNTIL or fallback 12 weekly occurrences
      try {
        const recurrence = info.recurrence;
        if (recurrence && typeof recurrence === 'string') {
          const r = recurrence as string;
          const countMatch = r.match(/COUNT=(\d+)/i);
          if (countMatch) {
            const count = parseInt(countMatch[1], 10);
            for (let i = 1; i < count; i++) {
              const dt = new Date(date + 'T' + (time || '00:00') + ':00');
              dt.setDate(dt.getDate() + i*7);
              const pad = (n:number)=>String(n).padStart(2,'0');
              const slotDate = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`;
              const slotTime = `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
              // ensure slot
              try {
                const existingSlot = await query('SELECT id FROM slots WHERE slot_date = $1 AND slot_time = $2 LIMIT 1', [slotDate, slotTime]);
                let newSlotId: string|null = existingSlot.rows && existingSlot.rows[0] ? existingSlot.rows[0].id : null;
                if (!newSlotId) {
                  const ins = await query('INSERT INTO slots(teacher_id, slot_date, slot_time, duration_minutes, is_available) VALUES ($1,$2,$3,$4,true) RETURNING id', [info.teacher_id || null, slotDate, slotTime, duration || 30]);
                  newSlotId = ins.rows[0] && ins.rows[0].id;
                }
                if (newSlotId) {
                  const existingBk = await query('SELECT id FROM bookings WHERE slot_id = $1 AND recurrence_id = $2 LIMIT 1', [newSlotId, ev.id]);
                  if (!(existingBk.rows && existingBk.rows[0])) {
                    await query('INSERT INTO bookings(student_id, slot_id, lesson_type, guest_name, guest_email, guest_phone, calendar_event_id, recurrence_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [info.student_user_id || null, newSlotId, info.lesson_type || null, info.guest_name, info.guest_email, info.guest_phone, ev.id, ev.id]);
                  }
                }
              } catch (e) { console.warn('Booking worker: recurring insert failed', e); }
            }
          } else {
            // try UNTIL or fallback
            const untilMatch = r.match(/UNTIL=([0-9TZ:+-]+)/i);
            if (untilMatch) {
              try {
                const untilRaw = untilMatch[1];
                // normalize
                let untilIso = untilRaw;
                const dmatch = untilRaw.match(/^(\d{8})T?(\d{6})?Z?$/);
                if (dmatch) {
                  const datePart = dmatch[1]; const timePart = dmatch[2] || '000000';
                  const yyyy = datePart.slice(0,4); const mm = datePart.slice(4,6); const dd = datePart.slice(6,8);
                  const hh = timePart.slice(0,2); const mi = timePart.slice(2,4); const ss = timePart.slice(4,6);
                  untilIso = `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
                }
                const untilDate = new Date(untilIso);
                let cur = new Date(date + 'T' + (time || '00:00') + ':00');
                const oneWeek = 7*24*60*60*1000;
                cur = new Date(cur.getTime() + oneWeek);
                const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                while (dateKey(cur) <= dateKey(untilDate)) {
                  try {
                    const pad = (n:number)=>String(n).padStart(2,'0');
                    const slotDate = `${cur.getFullYear()}-${pad(cur.getMonth()+1)}-${pad(cur.getDate())}`;
                    const slotTime = `${String(cur.getHours()).padStart(2,'0')}:${String(cur.getMinutes()).padStart(2,'0')}`;
                    // ensure and insert booking similar to COUNT branch
                    try {
                      const existingSlot = await query('SELECT id FROM slots WHERE slot_date = $1 AND slot_time = $2 LIMIT 1', [slotDate, slotTime]);
                      let newSlotId = existingSlot.rows && existingSlot.rows[0] ? existingSlot.rows[0].id : null;
                      if (!newSlotId) {
                        const ins = await query('INSERT INTO slots(teacher_id, slot_date, slot_time, duration_minutes, is_available) VALUES ($1,$2,$3,$4,true) RETURNING id', [info.teacher_id || null, slotDate, slotTime, duration || 30]);
                        newSlotId = ins.rows[0] && ins.rows[0].id;
                      }
                      if (newSlotId) {
                        const existingBk = await query('SELECT id FROM bookings WHERE slot_id = $1 AND recurrence_id = $2 LIMIT 1', [newSlotId, ev.id]);
                        if (!(existingBk.rows && existingBk.rows[0])) {
                          await query('INSERT INTO bookings(student_id, slot_id, lesson_type, guest_name, guest_email, guest_phone, calendar_event_id, recurrence_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [info.student_user_id || null, newSlotId, info.lesson_type || null, info.guest_name, info.guest_email, info.guest_phone, ev.id, ev.id]);
                        }
                      }
                    } catch (e) { console.warn('Booking worker: UNTIL occurrence failure', e); }
                  } catch (inner) { console.warn('Booking worker: UNTIL loop failure', inner); }
                  cur = new Date(cur.getTime() + oneWeek);
                }
              } catch (e) { console.warn('Booking worker: UNTIL expansion failed', e); }
            } else {
              // fallback: create next 12 weekly occurrences
              try {
                const occurrences = 12;
                let cur = new Date(date + 'T' + (time || '00:00') + ':00');
                const oneWeek = 7*24*60*60*1000;
                cur = new Date(cur.getTime() + oneWeek);
                for (let i = 1; i <= occurrences; i++) {
                  try {
                    const pad = (n:number)=>String(n).padStart(2,'0');
                    const slotDate = `${cur.getFullYear()}-${pad(cur.getMonth()+1)}-${pad(cur.getDate())}`;
                    const slotTime = `${String(cur.getHours()).padStart(2,'0')}:${String(cur.getMinutes()).padStart(2,'0')}`;
                    try {
                      const existingSlot = await query('SELECT id FROM slots WHERE slot_date = $1 AND slot_time = $2 LIMIT 1', [slotDate, slotTime]);
                      let newSlotId = existingSlot.rows && existingSlot.rows[0] ? existingSlot.rows[0].id : null;
                      if (!newSlotId) {
                        const ins = await query('INSERT INTO slots(teacher_id, slot_date, slot_time, duration_minutes, is_available) VALUES ($1,$2,$3,$4,true) RETURNING id', [info.teacher_id || null, slotDate, slotTime, duration || 30]);
                        newSlotId = ins.rows[0] && ins.rows[0].id;
                      }
                      if (newSlotId) {
                        const existingBk = await query('SELECT id FROM bookings WHERE slot_id = $1 AND recurrence_id = $2 LIMIT 1', [newSlotId, ev.id]);
                        if (!(existingBk.rows && existingBk.rows[0])) {
                          await query('INSERT INTO bookings(student_id, slot_id, lesson_type, guest_name, guest_email, guest_phone, calendar_event_id, recurrence_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [info.student_user_id || null, newSlotId, info.lesson_type || null, info.guest_name, info.guest_email, info.guest_phone, ev.id, ev.id]);
                        }
                      }
                    } catch (e) { console.warn('Booking worker: fallback occurrence failed', e); }
                  } catch (inner) { console.warn('Booking worker: fallback loop error', inner); }
                  cur = new Date(cur.getTime() + oneWeek);
                }
              } catch (e) { console.warn('Booking worker: fallback expansion failed', e); }
            }
          }
        }
      } catch (err) {
        console.error('Failed to create calendar event (worker):', err);
      }

  return { ok: true };
}

export function startBookingWorker() {
  const worker = new Worker('bookingQueue', processBooking, { connection });
  worker.on('completed', (job) => console.log('Booking job completed', job.id));
  worker.on('failed', (job, err) => console.error('Booking job failed', job && job.id, err));
  console.log('Booking worker started');
  return worker;
}
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

  // Load booking and related slot/student/user info
  const infoQ = await query(
    `SELECT b.id, b.lesson_type, b.guest_name, b.guest_email, b.guest_phone, b.calendar_event_id, b.recurrence_id, s.user_id as student_user_id, u.email as user_email, u.name as user_name, s.instruments as student_instruments, u.phone as user_phone, s.phone as student_phone, sl.id as slot_id, sl.slot_time as time, sl.slot_date as date, sl.teacher_id, sl.duration_minutes, b.recurrence
     FROM bookings b
     LEFT JOIN slots sl ON b.slot_id = sl.id
     LEFT JOIN students s ON b.student_id = s.id
     LEFT JOIN users u ON s.user_id = u.id
     WHERE b.id = $1 LIMIT 1`,
    [bookingId],
  );
  const info = infoQ.rows[0];
  if (!info) throw new Error('Booking not found: ' + bookingId);

  try {
    const { decryptText } = await import('../lib/crypto');
    if (info.guest_name) {
      try {
        const parsed = typeof info.guest_name === 'string' ? JSON.parse(info.guest_name) : info.guest_name;
        const dec = decryptText(parsed);
        if (dec) info.guest_name = dec;
      } catch (e) {}
    }
    if (info.guest_email) {
      try {
        const parsed = typeof info.guest_email === 'string' ? JSON.parse(info.guest_email) : info.guest_email;
        const dec = decryptText(parsed);
        if (dec) info.guest_email = dec;
      } catch (e) {}
    }
    if (info.guest_phone) {
      try {
        const parsed = typeof info.guest_phone === 'string' ? JSON.parse(info.guest_phone) : info.guest_phone;
        const dec = decryptText(parsed);
        if (dec) info.guest_phone = dec;
      } catch (e) {}
    }
  } catch (e) {
    // ignore
  }

  // Email
  try {
    const toEmail = info.user_email || info.guest_email || null;
    const toName = info.user_name || info.guest_name || '';
    if (toEmail) {
      const subject = `Lesson booked: ${info.date} ${info.time}`;
      const plain = `Hello ${toName},\n\nYour lesson has been booked for ${info.date} at ${info.time}.\n\nDetails:\n- Lesson: ${info.lesson_type || 'Lesson'}\n\nSee you then.`;
      const html = `<p>Hello ${toName},</p><p>Your lesson has been booked for <strong>${info.date} at ${info.time}</strong>.</p><p><strong>Lesson:</strong> ${info.lesson_type || 'Lesson'}</p><p>See you then.</p>`;
      try {
        await sendMail({ to: toEmail, from: process.env.FROM_EMAIL || 'no-reply@example.com', subject, text: plain, html });
      } catch (err) {
        console.error('Failed to send booking confirmation', err);
      }
    }
  } catch (err) {
    console.error('Booking notification error (worker):', err);
  }

  // Calendar and recurrence
  try {
    const { createCalendarEvent, listInstances } = await import('../lib/calendar');
    const slotDateRaw = info.date;
    const slotTimeRaw = info.time;
    const duration = info.duration_minutes || 30;

    const makeIso = (dStr: any, tStr: string, durMin: number) => {
      if (!dStr || !tStr) throw new Error('Missing date/time');
      let y: number, m: number, day: number;
      if (dStr instanceof Date) {
        const dt = dStr as Date; y = dt.getFullYear(); m = dt.getMonth() + 1; day = dt.getDate();
      } else if (typeof dStr === 'string') {
        if (dStr.includes('T')) { const dt = new Date(dStr); if (isNaN(dt.getTime())) throw new Error('Invalid date string'); y = dt.getFullYear(); m = dt.getMonth() + 1; day = dt.getDate(); }
        else { const parts = dStr.split('-').map(Number); [y, m, day] = parts; }
      } else throw new Error('Unsupported date type');
      const tParts = String(tStr).split(':').map(Number);
      const hh = tParts[0] || 0; const mm = tParts[1] || 0;
      const pad = (n: number) => String(n).padStart(2, '0');
      const startLocal = `${y}-${pad(m)}-${pad(day)}T${pad(hh)}:${pad(mm)}:00`;
      const endDate = new Date(y, (m || 1) - 1, day, hh, mm, 0, 0);
      endDate.setMinutes(endDate.getMinutes() + (durMin || 30));
      const endLocal = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}:00`;
      return { startIso: startLocal, endIso: endLocal };
    };

    const { startIso, endIso } = makeIso(slotDateRaw, slotTimeRaw, duration);

    let ev: any = null;
    try {
      const existsQ = await query('SELECT calendar_event_id, recurrence_id FROM bookings WHERE slot_id = $1 AND (calendar_event_id IS NOT NULL OR recurrence_id IS NOT NULL) LIMIT 1', [info.slot_id]);
      if (existsQ && existsQ.rows && existsQ.rows[0] && (existsQ.rows[0].calendar_event_id || existsQ.rows[0].recurrence_id)) {
        ev = { id: existsQ.rows[0].calendar_event_id || existsQ.rows[0].recurrence_id };
        try { await query('UPDATE bookings SET calendar_event_id = $1, recurrence_id = $2 WHERE id = $3', [ev.id, existsQ.rows[0].recurrence_id || null, bookingId]); } catch (e) { console.warn('Failed to persist reused calendar id', e); }
      }
    } catch (e) { console.warn('Failed to check for existing calendar event', e); }

    if (!ev) {
      ev = await createCalendarEvent({ summary: `Lesson: ${info.lesson_type || 'Lesson'}`, description: `Booking for ${info.guest_name || info.user_name || ''}`, startDateTime: startIso, endDateTime: endIso, recurrence: info.recurrence ? [String(info.recurrence)] : undefined });
    }

    if (ev && ev.id) {
      const recurrenceIdToStore = info.recurrence ? ev.id : null;
      try { await query('UPDATE bookings SET calendar_event_id = $1, recurrence_id = $2 WHERE id = $3', [ev.id, recurrenceIdToStore, bookingId]); } catch (e) { console.warn('Failed to persist calendar_event_id on booking', e); }

      try {
        const startIsoInstance = `${slotDateRaw}T${slotTimeRaw}:00`;
        const endDate = new Date(startIsoInstance); endDate.setSeconds(endDate.getSeconds() + 1);
        const instances = await listInstances(ev.id, startIsoInstance, endDate.toISOString());
        let found = null;
        for (const it of instances) {
          const s = it.start && (it.start.dateTime || it.start.date);
          if (!s) continue;
          if (s.startsWith(startIsoInstance.slice(0, 19))) { found = it; break; }
          try { const si = new Date(s).toISOString(); if (si === startIsoInstance) { found = it; break; } } catch (e) {}
        }
        if (found && found.id) await query('UPDATE bookings SET calendar_instance_id = $1 WHERE id = $2', [found.id, bookingId]);
      } catch (e) { console.warn('Failed to map calendar instance to booking', e); }

      // Expand recurrence
      try {
        const recurrence = info.recurrence;
        if (recurrence && typeof recurrence === 'string') {
          const rStr = String(recurrence);
          const countMatch = rStr.match(/COUNT=(\d+)/i);
          const count = countMatch ? parseInt(countMatch[1], 10) : null;
          if (count && count > 1) {
            for (let i = 1; i < count; i++) {
              try {
                const dt = new Date(slotDateRaw + 'T' + (slotTimeRaw || '00:00') + ':00'); dt.setDate(dt.getDate() + i * 7);
                const pad = (n: number) => String(n).padStart(2, '0');
                const slotDate = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
                const slotTime = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
                let newSlotId: string | null = null;
                try {
                  const existingSlot = await query('SELECT id FROM slots WHERE slot_date = $1 AND slot_time = $2 LIMIT 1', [slotDate, slotTime]);
                  if (existingSlot && existingSlot.rows && existingSlot.rows[0]) newSlotId = existingSlot.rows[0].id;
                  else { const insSlot = await query('INSERT INTO slots(teacher_id, slot_date, slot_time, duration_minutes, is_available) VALUES ($1,$2,$3,$4,true) RETURNING id', [info.teacher_id || null, slotDate, slotTime, duration || 30]); newSlotId = insSlot.rows[0].id; }
                } catch (e) { console.warn('Failed to ensure slot for recurring occurrence', e); }
                if (newSlotId) {
                  try {
                    const existingBk = await query('SELECT id FROM bookings WHERE slot_id = $1 AND recurrence_id = $2 LIMIT 1', [newSlotId, ev.id]);
                    if (!(existingBk && existingBk.rows && existingBk.rows[0])) {
                      const insBk = await query('INSERT INTO bookings(student_id, slot_id, lesson_type, guest_name, guest_email, guest_phone, calendar_event_id, recurrence_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id', [info.student_user_id || null, newSlotId, info.lesson_type || null, info.guest_name, info.guest_email, info.guest_phone, ev.id, ev.id]);
                      const newBkId = insBk && insBk.rows && insBk.rows[0] && insBk.rows[0].id;
                      if (newBkId) {
                        try {
                          const startIso = `${slotDate}T${slotTime}:00`;
                          const endDt = new Date(startIso); endDt.setSeconds(endDt.getSeconds() + 1);
                          const instances2 = await listInstances(ev.id, startIso, endDt.toISOString());
                          let found2 = null;
                          for (const it of instances2) {
                            const s = it.start && (it.start.dateTime || it.start.date);
                            if (!s) continue;
                            if (s.startsWith(startIso.slice(0, 19))) { found2 = it; break; }
                            try { const si = new Date(s).toISOString(); if (si === startIso) { found2 = it; break; } } catch (e) {}
                          }
                          if (found2 && found2.id) await query('UPDATE bookings SET calendar_instance_id = $1 WHERE id = $2', [found2.id, newBkId]);
                        } catch (e) { console.warn('Failed to map instance for new booking', e); }
                      }
                    }
                  } catch (e) { console.warn('Failed to check/insert recurring booking', e); }
                }
              } catch (e) { console.warn('Failed to create recurring booking occurrence', e); }
            }
          } else {
            const um = rStr.match(/UNTIL=([0-9TZ:+-]+)/i);
            if (um) {
              try {
                const untilRaw = um[1];
                let untilIso = untilRaw;
                const dmatch = untilRaw.match(/^(\d{8})T?(\d{6})?Z?$/);
                if (dmatch) {
                  const datePart = dmatch[1];
                  const timePart = dmatch[2] || '000000';
                  const yyyy = datePart.slice(0,4), mm = datePart.slice(4,6), dd = datePart.slice(6,8);
                  const hh = timePart.slice(0,2), mi = timePart.slice(2,4), ss = timePart.slice(4,6);
                  untilIso = `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
                }
                const untilDate = new Date(untilIso);
                let cur = new Date(slotDateRaw + 'T' + (slotTimeRaw || '00:00') + ':00');
                const oneWeek = 7 * 24 * 60 * 60 * 1000;
                cur = new Date(cur.getTime() + oneWeek);
                const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                while (dateKey(cur) <= dateKey(untilDate)) {
                  try {
                    const pad = (n: number) => String(n).padStart(2,'0');
                    const slotDate = `${cur.getFullYear()}-${pad(cur.getMonth()+1)}-${pad(cur.getDate())}`;
                    const slotTime = `${String(cur.getHours()).padStart(2,'0')}:${String(cur.getMinutes()).padStart(2,'0')}`;
                    let newSlotId: string | null = null;
                    try {
                      const existingSlot = await query('SELECT id FROM slots WHERE slot_date = $1 AND slot_time = $2 LIMIT 1',[slotDate, slotTime]);
                      if (existingSlot && existingSlot.rows && existingSlot.rows[0]) newSlotId = existingSlot.rows[0].id;
                      else { const insSlot = await query('INSERT INTO slots(teacher_id, slot_date, slot_time, duration_minutes, is_available) VALUES ($1,$2,$3,$4,true) RETURNING id',[info.teacher_id || null, slotDate, slotTime, duration || 30]); newSlotId = insSlot.rows[0].id; }
                    } catch (e) { console.warn('Failed to ensure slot for recurring occurrence', e); }
                    if (newSlotId) {
                      try {
                        const existingBk = await query('SELECT id FROM bookings WHERE slot_id = $1 AND recurrence_id = $2 LIMIT 1',[newSlotId, ev.id]);
                        if (!(existingBk && existingBk.rows && existingBk.rows[0])) {
                          const insBk = await query('INSERT INTO bookings(student_id, slot_id, lesson_type, guest_name, guest_email, guest_phone, calendar_event_id, recurrence_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[info.student_user_id || null, newSlotId, info.lesson_type || null, info.guest_name, info.guest_email, info.guest_phone, ev.id, ev.id]);
                          const newBkId = insBk && insBk.rows && insBk.rows[0] && insBk.rows[0].id;
                          if (newBkId) {
                            try {
                              const startIso2 = `${slotDate}T${slotTime}:00`;
                              const endDt = new Date(startIso2); endDt.setSeconds(endDt.getSeconds()+1);
                              const instances2 = await listInstances(ev.id, startIso2, endDt.toISOString());
                              let found2 = null;
                              for (const it of instances2) {
                                const s = it.start && (it.start.dateTime || it.start.date);
                                if (!s) continue;
                                if (s.startsWith(startIso2.slice(0,19))) { found2 = it; break; }
                                try { const si = new Date(s).toISOString(); if (si === startIso2) { found2 = it; break; } } catch (e) {}
                              }
                              if (found2 && found2.id) await query('UPDATE bookings SET calendar_instance_id = $1 WHERE id = $2',[found2.id, newBkId]);
                            } catch (e) { console.warn('Failed to map instance for new booking', e); }
                          }
                        }
                      } catch (e) { console.warn('Failed to check/insert recurring booking', e); }
                    }
                  } catch (inner) { console.warn('Failed to create booking for recurring occurrence until', cur, inner); }
                  cur = new Date(cur.getTime() + oneWeek);
                }
              } catch (inner) { console.warn('Failed to expand UNTIL-based recurring bookings:', inner); }
            } else {
              try {
                const occurrences = 12;
                let cur = new Date(slotDateRaw + 'T' + (slotTimeRaw || '00:00') + ':00');
                const oneWeek = 7 * 24 * 60 * 60 * 1000;
                cur = new Date(cur.getTime() + oneWeek);
                for (let i = 1; i <= occurrences; i++) {
                  try {
                    const pad = (n: number) => String(n).padStart(2,'0');
                    const slotDate = `${cur.getFullYear()}-${pad(cur.getMonth()+1)}-${pad(cur.getDate())}`;
                    const slotTime = `${String(cur.getHours()).padStart(2,'0')}:${String(cur.getMinutes()).padStart(2,'0')}`;
                    let newSlotId: string | null = null;
                    try {
                      const existingSlot = await query('SELECT id FROM slots WHERE slot_date = $1 AND slot_time = $2 LIMIT 1',[slotDate, slotTime]);
                      if (existingSlot && existingSlot.rows && existingSlot.rows[0]) newSlotId = existingSlot.rows[0].id;
                      else { const insSlot = await query('INSERT INTO slots(teacher_id, slot_date, slot_time, duration_minutes, is_available) VALUES ($1,$2,$3,$4,true) RETURNING id',[info.teacher_id || null, slotDate, slotTime, duration || 30]); newSlotId = insSlot.rows[0].id; }
                    } catch (e) { console.warn('Failed to ensure slot for recurring occurrence (fallback)', e); }
                    if (newSlotId) {
                      try {
                        const existingBk = await query('SELECT id FROM bookings WHERE slot_id = $1 AND recurrence_id = $2 LIMIT 1',[newSlotId, ev.id]);
                        if (!(existingBk && existingBk.rows && existingBk.rows[0])) {
                          const insBk = await query('INSERT INTO bookings(student_id, slot_id, lesson_type, guest_name, guest_email, guest_phone, calendar_event_id, recurrence_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[info.student_user_id || null, newSlotId, info.lesson_type || null, info.guest_name, info.guest_email, info.guest_phone, ev.id, ev.id]);
                          const newBkId = insBk && insBk.rows && insBk.rows[0] && insBk.rows[0].id;
                          if (newBkId) {
                            try {
                              const startIso3 = `${slotDate}T${slotTime}:00`;
                              const endDt = new Date(startIso3); endDt.setSeconds(endDt.getSeconds()+1);
                              const instances3 = await listInstances(ev.id, startIso3, endDt.toISOString());
                              let found3 = null;
                              for (const it of instances3) {
                                const s = it.start && (it.start.dateTime || it.start.date);
                                if (!s) continue;
                                if (s.startsWith(startIso3.slice(0,19))) { found3 = it; break; }
                                try { const si = new Date(s).toISOString(); if (si === startIso3) { found3 = it; break; } } catch (e) {}
                              }
                              if (found3 && found3.id) await query('UPDATE bookings SET calendar_instance_id = $1 WHERE id = $2',[found3.id, newBkId]);
                            } catch (e) { console.warn('Failed to map instance for new booking', e); }
                          }
                        }
                      } catch (e) { console.warn('Failed to check/insert recurring booking', e); }
                    }
                  } catch (inner) { console.warn('Failed to create booking for recurring fallback occurrence', inner); }
                  cur = new Date(cur.getTime() + oneWeek);
                }
              } catch (inner) { console.warn('Failed to expand fallback recurring bookings:', inner); }
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
import { useEffect, useState, FormEvent, DragEvent, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { getRandomImage } from "@/lib/unsplash";
import { getSlotsForDay, getAvailability, toggleAvailability, getBookings, addBooking, removeBooking, isSlotBooked } from "@/lib/schedule";
import { getStudents, addStudent as addStudentToStore, updateStudent as updateStudentInStore, removeStudent as removeStudentFromStore } from "@/lib/students";
import ThemeHomePreview from "@/components/admin/ThemeHomePreview";

type Teacher = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  years?: string;
  about?: string;
  image?: string | null;
};

function loadTeachers(): Teacher[] {
  try {
    const raw = localStorage.getItem("inTuneTeachers");
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveTeachers(list: Teacher[]) {
  localStorage.setItem("inTuneTeachers", JSON.stringify(list));
}

export default function Admin() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loadingImg, setLoadingImg] = useState(false);
  const [form, setForm] = useState<Partial<Teacher>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [siteContent, setSiteContentState] = useState(() => {
    try { return JSON.parse(localStorage.getItem('inTuneContent')||'null'); } catch { return null; }
  });
  const navigate = useNavigate();

  useEffect(() => {
    const auth = localStorage.getItem("inTuneAdmin");
    if (!auth) navigate("/admin/login");
    setTeachers(loadTeachers());
  }, [navigate]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (editingId) {
      const next = teachers.map(t => t.id === editingId ? { ...t, ...form, id: editingId } : t);
      setTeachers(next as Teacher[]);
      saveTeachers(next as Teacher[]);
      setForm({}); setEditingId(null);
      return;
    }
    const t: Teacher = {
      id: String(Date.now()),
      name: form.name || "New teacher",
      email: form.email || "",
      phone: form.phone || "",
      years: form.years || "",
      about: form.about || "",
      image: form.image || null,
    };
    const next = [t, ...teachers];
    setTeachers(next);
    saveTeachers(next);
    setForm({});
  };

  const remove = (id: string) => {
    const next = teachers.filter((t) => t.id !== id);
    setTeachers(next);
    saveTeachers(next);
  };

  const edit = (t: Teacher) => {
    setEditingId(t.id);
    setForm({ ...t });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const pickRandom = async () => {
    setLoadingImg(true);
    const u = await getRandomImage("music teacher portrait");
    setLoadingImg(false);
    setForm((f) => ({ ...f, image: u }));
  };

  const onDropImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setForm(f => ({ ...f, image: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onDropImage(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) onDropImage(file);
  };

  const saveContent = () => {
    localStorage.setItem('inTuneContent', JSON.stringify(siteContent || {}));
    alert('Content saved');
  };

  const logout = () => {
    localStorage.removeItem("inTuneAdmin");
    navigate("/");
  };

  const [activeTab, setActiveTab] = useState<'teachers'|'site'|'schedule'|'students'|'theme'|'reports'>('teachers');

  return (
    <div className="container mx-auto py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin — Teachers & Site</h1>
        <div className="flex gap-2">
          <button onClick={logout} className="px-3 py-2 rounded-md border">Logout</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6">
        <div role="tablist" aria-label="Admin sections" className="flex gap-2">
          <button onClick={()=>setActiveTab('teachers')} role="tab" aria-selected={activeTab==='teachers'} className={`px-4 py-2 rounded-md ${activeTab==='teachers' ? 'bg-card shadow' : 'bg-muted'}`}>Teachers</button>
          <button onClick={()=>setActiveTab('site')} role="tab" aria-selected={activeTab==='site'} className={`px-4 py-2 rounded-md ${activeTab==='site' ? 'bg-card shadow' : 'bg-muted'}`}>Site</button>
          <button onClick={()=>setActiveTab('students')} role="tab" aria-selected={activeTab==='students'} className={`px-4 py-2 rounded-md ${activeTab==='students' ? 'bg-card shadow' : 'bg-muted'}`}>Students</button>
          <button onClick={()=>setActiveTab('schedule')} role="tab" aria-selected={activeTab==='schedule'} className={`px-4 py-2 rounded-md ${activeTab==='schedule' ? 'bg-card shadow' : 'bg-muted'}`}>Schedule</button>
          <button onClick={()=>setActiveTab('theme')} role="tab" aria-selected={activeTab==='theme'} className={`px-4 py-2 rounded-md ${activeTab==='theme' ? 'bg-card shadow' : 'bg-muted'}`}>Theme</button>
          <button onClick={()=>setActiveTab('reports')} role="tab" aria-selected={activeTab==='reports'} className={`px-4 py-2 rounded-md ${activeTab==='reports' ? 'bg-card shadow' : 'bg-muted'}`}>Reports</button>
        </div>

        <div className="mt-6">
          {activeTab === 'teachers' && (
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-1 rounded-lg border p-4">
                <h2 className="font-semibold">Add / edit teacher</h2>
                <form className="mt-3" onSubmit={add}>
                  <input className="w-full h-10 rounded-md border px-3 mb-2" placeholder="Name" value={form.name||""} onChange={(e)=>setForm(f=>({...f,name:e.target.value}))} />
                  <input className="w-full h-10 rounded-md border px-3 mb-2" placeholder="Email" value={form.email||""} onChange={(e)=>setForm(f=>({...f,email:e.target.value}))} />
                  <input className="w-full h-10 rounded-md border px-3 mb-2" placeholder="Phone" value={form.phone||""} onChange={(e)=>setForm(f=>({...f,phone:e.target.value}))} />
                  <input className="w-full h-10 rounded-md border px-3 mb-2" placeholder="Years of experience" value={form.years||""} onChange={(e)=>setForm(f=>({...f,years:e.target.value}))} />
                  <textarea className="w-full rounded-md border px-3 mb-2" placeholder="About" value={form.about||""} onChange={(e)=>setForm(f=>({...f,about:e.target.value}))} />

                  <div className="mb-2">
                    <label className="block text-sm font-medium mb-2">Profile picture (drop file or choose)</label>
                    <div onDrop={handleDrop} onDragOver={(e)=>e.preventDefault()} className="border-dashed border-2 border-gray-300 rounded-md p-3 text-sm text-center">
                      {form.image ? <img src={form.image as string} alt="preview" className="mx-auto h-24 object-cover rounded-md" /> : <div className="text-foreground/70">Drop image here or use choose file</div>}
                      <input type="file" accept="image/*" onChange={handleFileChange} className="mt-2 w-full" />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button className="px-4 py-2 rounded-md bg-green-600 text-white">{editingId? 'Save' : 'Add'}</button>
                    <button type="button" onClick={()=>{setForm({}); setEditingId(null);}} className="px-4 py-2 rounded-md border">Clear</button>
                    <button type="button" onClick={pickRandom} className="px-4 py-2 rounded-md border">{loadingImg? 'Loading...':'Random'}</button>
                  </div>
                </form>
              </div>

              <div className="md:col-span-2">
                <h2 className="font-semibold">Existing teachers</h2>
                <div className="mt-4 grid sm:grid-cols-2 gap-4">
                  {teachers.length === 0 && <div className="text-foreground/70">No teachers yet. Use the form to add one.</div>}
                  {teachers.map((t) => (
                    <TeacherCard key={t.id} t={t} onEdit={()=>edit(t)} onRemove={()=>remove(t.id)} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'site' && (
            <div className="rounded-lg border p-4">
              <h2 className="font-semibold">Site content</h2>
              <div className="mt-4 space-y-2">
                <input className="w-full h-10 rounded-md border px-3" placeholder="Site title" value={(siteContent && siteContent.siteTitle) || ''} onChange={(e)=>setSiteContentState(s=>({...s, siteTitle:e.target.value}))} />
                <input className="w-full h-10 rounded-md border px-3" placeholder="Hero heading" value={(siteContent && siteContent.heroHeading) || ''} onChange={(e)=>setSiteContentState(s=>({...s, heroHeading:e.target.value}))} />
                <input className="w-full h-10 rounded-md border px-3" placeholder="Hero subheading" value={(siteContent && siteContent.heroSubheading) || ''} onChange={(e)=>setSiteContentState(s=>({...s, heroSubheading:e.target.value}))} />
                <input className="w-full h-10 rounded-md border px-3" placeholder="Primary CTA" value={(siteContent && siteContent.ctaPrimary) || ''} onChange={(e)=>setSiteContentState(s=>({...s, ctaPrimary:e.target.value}))} />
                <input className="w-full h-10 rounded-md border px-3" placeholder="Secondary CTA" value={(siteContent && siteContent.ctaSecondary) || ''} onChange={(e)=>setSiteContentState(s=>({...s, ctaSecondary:e.target.value}))} />
                <textarea className="w-full rounded-md border px-3" placeholder="Programs intro" value={(siteContent && siteContent.programsIntro) || ''} onChange={(e)=>setSiteContentState(s=>({...s, programsIntro:e.target.value}))} />
                <textarea className="w-full rounded-md border px-3" placeholder="About HTML" value={(siteContent && siteContent.aboutHtml) || ''} onChange={(e)=>setSiteContentState(s=>({...s, aboutHtml:e.target.value}))} />
                <input className="w-full h-10 rounded-md border px-3" placeholder="Address" value={(siteContent && siteContent.address) || ''} onChange={(e)=>setSiteContentState(s=>({...s, address:e.target.value}))} />
                <input className="w-full h-10 rounded-md border px-3" placeholder="Email" value={(siteContent && siteContent.email) || ''} onChange={(e)=>setSiteContentState(s=>({...s, email:e.target.value}))} />
                <input className="w-full h-10 rounded-md border px-3" placeholder="Phone" value={(siteContent && siteContent.phone) || ''} onChange={(e)=>setSiteContentState(s=>({...s, phone:e.target.value}))} />
                <div className="flex gap-2 mt-2">
                  <button onClick={saveContent} className="px-4 py-2 rounded-md bg-blue-600 text-white">Save content</button>
                  <button type="button" onClick={()=>{localStorage.removeItem('inTuneContent'); setSiteContentState(null); alert('Reset');}} className="px-4 py-2 rounded-md border">Reset</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'students' && (
            <div className="rounded-lg border p-4">
              <h2 className="font-semibold">Students</h2>
              <div className="mt-4">
                <StudentsManager />
              </div>
            </div>
          )}

          {activeTab === 'theme' && (
            <div className="rounded-lg border p-4">
              <h2 className="font-semibold">Theme</h2>
              <div className="mt-4">
                <ThemeManager />
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="rounded-lg border p-4">
              <h2 className="font-semibold">Reports</h2>
              <div className="mt-4 grid gap-4">
                <ReportPanel />
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="rounded-lg border p-4">
              <h2 className="font-semibold">Schedule & Bookings</h2>
              <p className="text-sm text-foreground/70">Manage availability and bookings. Click a slot to toggle availability; booked slots are red.</p>
              <div className="mt-4">
                <ScheduleManager visual />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScheduleManager({visual}:{visual?:boolean}={}){
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10));
  const [slots, setSlots] = useState<string[]>([]);
  const [refresh, setRefresh] = useState(0);

  useEffect(()=>{
    setSlots(getSlotsForDay(date));
  },[date]);

  useEffect(()=>{
    // noop to respond to updates
  },[refresh]);

  const toggle = (time:string)=>{
    toggleAvailability(date,time);
    setRefresh(r=>r+1);
  };

  const removeBk = (id:string)=>{
    removeBooking(id);
    setRefresh(r=>r+1);
  };

  const bookings = getBookings(date);
  const avail = getAvailability(date);
  const [students, setStudentsState] = useState(getStudents());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const refreshStudents = ()=> setStudentsState(getStudents());
  const filteredStudents = students.filter(s => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (`${s.name || ''} ${s.email || ''} ${s.phone || ''}`).toLowerCase().includes(q);
  });

  useEffect(()=>{ refreshStudents(); }, []);

  const createBookingForStudent = ()=>{
    if(!selectedSlot || !selectedStudentId) return;
    const bk = addBooking({ date, time: selectedSlot, studentId: selectedStudentId });
    if(!bk){ alert('Unable to create booking (slot unavailable)'); return; }
    setSelectedSlot(null);
    setSelectedStudentId(null);
    setRefresh(r=>r+1);
  };

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2">
        <input type="date" className="rounded-md border px-3 h-10" value={date} onChange={(e)=>setDate(e.target.value)} />
        <button onClick={()=>{ setSlots(getSlotsForDay(date)); setRefresh(r=>r+1); }} className="px-3 py-2 rounded-md border">Refresh</button>
      </div>

      {visual ? (
        <div className="mt-4 grid grid-cols-6 gap-2 items-start">
          <div className="col-span-1">
            <div className="text-sm font-medium mb-2">Time</div>
            <div className="space-y-2">
              {slots.map(s=> (
                <div key={s} className="text-sm text-foreground/70 py-2">{s}</div>
              ))}
            </div>
          </div>
          <div className="col-span-5">
            <div className="text-sm font-medium mb-2">Availability</div>
            <div className="space-y-2">
              {slots.map(s=>{
                const booked = bookings.find(b=>b.time===s);
                const available = avail.includes(s);
                return (
                  <div key={s} className="flex items-center gap-2">
                    <div onClick={()=>{ if(!booked) toggle(s); }} className={`w-full rounded-md py-2 px-3 text-sm cursor-pointer ${booked? 'bg-red-600 text-white' : available? 'bg-green-600 text-white' : 'bg-card text-foreground/80 border'}`}>
                      <div className="flex justify-between">
                        <div>{s}</div>
                        <div>{booked? `Booked: ${booked.name}` : (available? 'Available' : 'Unavailable')}</div>
                      </div>
                    </div>
                    <div>
                      {!booked && available && (
                        <button onClick={()=>{ setSelectedSlot(s); setShowStudentModal(true); }} className="px-3 py-1 rounded-md border">Add</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {slots.map((s)=>{
            const booked = bookings.find(b=>b.time===s);
            const available = avail.includes(s);
            return (
              <div key={s} className="">
                <button
                  onClick={()=>{ if(!booked) toggle(s); }}
                  className={`w-full h-10 rounded-md text-sm ${booked? 'bg-red-100 text-red-800 border' : available? 'bg-green-600 text-white' : 'bg-gray-100 text-foreground/80 border'}`}
                  title={booked? `Booked by ${booked?.name}` : (available? 'Available - click to remove' : 'Not available - click to add')}
                >
                  {s}
                </button>
                {available && !booked && <div className="mt-1"><button onClick={()=>{ setSelectedSlot(s); setShowStudentModal(true); }} className="text-sm rounded-md border px-2 py-1">Add</button></div>}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4">
        <h4 className="font-semibold">Bookings on {date}</h4>
        {bookings.length===0 && <div className="text-foreground/70">No bookings</div>}
        {bookings.map(b=> (
          <div key={b.id} className="flex items-center justify-between gap-2 rounded-md border p-2 mt-2">
            <div>
              <div className="font-medium">{b.time} — {b.name}</div>
              <div className="text-sm text-foreground/70">{b.email} {b.phone ? `• ${b.phone}` : ''} • {b.lessonType || ''}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>removeBk(b.id)} className="px-3 py-1 rounded-md border">Cancel</button>
            </div>
          </div>
        ))}
      </div>

      {/* Student selection modal */}
      {showStudentModal && selectedSlot && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40" onMouseDown={(e)=>{ if(e.target === e.currentTarget) { setShowStudentModal(false); setSelectedSlot(null); setSelectedStudentId(null); } }}>
          <div className="bg-card rounded-md p-4 w-full max-w-lg">
            <div className="flex justify-between items-center">
              <h4 className="font-semibold">Select student for {selectedSlot} on {date}</h4>
              <button onClick={()=>{ setShowStudentModal(false); setSelectedSlot(null); setSelectedStudentId(null); }} className="px-2 py-1 border rounded-md">Close</button>
            </div>
            <div className="mt-3">
              <input placeholder="Search students" className="w-full h-10 rounded-md border px-3" value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} />
              <div className="mt-3 max-h-64 overflow-auto space-y-2">
                {filteredStudents.length===0 && <div className="text-foreground/70">No students found.</div>}
                {filteredStudents.map(s=> (
                  <div key={s.id} className={`p-2 rounded-md border flex items-center justify-between ${selectedStudentId===s.id ? 'bg-gray-100' : ''}`}>
                    <div>
                      <div className="font-medium">{s.name} {s.age ? `• ${s.age}` : ''}</div>
                      <div className="text-sm text-foreground/70">{s.email} {s.phone && `• ${s.phone}`}</div>
                    </div>
                    <div>
                      <button onClick={()=>setSelectedStudentId(s.id)} className="px-3 py-1 rounded-md border mr-2">Select</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={()=>{ createBookingForStudent(); setShowStudentModal(false); }} className="px-4 py-2 rounded-md bg-green-600 text-white">Create booking</button>
                <button onClick={()=>{ setShowStudentModal(false); setSelectedSlot(null); setSelectedStudentId(null); }} className="px-4 py-2 rounded-md border">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TeacherCard({t, onEdit, onRemove}:{t:Teacher,onEdit:()=>void,onRemove:()=>void}){
  const [open,setOpen] = useState(false);
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="flex">
        <img src={t.image||'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&q=60'} alt={t.name} className="w-28 h-28 object-cover" />
        <div className="p-3 flex-1">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-semibold">{t.name}</div>
              <div className="text-sm text-foreground/70">{t.years ? `${t.years} years experience` : 'Experience: N/A'}</div>
              <div className="text-sm text-foreground/70">{t.email}</div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={onEdit} className="px-2 py-1 rounded-md border text-sm">Edit</button>
              <button onClick={onRemove} className="px-2 py-1 rounded-md border text-sm">Remove</button>
            </div>
          </div>
          <p className="mt-2 text-sm text-foreground/70">{t.about}</p>
          <div className="mt-2">
            <button onClick={()=>setOpen(s=>!s)} className="text-sm text-primary underline">{open? 'Hide profile':'View full profile'}</button>
            {open && (
              <div className="mt-3 p-3 bg-muted rounded-md">
                <p className="text-sm">{t.about}</p>
                <p className="text-xs text-foreground/60 mt-2">Contact: {t.email} {t.phone && `• ${t.phone}`}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ThemeManager(){
  const presets: Record<string, {primary:string,brand1:string,brand2:string,secondary:string}> = {
    blue: { primary: '200 100% 41%', brand1: '200 100% 41%', brand2: '200 70% 71%', secondary: '200 70% 71%' },
    grey: { primary: '220 6% 20%', brand1: '220 6% 20%', brand2: '220 6% 35%', secondary: '220 6% 35%' },
    white: { primary: '0 0% 10%', brand1: '0 0% 10%', brand2: '0 0% 20%', secondary: '0 0% 20%' },
    purple: { primary: '270 80% 45%', brand1: '270 80% 45%', brand2: '265 60% 60%', secondary: '265 60% 60%' },
    yellow: { primary: '48 100% 50%', brand1: '48 100% 50%', brand2: '48 80% 70%', secondary: '48 80% 70%' },
  };

  const [preset, setPreset] = useState('blue');
  const [primary, setPrimary] = useState(presets.blue.primary);
  const [brand1, setBrand1] = useState(presets.blue.brand1);
  const [brand2, setBrand2] = useState(presets.blue.brand2);
  const [secondary, setSecondary] = useState(presets.blue.secondary);
  const [primaryColor, setPrimaryColor] = useState('#008CD2');
  const [brand1Color, setBrand1Color] = useState('#008CD2');
  const [brand2Color, setBrand2Color] = useState('#C8E7F6');
  const [secondaryColor, setSecondaryColor] = useState('#C8E7F6');
  const [showPreview, setShowPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<'light'|'dark'>(()=>{
    try{ const v = localStorage.getItem('inTuneThemeMode'); return v === 'dark' ? 'dark' : 'light'; }catch{ return 'light'; }
  });

  useEffect(()=>{
    const saved = localStorage.getItem('inTuneTheme');
    if(saved){
      try{
        const t = JSON.parse(saved);
        setPrimary(t.primary||primary); setBrand1(t.brand1||brand1); setBrand2(t.brand2||brand2); setSecondary(t.secondary||secondary);
      }catch{}
    }
  },[]);

  const hexToHsl = (hex:string) => {
    // strip
    hex = hex.replace('#','');
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    const r1 = r/255, g1 = g/255, b1 = b/255;
    const max = Math.max(r1,g1,b1), min = Math.min(r1,g1,b1);
    let h=0, s=0, l=(max+min)/2;
    if(max!==min){
      const d = max-min;
      s = l > 0.5 ? d/(2-max-min) : d/(max+min);
      switch(max){
        case r1: h = (g1 - b1)/d + (g1 < b1 ? 6 : 0); break;
        case g1: h = (b1 - r1)/d + 2; break;
        case b1: h = (r1 - g1)/d + 4; break;
      }
      h = Math.round(h*60);
    }
    s = Math.round(s*100);
    l = Math.round(l*100);
    return `${h} ${s}% ${l}%`;
  };

  useEffect(()=>{
    if(presets[preset]){
      setPrimary(presets[preset].primary);
      setBrand1(presets[preset].brand1);
      setBrand2(presets[preset].brand2);
      setSecondary(presets[preset].secondary);
    }
    // also update color inputs from HSL by setting defaults (best-effort)
  },[preset]);

  const applyToRoot = (p1:string,p2:string,b1:string,b2:string,sec:string)=>{
    const root = document.documentElement;
    root.style.setProperty('--primary', p1);
    root.style.setProperty('--brand-1', b1);
    root.style.setProperty('--brand-2', b2);
    root.style.setProperty('--secondary', sec);
    root.style.setProperty('--secondary-foreground', '220 12% 12%');
    root.style.setProperty('--ring', p1);
  };

  const preview = ()=>{
    // backup current
    const root = document.documentElement;
    const backup:any = {
      primary: getComputedStyle(root).getPropertyValue('--primary'),
      brand1: getComputedStyle(root).getPropertyValue('--brand-1'),
      brand2: getComputedStyle(root).getPropertyValue('--brand-2'),
      secondary: getComputedStyle(root).getPropertyValue('--secondary'),
    };
    try{ (window as any).__themeModeBackup = root.classList.contains('dark') ? 'dark' : 'light'; }catch{}
    applyToRoot(primary, primary, brand1, brand2, secondary);
    setShowPreview(true);
    // on cancel we'll revert using backup
    (window as any).__themeBackup = backup;
  };

  const confirm = ()=>{
    const payload = { primary, brand1, brand2, secondary };
    localStorage.setItem('inTuneTheme', JSON.stringify(payload));
    applyToRoot(primary, primary, brand1, brand2, secondary);
    setShowPreview(false);
    delete (window as any).__themeBackup;
    alert('Theme saved');
  };

  const cancelPreview = ()=>{
    const root = document.documentElement;
    const b = (window as any).__themeBackup;
    if(b){
      root.style.setProperty('--primary', b.primary);
      root.style.setProperty('--brand-1', b.brand1);
      root.style.setProperty('--brand-2', b.brand2);
      root.style.setProperty('--secondary', b.secondary);
    }
    try{ const m = (window as any).__themeModeBackup; if(m === 'dark'){ root.classList.add('dark'); } else { root.classList.remove('dark'); } }catch{}
    setShowPreview(false);
    delete (window as any).__themeBackup;
    delete (window as any).__themeModeBackup;
  };

  return (
    <div>
      <div className="grid gap-2">
        <label className="text-sm">Preset</label>
        <select className="h-10 rounded-md border px-3" value={preset} onChange={e=>setPreset(e.target.value)}>
          {Object.keys(presets).map(k=> <option key={k} value={k}>{k}</option>)}
        </select>

        <label className="text-sm">Primary color</label>
        <div className="flex gap-2">
          <input type="color" className="h-10 w-12 rounded-md border" value={primaryColor} onChange={e=>{ setPrimaryColor(e.target.value); setPrimary(hexToHsl(e.target.value)); setBrand1(hexToHsl(e.target.value)); setBrand1Color(e.target.value); }} />
          <input className="h-10 rounded-md border px-3 flex-1" value={primary} onChange={e=>setPrimary(e.target.value)} />
        </div>

        <label className="text-sm">Brand 1 color</label>
        <div className="flex gap-2">
          <input type="color" className="h-10 w-12 rounded-md border" value={brand1Color} onChange={e=>{ setBrand1Color(e.target.value); setBrand1(hexToHsl(e.target.value)); }} />
          <input className="h-10 rounded-md border px-3 flex-1" value={brand1} onChange={e=>setBrand1(e.target.value)} />
        </div>

        <label className="text-sm">Brand 2 color</label>
        <div className="flex gap-2">
          <input type="color" className="h-10 w-12 rounded-md border" value={brand2Color} onChange={e=>{ setBrand2Color(e.target.value); setBrand2(hexToHsl(e.target.value)); }} />
          <input className="h-10 rounded-md border px-3 flex-1" value={brand2} onChange={e=>setBrand2(e.target.value)} />
        </div>

        <label className="text-sm">Secondary color</label>
        <div className="flex gap-2">
          <input type="color" className="h-10 w-12 rounded-md border" value={secondaryColor} onChange={e=>{ setSecondaryColor(e.target.value); setSecondary(hexToHsl(e.target.value)); }} />
          <input className="h-10 rounded-md border px-3 flex-1" value={secondary} onChange={e=>setSecondary(e.target.value)} />
        </div>

        <div className="flex gap-2">
          <button onClick={preview} className="px-4 py-2 rounded-md bg-green-600 text-white">Preview</button>
          <button onClick={confirm} className="px-4 py-2 rounded-md border">Save</button>
        </div>

      </div>

      {showPreview && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40" onMouseDown={(e)=>{ if(e.target === e.currentTarget) { cancelPreview(); } }}>
          <div className="bg-card rounded-md p-4 w-[900px] max-w-full">
            <div className="flex justify-between items-center">
              <h4 className="font-semibold">Home preview</h4>
              <button onClick={cancelPreview} className="px-2 py-1 border rounded-md">Close</button>
            </div>
            <div className="mt-4">
              <ThemeHomePreview mode={previewMode} setMode={setPreviewMode} />
              <div className="mt-4 flex gap-2 justify-end">
                <button onClick={()=>{ if(previewMode === 'dark') document.documentElement.classList.add('dark'); else document.documentElement.classList.remove('dark'); try{ localStorage.setItem('inTuneThemeMode', previewMode); }catch{}; confirm(); }} className="px-4 py-2 rounded-md bg-green-600 text-white">Apply</button>
                <button onClick={()=>{ cancelPreview(); }} className="px-4 py-2 rounded-md border">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function ReportPanel(){
  const today = new Date().toISOString().slice(0,10);
  const [studentsCount, setStudentsCount] = useState(() => getStudents().length);
  const [bookingsToday, setBookingsToday] = useState(() => getBookings(today).length);

  useEffect(()=>{
    const id = setInterval(()=>{
      setStudentsCount(getStudents().length);
      setBookingsToday(getBookings(new Date().toISOString().slice(0,10)).length);
    }, 2000);
    return ()=>clearInterval(id);
  },[]);

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="rounded-md border p-4">
        <div className="text-sm text-foreground/70">Students</div>
        <div className="text-2xl font-bold">{studentsCount}</div>
      </div>
      <div className="rounded-md border p-4">
        <div className="text-sm text-foreground/70">Bookings today</div>
        <div className="text-2xl font-bold">{bookingsToday}</div>
      </div>
      <div className="rounded-md border p-4">
        <div className="text-sm text-foreground/70">Theme</div>
        <div className="text-sm">Primary: hsl(var(--primary))</div>
      </div>
    </div>
  );
}

function StudentsManager(){
  const instrumentsList = ['Guitar','Piano','Violin','Drums','Bass','Saxophone','Voice','Ukulele','Flute'];
  const [students, setStudents] = useState(getStudents());
  const [form, setForm] = useState<Partial<any>>({name:'', age:16, isElderly:false, medications:'', marketingConsent:false, allergies:'', instruments:[], bandName:'', email:'', phone:'', address:'', emergencyContacts:'', parentGuardianName:'', parentGuardianEmail:'', parentGuardianPhone:''});
  const [editing, setEditing] = useState<string | null>(null);
  const [selectedInstrument, setSelectedInstrument] = useState(instrumentsList[0]);

  const refresh = ()=> setStudents(getStudents());

  const save = (e?:FormEvent)=>{
    if(e) e.preventDefault();
    if(!form.name) { alert('Name is required'); return; }
    if(typeof form.age !== 'number' || isNaN(form.age as any)) { alert('Age is required'); return; }
    const payload: any = {
      name: form.name,
      age: form.age,
      isElderly: !!form.isElderly,
      medications: form.medications || '',
      marketingConsent: !!form.marketingConsent,
      allergies: form.allergies || '',
      instruments: form.instruments || [],
      bandName: form.bandName || '',
      email: form.email || '',
      phone: form.phone || '',
      address: form.address || '',
      emergencyContacts: form.emergencyContacts || '',
      parentGuardianName: form.parentGuardianName || '',
      parentGuardianEmail: form.parentGuardianEmail || '',
      parentGuardianPhone: form.parentGuardianPhone || '',
    };
    if(editing){
      updateStudentInStore(editing, payload);
    } else {
      addStudentToStore(payload);
    }
    setForm({name:'', age:16, isElderly:false, medications:'', marketingConsent:false, allergies:'', instruments:[], bandName:'', email:'', phone:'', address:'', emergencyContacts:'', parentGuardianName:'', parentGuardianEmail:'', parentGuardianPhone:''}); setEditing(null); refresh();
  };

  const edit = (s:any)=>{ setEditing(s.id); setForm({ name: s.name, age: s.age || 16, isElderly: !!s.isElderly, medications: s.medications || '', marketingConsent: !!s.marketingConsent, allergies: s.allergies || '', instruments: s.instruments || [], bandName: s.bandName || '', email: s.email, phone: s.phone, address: s.address, emergencyContacts: s.emergencyContacts, parentGuardianName: s.parentGuardianName, parentGuardianEmail: s.parentGuardianEmail, parentGuardianPhone: s.parentGuardianPhone }); };
  const remove = (id:string)=>{ removeStudentFromStore(id); refresh(); };

  const addInstrument = ()=>{
    const cur = form.instruments || [];
    if(cur.length >=3) return alert('Max 3 instruments');
    if(cur.includes(selectedInstrument)) return;
    setForm(f=>({...f, instruments: [...(f.instruments||[]), selectedInstrument]}));
  };
  const removeInstrument = (ins:string)=> setForm(f=>({...f, instruments: (f.instruments||[]).filter((i:any)=>i!==ins)}));

  const isUnder16 = (form.age !== undefined && form.age < 16);
  const isElderly = (form.isElderly || (form.age !== undefined && form.age >= 65));

  return (
    <div>
      <form onSubmit={save} className="grid gap-2">
        <input className="h-10 rounded-md border px-3" placeholder="Name" value={form.name||''} onChange={e=>setForm(f=>({...f, name:e.target.value}))} />
        <div className="flex gap-2">
          <input type="number" className="h-10 rounded-md border px-3 flex-1" placeholder="Age" value={form.age===undefined? '': String(form.age)} onChange={e=>setForm(f=>({...f, age: parseInt(e.target.value || '0') }))} />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!form.isElderly} onChange={e=>setForm(f=>({...f, isElderly: e.target.checked}))} /> Elderly
          </label>
        </div>

        <input className="h-10 rounded-md border px-3" placeholder="Emergency contacts" value={form.emergencyContacts||''} onChange={e=>setForm(f=>({...f, emergencyContacts:e.target.value}))} />
        <input className="h-10 rounded-md border px-3" placeholder="Address (optional)" value={form.address||''} onChange={e=>setForm(f=>({...f, address:e.target.value}))} />

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!form.marketingConsent} onChange={e=>setForm(f=>({...f, marketingConsent: e.target.checked}))} />
          <span className="text-sm">Marketing consent</span>
        </label>

        <label className="text-sm">Allergies or similar issues (optional)</label>
        <textarea className="rounded-md border px-3 py-2" placeholder="Allergies, intolerances or other relevant details" value={form.allergies||''} onChange={e=>setForm(f=>({...f, allergies:e.target.value}))} />

        <label className="text-sm">Instrument(s) (max 3)</label>
        <div className="flex gap-2">
          <select className="h-10 rounded-md border px-3 flex-1" value={selectedInstrument} onChange={e=>setSelectedInstrument(e.target.value)}>
            {instrumentsList.map(i=> <option key={i} value={i}>{i}</option>)}
          </select>
          <button type="button" onClick={addInstrument} className="px-3 py-2 rounded-md border">Add instrument</button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(form.instruments||[]).map((ins:any)=> (
            <div key={ins} className="px-2 py-1 rounded-md border flex items-center gap-2">
              <div>{ins}</div>
              <button type="button" onClick={()=>removeInstrument(ins)} className="px-2 py-1 rounded-md border">x</button>
            </div>
          ))}
        </div>

        <input className="h-10 rounded-md border px-3" placeholder="Band name (optional)" value={form.bandName||''} onChange={e=>setForm(f=>({...f, bandName:e.target.value}))} />

        {isUnder16 ? (
          <>
            <input className="h-10 rounded-md border px-3" placeholder="Parent/Guardian name" value={form.parentGuardianName||''} onChange={e=>setForm(f=>({...f, parentGuardianName:e.target.value}))} />
            <input className="h-10 rounded-md border px-3" placeholder="Parent/Guardian phone" value={form.parentGuardianPhone||''} onChange={e=>setForm(f=>({...f, parentGuardianPhone:e.target.value}))} />
            <input className="h-10 rounded-md border px-3" placeholder="Parent/Guardian email" value={form.parentGuardianEmail||''} onChange={e=>setForm(f=>({...f, parentGuardianEmail:e.target.value}))} />
          </>
        ) : (
          <>
            <input className="h-10 rounded-md border px-3" placeholder="Phone (optional)" value={form.phone||''} onChange={e=>setForm(f=>({...f, phone:e.target.value}))} />
            <input className="h-10 rounded-md border px-3" placeholder="Email" value={form.email||''} onChange={e=>setForm(f=>({...f, email:e.target.value}))} />
          </>
        )}

        {isElderly && (
          <>
            <label className="text-sm">Medications / medical info (optional)</label>
            <textarea className="rounded-md border px-3 py-2" placeholder="Any medications or important medical information" value={form.medications||''} onChange={e=>setForm(f=>({...f, medications:e.target.value}))} />
          </>
        )}

        <div className="flex gap-2">
          <button className="px-4 py-2 rounded-md bg-green-600 text-white">{editing? 'Save' : 'Add'}</button>
          <button type="button" onClick={()=>{ setForm({name:'', age:16, isElderly:false, medications:'', marketingConsent:false, allergies:'', instruments:[], bandName:'', email:'', phone:'', address:'', emergencyContacts:'', parentGuardianName:'', parentGuardianEmail:'', parentGuardianPhone:''}); setEditing(null); }} className="px-4 py-2 rounded-md border">Clear</button>
        </div>
      </form>

      <div className="mt-4 grid gap-2">
        {students.length===0 && <div className="text-foreground/70">No students yet.</div>}
        {students.map(s=> (
          <div key={s.id} className="flex items-center justify-between rounded-md border p-2">
            <div>
              <div className="font-medium">{s.name} {s.age ? `• ${s.age}` : ''} {s.isElderly ? '• Elderly' : ''}</div>
              <div className="text-sm text-foreground/70">{s.email} {s.phone && `• ${s.phone}`}</div>
              {s.bandName && <div className="text-sm text-foreground/70">Band: {s.bandName}</div>}
              {s.instruments && s.instruments.length>0 && <div className="text-sm text-foreground/70">Instruments: {s.instruments.join(', ')}</div>}
              {s.parentGuardianName && <div className="text-sm text-foreground/70">Guardian: {s.parentGuardianName} {s.parentGuardianPhone && `• ${s.parentGuardianPhone}`}</div>}
              {s.isElderly && s.medications && <div className="text-sm text-foreground/70">Medications: {s.medications}</div>}
              {s.allergies && <div className="text-sm text-foreground/70">Allergies: {s.allergies}</div>}
              <div className="text-sm text-foreground/70">Marketing consent: {s.marketingConsent ? 'Yes' : 'No'}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>edit(s)} className="px-2 py-1 rounded-md border">Edit</button>
              <button onClick={()=>remove(s.id)} className="px-2 py-1 rounded-md border">Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

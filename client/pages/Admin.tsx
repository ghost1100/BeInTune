import {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
  FormEvent,
  DragEvent,
  ChangeEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { getRandomImage } from "@/lib/unsplash";
import {
  getSlotsForDay,
  getAvailability,
  toggleAvailability,
  getBookings,
  addBooking,
  removeBooking,
  isSlotBooked,
  getSlotsWithMeta,
} from "@/lib/schedule";
import studentsAPI from "@/lib/students";
import ThemeHomePreview from "@/components/admin/ThemeHomePreview";
import useTheme from "@/hooks/useTheme";
import SecurityPanel from "@/components/admin/SecurityPanel";
import NewsletterComposer from "@/components/admin/NewsletterComposer";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import DiscussionFeed from "@/components/student/DiscussionFeed";
import ChatsPanel from "@/components/student/ChatsPanel";
import NotificationBell from "@/components/ui/NotificationBell";

type Teacher = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  years?: string;
  about?: string;
  image?: string | null;
};

async function loadTeachersFromDb(): Promise<Teacher[]> {
  try {
    const { apiFetch } = await import("@/lib/api");
    const data = await apiFetch("/api/admin/teachers");
    if (!data || !Array.isArray(data)) return [];
    return (data || []).map((r: any) => ({
      id: r.user_id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      years: r.years,
      about: r.about,
      image: r.image,
    }));
  } catch (e) {
    console.error(e);
    return [];
  }
}

export default function Admin() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loadingImg, setLoadingImg] = useState(false);
  const [form, setForm] = useState<Partial<Teacher>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [siteContent, setSiteContentState] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("inTuneContent") || "null");
    } catch {
      return null;
    }
  });
  const navigate = useNavigate();
  const [showNewsletter, setShowNewsletter] = useState(false);

  useEffect(() => {
    const auth = localStorage.getItem("inTuneAdmin");
    if (!auth) navigate("/admin/login");
    (async () => {
      const ts = await loadTeachersFromDb();
      setTeachers(ts);
    })();
  }, [navigate]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        // update existing teacher
        await fetch("/api/admin/teachers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: editingId,
            email: form.email,
            name: form.name,
            phone: form.phone,
            years: form.years,
            about: form.about,
            image: form.image,
          }),
        });
        setForm({});
        setEditingId(null);
        const ts = await loadTeachersFromDb();
        setTeachers(ts);
        return;
      }

      await fetch("/api/admin/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          name: form.name,
          phone: form.phone,
          years: form.years,
          about: form.about,
          image: form.image,
        }),
      });
      setForm({});
      const ts = await loadTeachersFromDb();
      setTeachers(ts);
    } catch (e) {
      console.error(e);
      alert("Unable to save teacher");
    }
  };

  const remove = async (id: string) => {
    try {
      await fetch(`/api/admin/teachers/${id}`, { method: "DELETE" });
      const ts = await loadTeachersFromDb();
      setTeachers(ts);
    } catch (e) {
      console.error(e);
      alert("Unable to remove teacher");
    }
  };

  const edit = (t: Teacher) => {
    setEditingId(t.id);
    setForm({ ...t });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pickRandom = async () => {
    setLoadingImg(true);
    const u = await getRandomImage("music teacher portrait");
    setLoadingImg(false);
    setForm((f) => ({ ...f, image: u }));
  };

  const onDropImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () =>
      setForm((f) => ({ ...f, image: reader.result as string }));
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
    localStorage.setItem("inTuneContent", JSON.stringify(siteContent || {}));
    alert("Content saved");
  };

  const logout = async () => {
    try {
      // tell server to clear httpOnly cookie
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (e) {
      console.error("Logout request failed", e);
    }

    try {
      // remove any stored auth fallbacks and app data
      localStorage.removeItem("inTuneAdmin");
      localStorage.removeItem("inTuneStudent");
      localStorage.removeItem("inTuneToken");
      localStorage.removeItem("inTuneContent");
      sessionStorage.clear();

      // clear Cache Storage
      if (typeof window !== "undefined" && (window as any).caches) {
        const keys = await (window as any).caches.keys();
        await Promise.all(
          keys.map((k: string) => (window as any).caches.delete(k)),
        );
      }

      // clear non-httpOnly cookies
      if (typeof document !== "undefined") {
        document.cookie.split(";").forEach((cookie) => {
          const eqPos = cookie.indexOf("=");
          const name =
            eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
          // expire cookie for root path
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        });
      }

      // unregister service workers
      if (
        typeof navigator !== "undefined" &&
        navigator.serviceWorker &&
        navigator.serviceWorker.getRegistrations
      ) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch (err) {
      console.error("Error clearing client data during logout", err);
    }

    navigate("/");
  };

  const [activeTab, setActiveTab] = useState<
    | "teachers"
    | "site"
    | "schedule"
    | "students"
    | "theme"
    | "reports"
    | "security"
    | "discussion"
    | "chats"
  >("teachers");

  return (
    <div className="container mx-auto py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin — Teachers & Site</h1>
        <div className="flex gap-2 flex-wrap">
          <NotificationBell />
          <button onClick={logout} className="px-3 py-2 rounded-md border">
            Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6">
        <div
          role="tablist"
          aria-label="Admin sections"
          className="flex gap-2 flex-wrap"
        >
          <button
            onClick={() => setActiveTab("teachers")}
            role="tab"
            aria-selected={activeTab === "teachers"}
            className={`px-4 py-2 rounded-md ${activeTab === "teachers" ? "bg-card shadow" : "bg-muted"} text-foreground`}
          >
            Teachers
          </button>
          <button
            onClick={() => setActiveTab("site")}
            role="tab"
            aria-selected={activeTab === "site"}
            className={`px-4 py-2 rounded-md ${activeTab === "site" ? "bg-card shadow" : "bg-muted"} text-foreground`}
          >
            Site
          </button>
          <button
            onClick={() => setActiveTab("schedule")}
            role="tab"
            aria-selected={activeTab === "schedule"}
            className={`px-4 py-2 rounded-md ${activeTab === "schedule" ? "bg-card shadow" : "bg-muted"} text-foreground`}
          >
            Schedule
          </button>
          <button
            onClick={() => setActiveTab("theme")}
            role="tab"
            aria-selected={activeTab === "theme"}
            className={`px-4 py-2 rounded-md ${activeTab === "theme" ? "bg-card shadow" : "bg-muted"} text-foreground`}
          >
            Theme
          </button>
          <button
            onClick={() => setActiveTab("students")}
            role="tab"
            aria-selected={activeTab === "students"}
            className={`px-4 py-2 rounded-md ${activeTab === "students" ? "bg-card shadow" : "bg-muted"} text-foreground`}
          >
            Students
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            role="tab"
            aria-selected={activeTab === "reports"}
            className={`px-4 py-2 rounded-md ${activeTab === "reports" ? "bg-card shadow" : "bg-muted"} text-foreground`}
          >
            Reports
          </button>
          <button
            onClick={() => setActiveTab("discussion")}
            role="tab"
            aria-selected={activeTab === "discussion"}
            className={`px-4 py-2 rounded-md ${activeTab === "discussion" ? "bg-card shadow" : "bg-muted"} text-foreground`}
          >
            Discussion
          </button>
          <button
            onClick={() => setActiveTab("chats")}
            role="tab"
            aria-selected={activeTab === "chats"}
            className={`px-4 py-2 rounded-md ${activeTab === "chats" ? "bg-card shadow" : "bg-muted"} text-foreground`}
          >
            Chats
          </button>
          <button
            onClick={() => setActiveTab("security")}
            role="tab"
            aria-selected={activeTab === "security"}
            className={`px-4 py-2 rounded-md ${activeTab === "security" ? "bg-card shadow" : "bg-muted"} text-foreground`}
          >
            Security
          </button>
        </div>

        <div className="mt-6">
          {activeTab === "teachers" && (
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-1 rounded-lg border p-4">
                <h2 className="font-semibold">Add / edit teacher</h2>
                <form className="mt-3" onSubmit={add}>
                  <label htmlFor="teacherName" className="sr-only">
                    Name
                  </label>
                  <input
                    id="teacherName"
                    name="name"
                    className="w-full h-10 rounded-md border px-3 mb-2"
                    placeholder="Name"
                    value={form.name || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    autoComplete="name"
                  />
                  <label htmlFor="teacherEmail" className="sr-only">
                    Email
                  </label>
                  <input
                    id="teacherEmail"
                    name="email"
                    className="w-full h-10 rounded-md border px-3 mb-2"
                    placeholder="Email"
                    value={form.email || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    autoComplete="email"
                  />
                  <label htmlFor="teacherPhone" className="sr-only">
                    Phone
                  </label>
                  <input
                    id="teacherPhone"
                    name="phone"
                    className="w-full h-10 rounded-md border px-3 mb-2"
                    placeholder="Phone"
                    value={form.phone || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    autoComplete="tel"
                  />
                  <label htmlFor="teacherYears" className="sr-only">
                    Years of experience
                  </label>
                  <input
                    id="teacherYears"
                    name="years"
                    className="w-full h-10 rounded-md border px-3 mb-2"
                    placeholder="Years of experience"
                    value={form.years || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, years: e.target.value }))
                    }
                    autoComplete="off"
                  />
                  <label htmlFor="teacherAbout" className="sr-only">
                    About
                  </label>
                  <textarea
                    id="teacherAbout"
                    name="about"
                    className="w-full rounded-md border px-3 mb-2"
                    placeholder="About"
                    value={form.about || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, about: e.target.value }))
                    }
                  />

                  <div className="mb-2">
                    <label
                      htmlFor="teacherImage"
                      className="block text-sm font-medium mb-2"
                    >
                      Profile picture (drop file or choose)
                    </label>
                    <div
                      onDrop={handleDrop}
                      onDragOver={(e) => e.preventDefault()}
                      className="border-dashed border-2 border-gray-300 rounded-md p-3 text-sm text-center"
                    >
                      {form.image ? (
                        <img
                          src={form.image as string}
                          alt="preview"
                          className="mx-auto h-24 object-cover rounded-md"
                        />
                      ) : (
                        <div className="text-foreground/70">
                          Drop image here or use choose file
                        </div>
                      )}
                      <input
                        id="teacherImage"
                        name="image"
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="mt-2 w-full"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <button className="px-4 py-2 rounded-md bg-primary text-primary-foreground">
                      {editingId ? "Save" : "Add"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setForm({});
                        setEditingId(null);
                      }}
                      className="px-4 py-2 rounded-md border"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={pickRandom}
                      className="px-4 py-2 rounded-md border"
                    >
                      {loadingImg ? "Loading..." : "Random"}
                    </button>
                  </div>
                </form>
              </div>

              <div className="md:col-span-2">
                <h2 className="font-semibold">Existing teachers</h2>
                <div className="mt-4 grid sm:grid-cols-2 gap-4">
                  {teachers.length === 0 && (
                    <div className="text-foreground/70">
                      No teachers yet. Use the form to add one.
                    </div>
                  )}
                  {teachers.map((t) => (
                    <TeacherCard
                      key={t.id}
                      t={t}
                      onEdit={() => edit(t)}
                      onRemove={() => remove(t.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "site" && (
            <div className="rounded-lg border p-4">
              <h2 className="font-semibold">Site content</h2>
              <div className="mt-4 space-y-2">
                <input
                  name="siteTitle"
                  className="w-full h-10 rounded-md border px-3"
                  placeholder="Site title"
                  value={(siteContent && siteContent.siteTitle) || ""}
                  onChange={(e) =>
                    setSiteContentState((s) => ({
                      ...s,
                      siteTitle: e.target.value,
                    }))
                  }
                />
                <label htmlFor="heroHeading" className="sr-only">
                  Hero heading
                </label>
                <input
                  id="heroHeading"
                  name="heroHeading"
                  className="w-full h-10 rounded-md border px-3"
                  placeholder="Hero heading"
                  value={(siteContent && siteContent.heroHeading) || ""}
                  onChange={(e) =>
                    setSiteContentState((s) => ({
                      ...s,
                      heroHeading: e.target.value,
                    }))
                  }
                />
                <label htmlFor="heroSubheading" className="sr-only">
                  Hero subheading
                </label>
                <input
                  id="heroSubheading"
                  name="heroSubheading"
                  className="w-full h-10 rounded-md border px-3"
                  placeholder="Hero subheading"
                  value={(siteContent && siteContent.heroSubheading) || ""}
                  onChange={(e) =>
                    setSiteContentState((s) => ({
                      ...s,
                      heroSubheading: e.target.value,
                    }))
                  }
                />
                <label htmlFor="ctaPrimary" className="sr-only">
                  Primary CTA
                </label>
                <input
                  id="ctaPrimary"
                  name="ctaPrimary"
                  className="w-full h-10 rounded-md border px-3"
                  placeholder="Primary CTA"
                  value={(siteContent && siteContent.ctaPrimary) || ""}
                  onChange={(e) =>
                    setSiteContentState((s) => ({
                      ...s,
                      ctaPrimary: e.target.value,
                    }))
                  }
                />
                <label htmlFor="ctaSecondary" className="sr-only">
                  Secondary CTA
                </label>
                <input
                  id="ctaSecondary"
                  name="ctaSecondary"
                  className="w-full h-10 rounded-md border px-3"
                  placeholder="Secondary CTA"
                  value={(siteContent && siteContent.ctaSecondary) || ""}
                  onChange={(e) =>
                    setSiteContentState((s) => ({
                      ...s,
                      ctaSecondary: e.target.value,
                    }))
                  }
                />
                <label htmlFor="programsIntro" className="sr-only">
                  Programs intro
                </label>
                <textarea
                  id="programsIntro"
                  name="programsIntro"
                  className="w-full rounded-md border px-3"
                  placeholder="Programs intro"
                  value={(siteContent && siteContent.programsIntro) || ""}
                  onChange={(e) =>
                    setSiteContentState((s) => ({
                      ...s,
                      programsIntro: e.target.value,
                    }))
                  }
                />
                <label htmlFor="aboutHtml" className="sr-only">
                  About HTML
                </label>
                <textarea
                  id="aboutHtml"
                  name="aboutHtml"
                  className="w-full rounded-md border px-3"
                  placeholder="About HTML"
                  value={(siteContent && siteContent.aboutHtml) || ""}
                  onChange={(e) =>
                    setSiteContentState((s) => ({
                      ...s,
                      aboutHtml: e.target.value,
                    }))
                  }
                />
                <label htmlFor="siteAddress" className="sr-only">
                  Address
                </label>
                <input
                  id="siteAddress"
                  name="address"
                  className="w-full h-10 rounded-md border px-3"
                  placeholder="Address"
                  value={(siteContent && siteContent.address) || ""}
                  onChange={(e) =>
                    setSiteContentState((s) => ({
                      ...s,
                      address: e.target.value,
                    }))
                  }
                />
                <label htmlFor="siteEmail" className="sr-only">
                  Email
                </label>
                <input
                  id="siteEmail"
                  name="email"
                  className="w-full h-10 rounded-md border px-3"
                  placeholder="Email"
                  value={(siteContent && siteContent.email) || ""}
                  onChange={(e) =>
                    setSiteContentState((s) => ({
                      ...s,
                      email: e.target.value,
                    }))
                  }
                />
                <label htmlFor="sitePhone" className="sr-only">
                  Phone
                </label>
                <input
                  id="sitePhone"
                  name="phone"
                  className="w-full h-10 rounded-md border px-3"
                  placeholder="Phone"
                  value={(siteContent && siteContent.phone) || ""}
                  onChange={(e) =>
                    setSiteContentState((s) => ({
                      ...s,
                      phone: e.target.value,
                    }))
                  }
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={saveContent}
                    className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground"
                  >
                    Save content
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem("inTuneContent");
                      setSiteContentState(null);
                      alert("Reset");
                    }}
                    className="px-4 py-2 rounded-md border"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewsletter(true)}
                    className="px-4 py-2 rounded-md bg-primary text-primary-foreground"
                  >
                    Compose newsletter
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "theme" && (
            <div className="rounded-lg border p-4">
              <h2 className="font-semibold">Theme</h2>
              <div className="mt-4">
                <ThemeManager />
              </div>
            </div>
          )}

          {activeTab === "students" && (
            <div className="rounded-lg border p-4">
              <h2 className="font-semibold">Students</h2>
              <div className="mt-4">
                <StudentsManager />
              </div>
            </div>
          )}

          {activeTab === "reports" && (
            <div className="rounded-lg border p-4">
              <h2 className="font-semibold">Reports</h2>
              <div className="mt-4 grid gap-4">
                <ReportPanel />
              </div>
            </div>
          )}

          {activeTab === "discussion" && (
            <div className="rounded-lg border p-4">
              <h2 className="font-semibold">Discussion</h2>
              <div className="mt-4">
                <DiscussionFeed />
              </div>
            </div>
          )}

          {activeTab === "chats" && (
            <div className="rounded-lg border p-4">
              <h2 className="font-semibold">Chats</h2>
              <div className="mt-4">
                <ChatsPanel />
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="rounded-lg border p-4">
              <h2 className="font-semibold">Security</h2>
              <div className="mt-4">
                <SecurityPanel />
              </div>
            </div>
          )}

          {activeTab === "schedule" && (
            <div className="rounded-lg border p-4">
              <h2 className="font-semibold">Schedule & Bookings</h2>
              <p className="text-sm text-foreground/70">
                Manage availability and bookings. Click a slot to toggle
                availability; booked slots are red.
              </p>
              <div className="mt-4">
                <ScheduleManager visual />
              </div>
            </div>
          )}
        </div>
      </div>

      {showNewsletter && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowNewsletter(false);
            }
          }}
        >
          <div className="w-full max-w-3xl p-4">
            <NewsletterComposer onClose={() => setShowNewsletter(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

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

function randomPassword(len = 12) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function ScheduleManager({ visual }: { visual?: boolean } = {}) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<string[]>([]);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    setSlots(getSlotsForDay(date));
  }, [date]);

  useEffect(() => {
    (async () => {
      try {
        const b = await getBookings(date);
        const a = await getAvailability(date);
        const meta = await getSlotsWithMeta(date);
        setBookingsState(Array.isArray(b) ? b : []);
        setAvailState(Array.isArray(a) ? a : []);
        setSlotMeta(Array.isArray(meta) ? meta : []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [date, refresh]);

  const toggle = async (time: string) => {
    await toggleAvailability(date, time);
    setRefresh((r) => r + 1);
  };

  const removeBk = async (id: string, options?: { reason?: string | null; notify?: boolean }) => {
    await removeBooking(id, options);
    setRefresh((r) => r + 1);
  };

  const [bookingsState, setBookingsState] = useState<any[]>([]);
  const [availState, setAvailState] = useState<string[]>([]);
  const [slotMeta, setSlotMeta] = useState<any[]>([]);
  const [students, setStudentsState] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null,
  );
  const [isCancelling, setIsCancelling] = useState<string | null>(null);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [bookingDetail, setBookingDetail] = useState<any | null>(null);
  const [cancellationBooking, setCancellationBooking] = useState<any | null>(null);
  const [cancellationReason, setCancellationReason] = useState<string>("");
  const cancellationReasons = [
    "Teacher unavailable",
    "Illness / emergency",
    "Rescheduling needed",
    "Other",
  ];

  const refreshStudents = async () => {
    try {
      const s = await studentsAPI.list();
      setStudentsState(Array.isArray(s) ? s : []);
    } catch (e) {
      console.error(e);
    }
  };
  const filteredStudents = students.filter((s: any) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return `${s.name || ""} ${s.email || ""} ${s.phone || ""}`
      .toLowerCase()
      .includes(q);
  });

  useEffect(() => {
    (async () => {
      await refreshStudents();
    })();
  }, []);

  const createBookingForStudent = async () => {
    if (!selectedSlot || !selectedStudentId) return;
    const bk = await addBooking({
      date,
      time: selectedSlot,
      studentId: selectedStudentId,
    });
    if (!bk) {
      alert("Unable to create booking (slot unavailable)");
      return;
    }
    setSelectedSlot(null);
    setSelectedStudentId(null);
    setShowStudentModal(false);
    setRefresh((r) => r + 1);
  };

  return (
    <div className="mt-4">
      <style>{`@media (max-width: 991px) { .details-btn-responsive{margin-right:490px;background-color:rgba(208,2,27,1);padding:0 8px;} .cancel-btn-responsive{color:rgba(208,2,27,1);} }`}</style>
      <div className="flex items-center gap-2">
        <input
          type="date"
          name="scheduleDate"
          className="rounded-md border px-3 h-10"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <button
          onClick={() => {
            setSlots(getSlotsForDay(date));
            setRefresh((r) => r + 1);
          }}
          className="px-3 py-2 rounded-md border"
        >
          Refresh
        </button>
      </div>

      {visual ? (
        <div className="mt-4 grid grid-cols-6 gap-2 items-start">
          <div className="col-span-1">
            <div className="text-sm font-medium mb-2">Time</div>
            <div className="space-y-2">
              {slots.map((s) => {
                const booked = bookingsState.find((b) => b.time === s);
                const isGuest = booked && !booked.student_user_id;
                return (
                  <div key={s} className="text-sm text-foreground/70 py-2 flex items-center gap-2">
                    <span>{s}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="col-span-5">
            <div className="text-sm font-medium mb-2">Availability</div>
            <div className="space-y-2">
              {slots.map((s) => {
                const meta = slotMeta.find(
                  (m) =>
                    normalizeTime(m.slot_time || m.slotTime || m.time) === s,
                );
                const booked = bookingsState.find((b) => b.time === s);
                const available = availState.includes(s);
                return (
                  <div key={s} className="flex items-center gap-2">
                    <div
                      onClick={() => {
                        if (booked) {
                          setCancellationBooking(booked);
                          setCancellationReason("");
                          return;
                        }
                        if (available) {
                          setSelectedSlot(s);
                          setShowStudentModal(true);
                        } else {
                          toggle(s);
                        }
                      }}
                      className={`w-full rounded-md py-2 px-3 text-sm cursor-pointer ${booked ? "bg-destructive text-destructive-foreground" : available ? "bg-primary text-primary-foreground" : "bg-card text-foreground/80 border"}`}
                    >
                      <div className="flex flex-col lg:flex-row items-center justify-between gap-2">
                        {booked && (
                          <button
                            type="button"
                            title="View booking details"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBookingDetail(booked);
                            }}
                            className="details-btn-responsive text-xs rounded-md border px-2 py-1 bg-transparent"
                          >
                            <p>
                              Details<span className="ql-cursor">{'\uFEFF'}</span>
                            </p>
                          </button>
                        )}

                        <div className="flex justify-between items-center w-full">
                          <div>{s}</div>
                          <div>
                            {booked
                              ? `Booked: ${booked.student_name || booked.student_email || booked.name || booked.email || "Unknown"}`
                              : available
                                ? "Available"
                                : meta && meta.is_available === false
                                  ? "Unavailable"
                                  : "Available"}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      {booked ? (
                        <button
                          type="button"
                          onClick={() => {
                            setCancellationBooking(booked);
                            setCancellationReason("");
                          }}
                          className="px-3 py-1 rounded-md border"
                          disabled={isCancelling === booked.id}
                        >
                          {isCancelling === booked.id
                            ? "Cancelling..."
                            : "Unbook"}
                        </button>
                      ) : (
                        available && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSlot(s);
                              setShowStudentModal(true);
                            }}
                            className="px-3 py-1 rounded-md border"
                          >
                            Add
                          </button>
                        )
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
          {slots.map((s) => {
            const meta = slotMeta.find(
              (m) => normalizeTime(m.slot_time || m.slotTime || m.time) === s,
            );
            const booked = bookingsState.find((b) => b.time === s);
            const available = availState.includes(s);
            return (
              <div key={s} className="">
                <button
                  type="button"
                  onClick={() => {
                    if (booked) {
                      setIsCancelling(booked.id);
                      removeBk(booked.id).finally(() => setIsCancelling(null));
                      return;
                    }
                    if (available) {
                      setSelectedSlot(s);
                      setShowStudentModal(true);
                    } else {
                      toggle(s);
                    }
                  }}
                  className={`w-full h-10 rounded-md text-sm ${booked ? "bg-destructive text-destructive-foreground" : available ? "bg-primary text-primary-foreground" : "bg-card text-foreground/80 border"}`}
                  title={
                    booked
                      ? `Tap to cancel booking for ${booked?.student_name || booked?.student_email || booked?.name || booked?.email || "student"}`
                      : available
                        ? "Available - tap to book"
                        : meta && meta.is_available === false
                          ? "Unavailable - tap to re-open"
                          : "Available - tap to add"
                  }
                >
                  <div className="flex items-center justify-center gap-2 w-full">
                    {booked && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setBookingDetail(booked);
                        }}
                        className="details-btn-responsive text-xs rounded-md border px-2 py-1"
                        title="View booking details"
                      >
                        <p>
                          Details<span className="ql-cursor">{'\uFEFF'}</span>
                        </p>
                      </span>
                    )}
                    <span>{isCancelling === (booked?.id || "") && booked ? "..." : s}</span>
                  </div>
                </button>
                {booked ? (
                  <div className="mt-1">
                    <button
                      type="button"
                      onClick={() => {
                            setCancellationBooking(booked);
                            setCancellationReason("");
                          }}
                      className="text-sm rounded-md border px-2 py-1"
                      disabled={isCancelling === booked.id}
                    >
                      {isCancelling === booked.id ? "Cancelling..." : "Unbook"}
                    </button>
                  </div>
                ) : (
                  available && (
                    <div className="mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSlot(s);
                          setShowStudentModal(true);
                        }}
                        className="text-sm rounded-md border px-2 py-1"
                      >
                        Add
                      </button>
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4">
        <h4 className="font-semibold">Bookings on {date}</h4>
        {bookingsState.length === 0 && (
          <div className="text-foreground/70">No bookings</div>
        )}
        {bookingsState.map((b) => (
          <div
            key={b.id}
            className="flex items-center justify-between gap-2 rounded-md border p-2 mt-2"
          >
            <div>
              <div className="font-medium">
                {b.time} — {b.student_name || b.name || "Student"}
              </div>
              <div className="text-sm text-foreground/70">
                {(b.student_email || b.email || "") &&
                  (b.student_email || b.email)}
                {b.phone ? ` • ${b.phone}` : ""}
                {b.lessonType ? ` • ${b.lessonType}` : ""}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => { setCancellationBooking(b); setCancellationReason(""); }}
                className="px-3 py-1 rounded-md border cancel-btn-responsive"
              >
                Cancel
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Booking details modal for guest bookings */}
      {bookingDetail && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-40"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setBookingDetail(null);
          }}
        >
          <div className="bg-card rounded-md p-4 w-full max-w-md">
            <div className="flex justify-between items-center">
              <h4 className="font-semibold">Booking details</h4>
              <button
                onClick={() => setBookingDetail(null)}
                className="px-2 py-1 border rounded-md"
              >
                Close
              </button>
            </div>
            <div className="mt-3 space-y-1 text-sm">
              <div>
                <span className="font-medium">Time:</span> {bookingDetail.time} on {date}
              </div>
              <div>
                <span className="font-medium">Name:</span> {bookingDetail.student_name || bookingDetail.name || "—"}
              </div>
              <div>
                <span className="font-medium">Email:</span> {bookingDetail.student_email || bookingDetail.email || "—"}
              </div>
              <div>
                <span className="font-medium">Phone:</span> {bookingDetail.phone || "—"}
              </div>
              <div>
                <span className="font-medium">Instrument:</span> {bookingDetail.lessonType || bookingDetail.lesson_type || "—"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation modal */}
      {cancellationBooking && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-40"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setCancellationBooking(null);
              setCancellationReason("");
            }
          }}
        >
          <div className="bg-card rounded-md p-4 w-full max-w-lg">
            <div className="flex justify-between items-center">
              <h4 className="font-semibold">Cancel booking for {cancellationBooking.time} on {date}</h4>
              <button
                onClick={() => {
                  setCancellationBooking(null);
                  setCancellationReason("");
                }}
                className="px-2 py-1 border rounded-md"
              >
                Close
              </button>
            </div>
            <div className="mt-3">
              <div className="text-sm mb-2">Choose a reason</div>
              <div className="space-y-2">
                {cancellationReasons.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setCancellationReason(r)}
                    className={`w-full text-left p-2 rounded-md border ${cancellationReason === r ? "bg-primary/10 border-primary" : ""}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <textarea
                  className="w-full border rounded-md p-2"
                  placeholder="Or write a custom reason"
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                />
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground"
                  onClick={async () => {
                    if (!cancellationBooking) return;
                    setIsCancelling(cancellationBooking.id);
                    try {
                      await removeBk(cancellationBooking.id, { reason: cancellationReason || null, notify: true });
                      setCancellationBooking(null);
                      setCancellationReason("");
                      setRefresh((r) => r + 1);
                    } catch (e) {
                      console.error(e);
                      alert("Failed to cancel booking");
                    } finally {
                      setIsCancelling(null);
                    }
                  }}
                >
                  Send cancellation & remove booking
                </button>
                <button
                  className="px-4 py-2 rounded-md border"
                  onClick={async () => {
                    if (!cancellationBooking) return;
                    setIsCancelling(cancellationBooking.id);
                    try {
                      await removeBk(cancellationBooking.id, { reason: null, notify: true });
                      setCancellationBooking(null);
                      setCancellationReason("");
                      setRefresh((r) => r + 1);
                    } catch (e) {
                      console.error(e);
                      alert("Failed to cancel booking");
                    } finally {
                      setIsCancelling(null);
                    }
                  }}
                >
                  Send notification without reason
                </button>
                <button
                  className="px-4 py-2 rounded-md border"
                  onClick={() => {
                    setCancellationBooking(null);
                    setCancellationReason("");
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Student selection modal */}
      {showStudentModal && selectedSlot && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-40"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowStudentModal(false);
              setSelectedSlot(null);
              setSelectedStudentId(null);
            }
          }}
        >
          <div className="bg-card rounded-md p-4 w-full max-w-lg">
            <div className="flex justify-between items-center">
              <h4 className="font-semibold">
                Select student for {selectedSlot} on {date}
              </h4>
              <button
                onClick={() => {
                  setShowStudentModal(false);
                  setSelectedSlot(null);
                  setSelectedStudentId(null);
                }}
                className="px-2 py-1 border rounded-md"
              >
                Close
              </button>
            </div>
            <div className="mt-3">
              <input
                name="studentSearch"
                placeholder="Search students"
                className="w-full h-10 rounded-md border px-3"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoComplete="off"
              />
              <div className="mt-3 max-h-64 overflow-auto space-y-2">
                {filteredStudents.length === 0 && (
                  <div className="text-foreground/70">No students found.</div>
                )}
                {filteredStudents.map((s) => {
                  const studentId = s.student_id || s.id;
                  const isSelected = selectedStudentId === studentId;
                  return (
                    <button
                      type="button"
                      key={studentId}
                      onClick={() => setSelectedStudentId(studentId)}
                      className={`w-full p-2 rounded-md border text-left flex items-center justify-between ${isSelected ? "bg-primary/10 border-primary" : ""}`}
                    >
                      <div>
                        <div className="font-medium">
                          {s.name || "Unnamed"} {s.age ? `• ${s.age}` : ""}
                        </div>
                        <div className="text-sm text-foreground/70">
                          {s.email} {s.phone && `• ${s.phone}`}
                        </div>
                      </div>
                      <div
                        className={`text-xs px-2 py-1 rounded-md ${isSelected ? "bg-primary text-primary-foreground" : "border"}`}
                      >
                        {isSelected ? "Selected" : "Tap"}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => {
                    createBookingForStudent();
                  }}
                  className="px-4 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-60"
                  disabled={!selectedStudentId}
                >
                  Create booking
                </button>
                <button
                  onClick={() => {
                    setShowStudentModal(false);
                    setSelectedSlot(null);
                    setSelectedStudentId(null);
                  }}
                  className="px-4 py-2 rounded-md border"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TeacherCard({
  t,
  onEdit,
  onRemove,
}: {
  t: Teacher;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="flex">
        <img
          src={
            t.image ||
            "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&q=60"
          }
          alt={t.name}
          className="w-28 h-28 object-cover"
        />
        <div className="p-3 flex-1">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-semibold">{t.name}</div>
              <div className="text-sm text-foreground/70">
                {t.years ? `${t.years} years experience` : "Experience: N/A"}
              </div>
              <div className="text-sm text-foreground/70">{t.email}</div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={onEdit}
                className="px-2 py-1 rounded-md border text-sm"
              >
                Edit
              </button>
              <button
                onClick={onRemove}
                className="px-2 py-1 rounded-md border text-sm"
              >
                Remove
              </button>
            </div>
          </div>
          <p className="mt-2 text-sm text-foreground/70">{t.about}</p>
          <div className="mt-2">
            <button
              onClick={() => setOpen((s) => !s)}
              className="text-sm text-primary underline"
            >
              {open ? "Hide profile" : "View full profile"}
            </button>
            {open && (
              <div className="mt-3 p-3 bg-muted rounded-md">
                <p className="text-sm">{t.about}</p>
                <p className="text-xs text-foreground/60 mt-2">
                  Contact: {t.email} {t.phone && `• ${t.phone}`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ThemeManager() {
  const presets: Record<
    string,
    { primary: string; brand1: string; brand2: string; secondary: string }
  > = {
    blue: {
      primary: "200 100% 41%",
      brand1: "200 100% 41%",
      brand2: "200 70% 71%",
      secondary: "200 70% 71%",
    },
    grey: {
      primary: "220 6% 20%",
      brand1: "220 6% 20%",
      brand2: "220 6% 35%",
      secondary: "220 6% 35%",
    },
    white: {
      primary: "0 0% 10%",
      brand1: "0 0% 10%",
      brand2: "0 0% 20%",
      secondary: "0 0% 20%",
    },
    purple: {
      primary: "270 80% 45%",
      brand1: "270 80% 45%",
      brand2: "265 60% 60%",
      secondary: "265 60% 60%",
    },
    yellow: {
      primary: "48 100% 50%",
      brand1: "48 100% 50%",
      brand2: "48 80% 70%",
      secondary: "48 80% 70%",
    },
  };

  const { mode, setMode, saveTheme, previewTheme, restoreTheme } = useTheme();

  const [preset, setPreset] = useState("blue");
  const [primary, setPrimary] = useState(presets.blue.primary);
  const [brand1, setBrand1] = useState(presets.blue.brand1);
  const [brand2, setBrand2] = useState(presets.blue.brand2);
  const [secondary, setSecondary] = useState(presets.blue.secondary);
  const [primaryColor, setPrimaryColor] = useState("#008CD2");
  const [brand1Color, setBrand1Color] = useState("#008CD2");
  const [brand2Color, setBrand2Color] = useState("#C8E7F6");
  const [secondaryColor, setSecondaryColor] = useState("#C8E7F6");
  const [showPreview, setShowPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<"light" | "dark">(() => {
    try {
      const v = localStorage.getItem("inTuneThemeMode");
      return v === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    const saved = localStorage.getItem("inTuneTheme");
    if (saved) {
      try {
        const t = JSON.parse(saved);
        setPrimary(t.primary || primary);
        setBrand1(t.brand1 || brand1);
        setBrand2(t.brand2 || brand2);
        setSecondary(t.secondary || secondary);
      } catch {}
    }
  }, []);

  const hexToHsl = (hex: string) => {
    // strip
    hex = hex.replace("#", "");
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    const r1 = r / 255,
      g1 = g / 255,
      b1 = b / 255;
    const max = Math.max(r1, g1, b1),
      min = Math.min(r1, g1, b1);
    let h = 0,
      s = 0,
      l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r1:
          h = (g1 - b1) / d + (g1 < b1 ? 6 : 0);
          break;
        case g1:
          h = (b1 - r1) / d + 2;
          break;
        case b1:
          h = (r1 - g1) / d + 4;
          break;
      }
      h = Math.round(h * 60);
    }
    s = Math.round(s * 100);
    l = Math.round(l * 100);
    return `${h} ${s}% ${l}%`;
  };

  useEffect(() => {
    if (presets[preset]) {
      setPrimary(presets[preset].primary);
      setBrand1(presets[preset].brand1);
      setBrand2(presets[preset].brand2);
      setSecondary(presets[preset].secondary);
    }
    // also update color inputs from HSL by setting defaults (best-effort)
  }, [preset]);

  const applyToRoot = (
    p1: string,
    p2: string,
    b1: string,
    b2: string,
    sec: string,
  ) => {
    const root = document.documentElement;
    root.style.setProperty("--primary", p1);
    root.style.setProperty("--brand-1", b1);
    root.style.setProperty("--brand-2", b2);
    root.style.setProperty("--secondary", sec);
    root.style.setProperty("--secondary-foreground", "220 12% 12%");
    root.style.setProperty("--ring", p1);
  };

  const preview = () => {
    const payload = { primary, brand1, brand2, secondary };
    previewTheme(payload);
    setShowPreview(true);
  };

  const confirm = () => {
    const payload = { primary, brand1, brand2, secondary };
    saveTheme(payload);
    setShowPreview(false);
    alert("Theme saved");
  };

  const cancelPreview = () => {
    restoreTheme();
    setShowPreview(false);
  };

  useEffect(() => {
    if (!showPreview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelPreview();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showPreview]);

  return (
    <div>
      <div className="grid gap-2">
        <label className="text-sm">Preset</label>
        <select
          className="h-10 rounded-md border px-3"
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
        >
          {Object.keys(presets).map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>

        <label className="text-sm">Primary color</label>
        <div className="flex gap-2 flex-wrap">
          <input
            type="color"
            className="h-10 w-12 rounded-md border"
            value={primaryColor}
            onChange={(e) => {
              setPrimaryColor(e.target.value);
              setPrimary(hexToHsl(e.target.value));
              setBrand1(hexToHsl(e.target.value));
              setBrand1Color(e.target.value);
            }}
          />
          <input
            className="h-10 rounded-md border px-3 flex-1"
            value={primary}
            onChange={(e) => setPrimary(e.target.value)}
          />
        </div>

        <label className="text-sm">Brand 1 color</label>
        <div className="flex gap-2 flex-wrap">
          <input
            type="color"
            className="h-10 w-12 rounded-md border"
            value={brand1Color}
            onChange={(e) => {
              setBrand1Color(e.target.value);
              setBrand1(hexToHsl(e.target.value));
            }}
          />
          <input
            className="h-10 rounded-md border px-3 flex-1"
            value={brand1}
            onChange={(e) => setBrand1(e.target.value)}
          />
        </div>

        <label className="text-sm">Brand 2 color</label>
        <div className="flex gap-2 flex-wrap">
          <input
            type="color"
            className="h-10 w-12 rounded-md border"
            value={brand2Color}
            onChange={(e) => {
              setBrand2Color(e.target.value);
              setBrand2(hexToHsl(e.target.value));
            }}
          />
          <input
            className="h-10 rounded-md border px-3 flex-1"
            value={brand2}
            onChange={(e) => setBrand2(e.target.value)}
          />
        </div>

        <label className="text-sm">Secondary color</label>
        <div className="flex gap-2 flex-wrap">
          <input
            type="color"
            className="h-10 w-12 rounded-md border"
            value={secondaryColor}
            onChange={(e) => {
              setSecondaryColor(e.target.value);
              setSecondary(hexToHsl(e.target.value));
            }}
          />
          <input
            className="h-10 rounded-md border px-3 flex-1"
            value={secondary}
            onChange={(e) => setSecondary(e.target.value)}
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={preview}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground"
          >
            Preview
          </button>
          <button onClick={confirm} className="px-4 py-2 rounded-md border">
            Save
          </button>
        </div>
      </div>

      {showPreview && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-40"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              cancelPreview();
            }
          }}
        >
          <div className="flex flex-col items-center gap-3">
            {/* top icon centered */}
            <div className="p-1 rounded-full bg-card border">
              <button
                onClick={() => {
                  setPreviewMode((m) => (m === "dark" ? "light" : "dark"));
                }}
                className="p-2 rounded-full"
              >
                {previewMode === "dark" ? (
                  <svg
                    className="w-5 h-5 text-foreground"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5 text-foreground"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M6.76 4.84l-1.8-1.79L3.17 4.84l1.79 1.79 1.8-1.79zM1 13h3v-2H1v2zm10 9h2v-3h-2v3zM6.76 19.16l1.79-1.79-1.79-1.79-1.8 1.79 1.8 1.79zM20 11v2h3v-2h-3zM17.24 19.16l1.8-1.79 1.79 1.79-1.79 1.79-1.8-1.79zM12 4a8 8 0 100 16 8 8 0 000-16z" />
                  </svg>
                )}
              </button>
            </div>

            <div className="bg-card rounded-md p-3 w-[380px] max-w-full">
              <ThemeHomePreview
                mode={previewMode}
                setMode={setPreviewMode}
                compact
              />
            </div>

            <div className="w-[380px] max-w-full flex items-center justify-between">
              <button
                onClick={() => {
                  cancelPreview();
                }}
                className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setMode(previewMode);
                  confirm();
                }}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportPanel() {
  const today = new Date().toISOString().slice(0, 10);
  const [studentsCount, setStudentsCount] = useState(0);
  const [bookingsToday, setBookingsToday] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function refreshCounts() {
      try {
        const s = await studentsAPI.list();
        if (!mounted) return;
        setStudentsCount(Array.isArray(s) ? s.length : 0);
        const b = await getBookings(new Date().toISOString().slice(0, 10));
        setBookingsToday(Array.isArray(b) ? b.length : 0);
      } catch (e) {
        console.error(e);
      }
    }
    refreshCounts();
    const id = setInterval(refreshCounts, 5000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

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

const RESOURCE_ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "zip",
  "doc",
  "docx",
  "txt",
  "rtf",
  "mp4",
  "mov",
  "avi",
  "mkv",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
]);

const RESOURCE_ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

const RESOURCE_ALLOWED_MIME_PREFIXES = ["video/"];

const resourceFileKey = (file: File) =>
  `${file.name}-${file.size}-${file.lastModified}`;

function isResourceFileAllowed(file: File) {
  if (RESOURCE_ALLOWED_MIME_TYPES.has(file.type)) return true;
  if (
    RESOURCE_ALLOWED_MIME_PREFIXES.some((prefix) =>
      file.type.startsWith(prefix),
    )
  )
    return true;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext ? RESOURCE_ALLOWED_EXTENSIONS.has(ext) : false;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [, base64] = result.split(",");
      resolve(base64 || result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function StudentsManager() {
  const { toast } = useToast();
  const instrumentsList = [
    "Guitar",
    "Piano",
    "Violin",
    "Drums",
    "Bass",
    "Saxophone",
    "Voice",
    "Ukulele",
    "Flute",
  ];
  const [students, setStudents] = useState<any[]>([]);
  const [form, setForm] = useState<Partial<any>>({
    name: "",
    age: 16,
    isElderly: false,
    medications: "",
    marketingConsent: false,
    allergies: "",
    instruments: [],
    bandName: "",
    email: "",
    phone: "",
    address: "",
    emergencyContacts: "",
    parentGuardianName: "",
    parentGuardianEmail: "",
    parentGuardianPhone: "",
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [selectedInstrument, setSelectedInstrument] = useState(
    instrumentsList[0],
  );
  const [passwordLoading, setPasswordLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [resourceFiles, setResourceFiles] = useState<File[]>([]);
  const [resourceStudentId, setResourceStudentId] = useState<string>("");
  const [resourceFolderName, setResourceFolderName] = useState<string>("");
  const resourceInputRef = useRef<HTMLInputElement | null>(null);
  const [resourceUploading, setResourceUploading] = useState(false);
  const [expandedStudentIds, setExpandedStudentIds] = useState<
    Record<string, boolean>
  >({});

  // View resources modal state
  const [viewResourcesOpen, setViewResourcesOpen] = useState(false);
  const [viewResourcesStudentId, setViewResourcesStudentId] = useState<
    string | null
  >(null);
  const [viewResourcesData, setViewResourcesData] = useState<any[]>([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewActionLoading, setViewActionLoading] = useState(false);
  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return students;
    return students.filter((s) => {
      const stringValues: string[] = [];
      const addIfString = (value: unknown) => {
        if (typeof value === "string" && value.trim().length > 0) {
          stringValues.push(value.toLowerCase());
        }
      };
      addIfString(s.name);
      addIfString(s.email);
      addIfString(s.phone);
      addIfString(s.address);
      addIfString(s.bandName);
      addIfString(s.parentGuardianName);
      addIfString(s.parentGuardianEmail);
      addIfString(s.parentGuardianPhone);
      addIfString(s.parent_name);
      addIfString(s.parent_email);
      addIfString(String(s.age ?? ""));
      if (Array.isArray(s.instruments)) {
        (s.instruments as string[]).forEach(addIfString);
      }
      return stringValues.some((value) => value.includes(query));
    });
  }, [students, searchQuery]);
  const hasSearch = searchQuery.trim().length > 0;

  const studentOptions = useMemo(
    () =>
      students
        .map((s) => {
          const value = s.student_id || s.id || "";
          if (!value) return null;
          return {
            value,
            label: s.name || s.email || value,
          };
        })
        .filter(
          (option): option is { value: string; label: string } =>
            option !== null,
        ),
    [students],
  );

  useEffect(() => {
    if (!resourceModalOpen || studentOptions.length === 0) return;
    setResourceStudentId((current) => {
      if (
        current &&
        studentOptions.some((option) => option.value === current)
      ) {
        return current;
      }
      return studentOptions[0].value;
    });
    // default folder name when opening modal
    setResourceFolderName(() => {
      const d = new Date();
      const datePart = d.toISOString().slice(0, 10);
      return `${datePart} - `;
    });
  }, [resourceModalOpen, studentOptions]);

  const clearResourceSelection = useCallback(() => {
    setResourceFiles([]);
    setResourceFolderName("");
    if (resourceInputRef.current) {
      resourceInputRef.current.value = "";
    }
  }, [resourceInputRef]);

  const openResourceModal = useCallback(() => {
    if (!students.length) {
      toast({
        title: "No students available",
        description: "Add a student before uploading resources.",
        variant: "destructive",
      });
      return;
    }
    clearResourceSelection();
    setResourceModalOpen(true);
  }, [students, toast, clearResourceSelection]);

  const closeResourceModal = useCallback(() => {
    if (resourceUploading) return;
    clearResourceSelection();
    setResourceModalOpen(false);
  }, [clearResourceSelection, resourceUploading]);

  const addResourceFiles = useCallback(
    (incoming: FileList | File[]) => {
      if (!incoming) return;
      const list = Array.isArray(incoming)
        ? [...incoming]
        : Array.from(incoming);
      if (!list.length) return;
      const accepted: File[] = [];
      const rejected: string[] = [];
      list.forEach((file) => {
        if (isResourceFileAllowed(file)) {
          accepted.push(file);
        } else {
          rejected.push(file.name);
        }
      });
      if (rejected.length) {
        toast({
          title: "Unsupported files skipped",
          description: rejected.join(", "),
          variant: "destructive",
        });
      }
      if (accepted.length) {
        setResourceFiles((prev) => {
          const map = new Map(
            prev.map((file) => [resourceFileKey(file), file]),
          );
          accepted.forEach((file) => {
            map.set(resourceFileKey(file), file);
          });
          return Array.from(map.values());
        });
      }
    },
    [toast],
  );

  const handleResourceDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (event.dataTransfer?.files?.length) {
        addResourceFiles(event.dataTransfer.files);
      }
    },
    [addResourceFiles],
  );

  const handleResourceSelect = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (event.target.files?.length) {
        addResourceFiles(event.target.files);
      }
      if (resourceInputRef.current) {
        resourceInputRef.current.value = "";
      }
    },
    [addResourceFiles],
  );

  const removeResourceFile = useCallback((key: string) => {
    setResourceFiles((prev) =>
      prev.filter((file) => resourceFileKey(file) !== key),
    );
  }, []);

  const uploadSelectedResources = useCallback(async () => {
    if (!resourceStudentId) {
      toast({
        title: "Select a student",
        description: "Choose who should receive the resources.",
        variant: "destructive",
      });
      return;
    }
    if (resourceFiles.length === 0) {
      toast({
        title: "Add files",
        description: "Drag and drop or select files to share.",
        variant: "destructive",
      });
      return;
    }
    try {
      setResourceUploading(true);
      const { apiFetch } = await import("@/lib/api");
      const uploaded: { id: string; url: string; mime: string }[] = [];
      for (const file of resourceFiles) {
        const base64 = await fileToBase64(file);
        const uploadResponse = await apiFetch("/api/admin/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, data: base64 }),
        });
        if (!uploadResponse || typeof uploadResponse !== "object") {
          throw new Error("Upload failed");
        }
        uploaded.push({
          id: (uploadResponse as any).id,
          url: (uploadResponse as any).url,
          mime: file.type || "application/octet-stream",
        });
      }
      await apiFetch(`/api/admin/learning/${resourceStudentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:
            resourceFolderName && resourceFolderName.trim()
              ? resourceFolderName.trim()
              : "Learning resources",
          description: "",
          media: uploaded,
        }),
      });
      toast({
        title: "Resources uploaded",
        description: `${resourceFiles.length} file${
          resourceFiles.length > 1 ? "s" : ""
        } shared with the student.`,
      });
      clearResourceSelection();
      setResourceModalOpen(false);
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error?.message || "Unable to upload resources.",
        variant: "destructive",
      });
    } finally {
      setResourceUploading(false);
    }
  }, [resourceFiles, resourceStudentId, toast, clearResourceSelection]);

  const resourceModal = resourceModalOpen ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeResourceModal();
        }
      }}
    >
      <div
        className="w-full max-w-2xl rounded-lg bg-card p-6 shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Upload learning resources</h3>
            <p className="text-sm text-foreground/70">
              Drag and drop or select files to share with a student.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={closeResourceModal}
            disabled={resourceUploading}
          >
            Close
          </Button>
        </div>
        <div className="mt-4 grid gap-3">
          <div>
            <label
              htmlFor="resourceFolder"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Folder name
            </label>
            <input
              id="resourceFolder"
              className="h-10 w-full rounded-md border px-3"
              value={resourceFolderName}
              onChange={(e) => setResourceFolderName(e.target.value)}
              placeholder="e.g. 2025-01-01 - Week 1 materials"
              disabled={resourceUploading}
            />
          </div>
          <div>
            <label
              htmlFor="resourceStudent"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Student
            </label>
            <select
              id="resourceStudent"
              className="h-10 w-full rounded-md border px-3"
              value={resourceStudentId}
              onChange={(event) => setResourceStudentId(event.target.value)}
              disabled={studentOptions.length === 0 || resourceUploading}
            >
              {studentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div
              onDrop={handleResourceDrop}
              onDragOver={(event) => event.preventDefault()}
              className="flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-muted-foreground/40 bg-muted/20 p-6 text-center text-sm"
            >
              <p className="font-medium">Drop files here</p>
              <p className="text-xs text-foreground/70">
                Accepted: pdf, zip, doc, docx, txt, rtf, video formats and more
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => resourceInputRef.current?.click()}
                disabled={resourceUploading}
              >
                Select files
              </Button>
            </div>
            <input
              ref={resourceInputRef}
              type="file"
              multiple
              accept="application/pdf,application/zip,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,video/*,.doc,.docx,.pdf,.zip,.txt,.rtf,.ppt,.pptx,.xls,.xlsx,.mp4,.mov,.avi,.mkv"
              className="hidden"
              onChange={handleResourceSelect}
            />
          </div>
          {resourceFiles.length > 0 ? (
            <ul className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
              {resourceFiles.map((file) => {
                const key = resourceFileKey(file);
                const sizeInMb = file.size / (1024 * 1024);
                const sizeLabel =
                  sizeInMb >= 1
                    ? `${sizeInMb.toFixed(1)} MB`
                    : `${Math.max(1, Math.round(file.size / 1024))} KB`;
                return (
                  <li
                    key={key}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="flex-1 truncate">{file.name}</span>
                    <span className="text-xs text-foreground/70">
                      {sizeLabel}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeResourceFile(key)}
                      disabled={resourceUploading}
                    >
                      Remove
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-md border border-dashed p-4 text-xs text-foreground/60">
              No files selected yet.
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={clearResourceSelection}
              disabled={resourceFiles.length === 0 || resourceUploading}
              className="w-full sm:w-auto"
            >
              Clear files
            </Button>
            <Button
              type="button"
              onClick={uploadSelectedResources}
              disabled={resourceUploading}
              className="w-full sm:w-auto"
            >
              {resourceUploading ? "Uploading..." : "Share resources"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const viewResourcesModal = viewResourcesOpen ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setViewResourcesOpen(false);
      }}
    >
      <div
        className="w-full max-w-3xl rounded-lg bg-card p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">View resources</h3>
            <p className="text-sm text-foreground/70">
              Resources shared with the selected student. You may remove items
              if needed.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setViewResourcesOpen(false)}
              disabled={viewActionLoading}
            >
              Close
            </Button>
          </div>
        </div>
        <div className="mt-4">
          {viewLoading ? (
            <div className="text-sm text-foreground/70">Loading…</div>
          ) : viewResourcesData.length === 0 ? (
            <div className="rounded border border-dashed p-4 text-sm text-foreground/70">
              No resources found for this student.
            </div>
          ) : (
            <div className="space-y-3">
              {viewResourcesData.map((entry: any) => (
                <div key={entry.id} className="rounded border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">
                        {entry.title || "Resource"}
                      </div>
                      <div className="text-xs text-foreground/70">
                        {entry.created_at
                          ? new Date(entry.created_at).toLocaleString()
                          : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={async () => {
                          // delete whole entry
                          if (
                            !confirm(
                              "Delete this resource folder and all its files?",
                            )
                          )
                            return;
                          try {
                            setViewActionLoading(true);
                            const { apiFetch } = await import("@/lib/api");
                            await apiFetch(
                              `/api/admin/learning/entry/${entry.id}`,
                              { method: "DELETE" },
                            );
                            // refresh list
                            const data = await apiFetch(
                              `/api/admin/learning/${viewResourcesStudentId}`,
                            );
                            setViewResourcesData(
                              Array.isArray(data)
                                ? data
                                : (data && (data as any).rows) || [],
                            );
                          } catch (err) {
                            console.error(err);
                            toast({
                              title: "Failed to delete folder",
                              variant: "destructive",
                            });
                          } finally {
                            setViewActionLoading(false);
                          }
                        }}
                      >
                        Delete folder
                      </Button>
                    </div>
                  </div>
                  {Array.isArray(entry.media) && entry.media.length > 0 && (
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {entry.media.map((m: any) => (
                        <div
                          key={m.id || m.url}
                          className="flex items-center justify-between gap-2 rounded border p-2"
                        >
                          <div className="flex items-center gap-3">
                            {m.mime?.startsWith("image") ? (
                              <img
                                src={m.url}
                                alt=""
                                className="h-16 w-24 object-cover rounded"
                              />
                            ) : m.mime?.startsWith("video") ? (
                              <video
                                src={m.url}
                                className="h-16 w-24 object-cover"
                              />
                            ) : (
                              <a
                                href={m.url}
                                target="_blank"
                                rel="noreferrer"
                                className="underline"
                              >
                                Open file
                              </a>
                            )}
                            <div className="text-sm">
                              {m.url.split("/").pop()}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(m.url, "_blank")}
                            >
                              Open
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={async () => {
                                if (
                                  !confirm(
                                    "Remove this file from the resource folder?",
                                  )
                                )
                                  return;
                                try {
                                  setViewActionLoading(true);
                                  const { apiFetch } = await import(
                                    "@/lib/api"
                                  );
                                  const data = await apiFetch(
                                    `/api/admin/learning/entry/${entry.id}/media/${m.id}`,
                                    { method: "DELETE" },
                                  );
                                  setViewResourcesData(
                                    Array.isArray(data)
                                      ? data
                                      : (data && (data as any).rows) || [],
                                  );
                                } catch (err) {
                                  console.error(err);
                                  toast({
                                    title: "Failed to remove file",
                                    variant: "destructive",
                                  });
                                } finally {
                                  setViewActionLoading(false);
                                }
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null;

  const toggleStudentDetails = (id: string | undefined | null) => {
    if (!id) return;
    setExpandedStudentIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const refresh = async () => {
    try {
      const s = await studentsAPI.list();
      setStudents(Array.isArray(s) ? s : []);
    } catch (e) {
      console.error(e);
      setStudents([]);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const save = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const trimmedName = form.name?.trim();
    if (!trimmedName) {
      alert("Name is required");
      return;
    }

    const normalizedAge =
      typeof form.age === "number" && !Number.isNaN(form.age) ? form.age : null;

    const emergencyContact = form.emergencyContacts?.trim() || "";
    if (!emergencyContact) {
      alert("Emergency contact is required");
      return;
    }

    const guardianName = form.parentGuardianName?.trim() || "";
    const guardianPhone = form.parentGuardianPhone?.trim() || "";
    const guardianEmail = form.parentGuardianEmail?.trim() || "";
    const studentEmail = form.email?.trim() || "";

    if (isUnder16) {
      if (!guardianName || !guardianPhone || !guardianEmail) {
        alert(
          "Parent or guardian name, phone and email are required for students under 16",
        );
        return;
      }
    }

    const contactEmail = isUnder16 ? guardianEmail : studentEmail;
    if (!contactEmail) {
      alert(
        isUnder16
          ? "Parent or guardian email is required for students under 16"
          : "Email is required",
      );
      return;
    }

    const studentPhone = form.phone?.trim() || "";
    const primaryPhone =
      (isUnder16 ? guardianPhone : studentPhone) ||
      studentPhone ||
      guardianPhone ||
      "";

    const payload: any = {
      name: trimmedName,
      age: normalizedAge,
      parent_name: isUnder16 ? guardianName : null,
      parent_email: isUnder16 ? guardianEmail : null,
      parent_phone: isUnder16 ? guardianPhone : null,
      phone: primaryPhone || null,
      address: form.address?.trim() || null,
      marketing_consent: !!form.marketingConsent,
      email: contactEmail,
      emergency_contacts: emergencyContact,
    };
    try {
      if (editing) {
        await studentsAPI.update(editing, payload);
      } else {
        await studentsAPI.create({ ...payload, tempPassword: payload.email });
      }
      setForm({
        name: "",
        age: 16,
        isElderly: false,
        medications: "",
        marketingConsent: false,
        allergies: "",
        instruments: [],
        bandName: "",
        email: "",
        phone: "",
        address: "",
        emergencyContacts: "",
        parentGuardianName: "",
        parentGuardianEmail: "",
        parentGuardianPhone: "",
      });
      setEditing(null);
      await refresh();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Unable to save student");
    }
  };

  const edit = (s: any) => {
    const studentId = s.student_id || s.id;
    if (!studentId) return;
    const minor = typeof s.age === "number" && s.age < 16;
    setEditing(studentId);
    setForm({
      name: s.name || "",
      age: typeof s.age === "number" ? s.age : 16,
      isElderly: !!s.isElderly,
      medications: s.medications || "",
      marketingConsent: !!(s.marketing_consent ?? s.marketingConsent),
      allergies: s.allergies || "",
      instruments: s.instruments || [],
      bandName: s.bandName || "",
      email: s.email || "",
      phone: minor ? "" : s.phone || "",
      address: s.address || "",
      emergencyContacts:
        s.emergency_contacts ||
        s.emergencyContacts ||
        s.emergency_contact ||
        "",
      parentGuardianName: s.parent_name || "",
      parentGuardianEmail: s.parent_email || "",
      parentGuardianPhone: minor
        ? s.phone || ""
        : s.parentGuardianPhone || s.parent_phone || "",
    });
  };
  const remove = async (id?: string) => {
    if (!id) return;
    try {
      await studentsAPI.remove(id);
      await refresh();
      toast({ title: "Removed", description: "Student deleted" });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Unable to remove student" });
    }
  };

  const setPasswordForUser = async (
    userId: string | undefined,
    password: string,
    message?: string,
  ) => {
    if (!userId) {
      toast({ title: "Error", description: "Missing user id" });
      return;
    }
    setPasswordLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || body.message || "Failed to set password");
      }
      toast({
        title: "Password updated",
        description: message || "New password applied",
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Error",
        description: err?.message || "Unable to set password",
      });
    } finally {
      setPasswordLoading(null);
    }
  };

  const sendReset = async (
    userId: string | undefined,
    email: string | undefined,
  ) => {
    if (!email) {
      toast({ title: "Error", description: "Missing email" });
      return;
    }
    const loadingKey = userId || email;
    if (!loadingKey) {
      toast({ title: "Error", description: "Missing user id" });
      return;
    }
    setPasswordLoading(loadingKey);
    try {
      const res = await fetch(`/api/auth/send-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.error || body.message || "Failed to send reset email",
        );
      }
      toast({
        title: "Reset sent",
        description: `Email sent to ${email}`,
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Error",
        description: err?.message || "Unable to send reset email",
      });
    } finally {
      setPasswordLoading(null);
    }
  };

  const addInstrument = () => {
    const cur = form.instruments || [];
    if (cur.length >= 3) return alert("Max 3 instruments");
    if (cur.includes(selectedInstrument)) return;
    setForm((f) => ({
      ...f,
      instruments: [...(f.instruments || []), selectedInstrument],
    }));
  };
  const removeInstrument = (ins: string) =>
    setForm((f) => ({
      ...f,
      instruments: (f.instruments || []).filter((i: any) => i !== ins),
    }));

  const isUnder16 = form.age !== undefined && form.age < 16;
  const isElderly =
    form.isElderly || (form.age !== undefined && form.age >= 65);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-start" />
      {resourceModal}
      {viewResourcesModal}
      <form onSubmit={save} className="grid gap-2">
        <input
          className="h-10 rounded-md border px-3"
          placeholder="Name"
          value={form.name || ""}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <div className="flex gap-2 flex-wrap">
          <input
            type="number"
            className="h-10 rounded-md border px-3 flex-1"
            placeholder="Age"
            value={form.age === undefined ? "" : String(form.age)}
            onChange={(e) =>
              setForm((f) => ({ ...f, age: parseInt(e.target.value || "0") }))
            }
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!form.isElderly}
              onChange={(e) =>
                setForm((f) => ({ ...f, isElderly: e.target.checked }))
              }
            />{" "}
            Elderly
          </label>
        </div>

        <input
          className="h-10 rounded-md border px-3"
          placeholder="Emergency contact (required)"
          value={form.emergencyContacts || ""}
          onChange={(e) =>
            setForm((f) => ({ ...f, emergencyContacts: e.target.value }))
          }
        />
        <input
          className="h-10 rounded-md border px-3"
          placeholder="Address (optional)"
          value={form.address || ""}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
        />

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!form.marketingConsent}
            onChange={(e) =>
              setForm((f) => ({ ...f, marketingConsent: e.target.checked }))
            }
          />
          <span className="text-sm">Marketing consent</span>
        </label>

        <label className="text-sm">
          Allergies or similar issues (optional)
        </label>
        <textarea
          className="rounded-md border px-3 py-2"
          placeholder="Allergies, intolerances or other relevant details"
          value={form.allergies || ""}
          onChange={(e) =>
            setForm((f) => ({ ...f, allergies: e.target.value }))
          }
        />

        <label className="text-sm">Instrument(s) (max 3)</label>
        <div className="flex gap-2 flex-wrap">
          <select
            className="h-10 rounded-md border px-3 flex-1"
            value={selectedInstrument}
            onChange={(e) => setSelectedInstrument(e.target.value)}
          >
            {instrumentsList.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addInstrument}
            className="px-3 py-2 rounded-md border"
          >
            Add instrument
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(form.instruments || []).map((ins: any) => (
            <div
              key={ins}
              className="px-2 py-1 rounded-md border flex items-center gap-2"
            >
              <div>{ins}</div>
              <button
                type="button"
                onClick={() => removeInstrument(ins)}
                className="px-2 py-1 rounded-md border"
              >
                x
              </button>
            </div>
          ))}
        </div>

        <input
          className="h-10 rounded-md border px-3"
          placeholder="Band name (optional)"
          value={form.bandName || ""}
          onChange={(e) => setForm((f) => ({ ...f, bandName: e.target.value }))}
        />

        {isUnder16 ? (
          <>
            <input
              className="h-10 rounded-md border px-3"
              placeholder="Parent/Guardian name"
              value={form.parentGuardianName || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, parentGuardianName: e.target.value }))
              }
            />
            <input
              className="h-10 rounded-md border px-3"
              placeholder="Parent/Guardian phone"
              value={form.parentGuardianPhone || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, parentGuardianPhone: e.target.value }))
              }
            />
            <input
              className="h-10 rounded-md border px-3"
              placeholder="Parent/Guardian email"
              value={form.parentGuardianEmail || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, parentGuardianEmail: e.target.value }))
              }
            />
          </>
        ) : (
          <>
            <input
              className="h-10 rounded-md border px-3"
              placeholder="Phone (optional)"
              value={form.phone || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
            />
            <input
              className="h-10 rounded-md border px-3"
              placeholder="Email"
              value={form.email || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
            />
          </>
        )}

        {isElderly && (
          <>
            <label className="text-sm">
              Medications / medical info (optional)
            </label>
            <textarea
              className="rounded-md border px-3 py-2"
              placeholder="Any medications or important medical information"
              value={form.medications || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, medications: e.target.value }))
              }
            />
          </>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" className="w-full sm:w-auto">
            {editing ? "Save" : "Add"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => {
              setForm({
                name: "",
                age: 16,
                isElderly: false,
                medications: "",
                marketingConsent: false,
                allergies: "",
                instruments: [],
                bandName: "",
                email: "",
                phone: "",
                address: "",
                emergencyContacts: "",
                parentGuardianName: "",
                parentGuardianEmail: "",
                parentGuardianPhone: "",
              });
              setEditing(null);
            }}
          >
            Clear
          </Button>
        </div>
      </form>

      <div className="mt-4">
        <label
          htmlFor="studentSearch"
          className="mb-1 block text-sm font-medium text-foreground/80"
        >
          Search students
        </label>
        <input
          id="studentSearch"
          type="search"
          placeholder="Search by name, email, instrument..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-10 w-full rounded-md border px-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="mt-4 grid gap-2">
        {students.length === 0 && (
          <div className="text-foreground/70">No students yet.</div>
        )}
        {students.length > 0 && filteredStudents.length === 0 && hasSearch && (
          <div className="rounded-md border border-dashed p-4 text-sm text-foreground/70">
            No students match &quot;{searchQuery.trim()}&quot;.
          </div>
        )}
        {filteredStudents.map((s) => {
          const studentId = s.student_id || s.id;
          const userId = s.user_id || s.userId || s.id;
          const recordKey = studentId || userId;
          const email = s.email;
          const isExpanded = !!(recordKey && expandedStudentIds[recordKey]);
          return (
            <div
              key={recordKey}
              className="flex flex-col gap-3 rounded-md border p-3"
            >
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => toggleStudentDetails(recordKey)}
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <span className="font-medium">
                    {s.name}
                    {s.age ? ` • ${s.age}` : ""}
                    {s.isElderly ? " ���� Elderly" : ""}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div className="text-sm text-foreground/70">
                  {s.email || "No email"}
                  {s.phone ? ` • ${s.phone}` : ""}
                </div>
              </div>

              {isExpanded && (
                <dl className="grid gap-2 rounded-md bg-muted/40 p-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-foreground/80">Address</dt>
                    <dd>{s.address || "—"}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground/80">
                      Marketing consent
                    </dt>
                    <dd>
                      {s.marketing_consent || s.marketingConsent ? "Yes" : "No"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground/80">
                      Guardian name
                    </dt>
                    <dd>{s.parent_name || s.parentGuardianName || "��"}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground/80">
                      Guardian email
                    </dt>
                    <dd>{s.parent_email || s.parentGuardianEmail || "—"}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground/80">Created</dt>
                    <dd>{formatDateTime(s.created_at)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground/80">
                      Last updated
                    </dt>
                    <dd>{formatDateTime(s.updated_at)}</dd>
                  </div>
                </dl>
              )}

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
                <Button
                  type="button"
                  onClick={() => edit(s)}
                  variant="outline"
                  size="sm"
                  className="w-full whitespace-normal sm:w-auto"
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  onClick={() => remove(studentId)}
                  variant="destructive"
                  size="sm"
                  className="w-full whitespace-normal sm:w-auto"
                >
                  Remove
                </Button>
                <Button
                  type="button"
                  onClick={() =>
                    setPasswordForUser(
                      userId,
                      randomPassword(),
                      "Random password applied",
                    )
                  }
                  variant="secondary"
                  size="sm"
                  className="w-full whitespace-normal sm:w-auto"
                  disabled={passwordLoading === userId}
                >
                  {passwordLoading === userId
                    ? "Working..."
                    : "Randomize password"}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    const pw = window.prompt("Enter new password", "");
                    if (pw) setPasswordForUser(userId, pw, "Password updated");
                  }}
                  variant="outline"
                  size="sm"
                  className="w-full whitespace-normal sm:w-auto"
                  disabled={passwordLoading === userId}
                >
                  Set password
                </Button>
                <Button
                  type="button"
                  onClick={() => sendReset(userId, email)}
                  variant="secondary"
                  size="sm"
                  className="w-full whitespace-normal sm:w-auto"
                  disabled={passwordLoading === (userId || email)}
                >
                  {passwordLoading === (userId || email)
                    ? "Sending..."
                    : "Send reset"}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    // open the existing resource modal for this specific student
                    setResourceStudentId(studentId || "");
                    setResourceModalOpen(true);
                  }}
                  variant="outline"
                  size="sm"
                  className="w-full whitespace-normal sm:w-auto"
                >
                  Upload material
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    const id = studentId || "";
                    setViewResourcesStudentId(id);
                    setViewResourcesOpen(true);
                    setViewLoading(true);
                    try {
                      const { apiFetch } = await import("@/lib/api");
                      const data = await apiFetch(`/api/admin/learning/${id}`);
                      setViewResourcesData(
                        Array.isArray(data)
                          ? data
                          : (data && (data as any).rows) || [],
                      );
                    } catch (e) {
                      console.error(e);
                      toast({
                        title: "Failed to load resources",
                        variant: "destructive",
                      });
                    } finally {
                      setViewLoading(false);
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className="w-full whitespace-normal sm:w-auto"
                >
                  View resources
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

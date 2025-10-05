import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Teachers() {
  const [teachers, setTeachers] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/teachers');
        if (!res.ok) return;
        const data = await res.json();
        setTeachers(data);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  return (
    <div className="container mx-auto py-20">
      <h1 className="text-3xl font-bold">Teachers</h1>
      <p className="mt-2 text-foreground/70 max-w-2xl">
        Meet our friendly, certified instructors. Below are profiles added by the admin.
      </p>

      <div className="mt-8 grid sm:grid-cols-2 gap-6">
        {teachers.length === 0 && (
          <div className="text-foreground/70">No teachers listed yet. Please ask the site admin to add profiles.</div>
        )}
        {teachers.map((t: any) => (
          <div key={t.user_id} className="rounded-lg border overflow-hidden flex">
            <img src={t.image || 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&q=60'} alt={t.name} className="w-28 h-28 object-cover" />
            <div className="p-3 flex-1">
              <div className="font-semibold">{t.name}</div>
              <div className="text-sm text-foreground/70">{t.years ? `${t.years} years experience` : 'Experience: N/A'}</div>
              <div className="text-sm text-foreground/70">{t.email}</div>
              <div className="text-sm text-foreground/70">{t.phone}</div>
              <p className="mt-2 text-sm text-foreground/70">{t.about}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Link to="/"><Button variant="gradient">Back to home</Button></Link>
      </div>
    </div>
  );
}

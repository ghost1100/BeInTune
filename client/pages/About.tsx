import { getSiteContent } from "@/lib/siteContent";

export default function About() {
  const content = getSiteContent();
  return (
    <div className="container mx-auto py-20">
      <h1 className="text-3xl font-bold">About {content.siteTitle}</h1>
      <p className="mt-4 text-foreground/70 max-w-3xl" dangerouslySetInnerHTML={{ __html: content.aboutHtml }} />

      <section className="mt-8">
        <h2 className="text-2xl font-semibold">Our approach</h2>
        <p className="mt-2 text-foreground/70 max-w-3xl">
          We focus on building confidence, musicality and practical skills. Lessons are tailored to each student's goals — whether that's learning favourite songs, preparing for exams, or developing performance skills. We also run regular recitals and seasonal masterclasses.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-semibold">Qualifications & Safeguarding</h2>
        <ul className="mt-2 list-disc list-inside text-foreground/70">
          <li>BA Popular Music with Honours</li>
          <li>Full Enhanced Disclosure Scotland and PVG certificate</li>
          <li>Experienced in teaching children and adults</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-semibold">What we offer</h2>
        <ul className="mt-2 list-disc list-inside text-foreground/70 max-w-3xl">
          <li>1-to-1 instrumental and vocal lessons (Guitar, Piano, Drums, Bass, Ukulele, Violin)</li>
          <li>Group classes and weekly Bandjam sessions</li>
          <li>Online lessons via Skype/Zoom for remote students</li>
          <li>Performance opportunities, exam preparation and songwriting workshops</li>
          <li>Flexible scheduling including evenings and weekends</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-semibold">Contact & Location</h2>
        <p className="mt-2 text-foreground/70 max-w-3xl">
          {content.address}. Email <a href={`mailto:${content.email}`} className="text-primary hover:underline">{content.email}</a> or call <a href={`tel:${content.phone}`} className="text-primary hover:underline">{content.phone}</a>.
        </p>
      </section>
    </div>
  );
}

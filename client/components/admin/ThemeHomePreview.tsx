import { Button } from "@/components/ui/button";
import { getSiteContent } from "@/lib/siteContent";
import { Sun, Moon } from "lucide-react";
import { useState } from "react";

export default function ThemeHomePreview({ mode, setMode }:{ mode: 'light'|'dark', setMode: (m:'light'|'dark')=>void }) {
  const content = getSiteContent();
  const wrapperClass = mode === 'dark' ? 'dark' : '';

  return (
    <div className={`min-h-[50vh] rounded-lg overflow-hidden border bg-card ${wrapperClass}`}>
      <div className="p-3 flex items-center justify-end gap-2">
        <button onClick={()=>setMode(mode==='dark'?'light':'dark')} className="p-2 rounded-md border bg-background">
          {mode === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </div>

      {/* Header */}
      <header className="px-6 py-3 border-b bg-card flex items-center justify-between">
        <div className="font-bold text-lg">{content.siteTitle}</div>
        <nav className="hidden sm:flex gap-3 text-sm text-foreground/80">
          <span>Lessons</span>
          <span>About</span>
          <span>Contact</span>
        </nav>
        <div className="flex gap-2">
          <Button size="sm" variant="outline">Book</Button>
          <Button size="sm" variant="default">Call</Button>
        </div>
      </header>

      {/* Hero */}
      <section className="hero-bg py-12">
        <div className="container mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 text-white max-w-2xl" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
            <div className="inline-flex items-center gap-3 rounded-full bg-white/10 px-3 py-1 text-sm">
              West Lothian’s award-winning tuition
            </div>
            <h1 className="mt-6 text-2xl md:text-3xl font-extrabold leading-tight">
              {content.heroHeading}
            </h1>
            <p className="mt-4 text-base text-white/90">
              {content.heroSubheading}
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Button size="lg" variant="gradient">{content.ctaPrimary}</Button>
              <Button size="lg" variant="outline">{content.ctaSecondary}</Button>
            </div>
          </div>
          <aside className="lg:col-span-5">
            <div className="bg-card rounded-xl p-4 shadow-lg max-w-md mx-auto">
              <h3 className="text-lg font-semibold">Book a free trial</h3>
              <p className="text-sm text-foreground/70 mt-1">No commitment — try a 30 minute lesson.</p>
              <div className="mt-3 grid gap-2">
                <input className="h-10 rounded-md border px-3" placeholder="Name" />
                <input className="h-10 rounded-md border px-3" placeholder="Email" />
                <Button>Request</Button>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* Programs grid */}
      <section className="container mx-auto py-6">
        <div className="p-4 bg-muted rounded-lg">
          <h2 className="text-xl font-bold text-foreground">Programs</h2>
          <p className="mt-2 text-foreground/70 max-w-2xl">{content.programsIntro}</p>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { title: 'Guitar', img: 'https://static.wixstatic.com/media/11062b_5a22f499b68b4cb4bd26d6c7b59b005f~mv2.jpg' },
              { title: 'Singing', img: 'https://static.wixstatic.com/media/7bc411_238d51c0e12341719cb19ee6ed9c56a5~mv2.jpeg' },
              { title: 'Piano', img: 'https://static.wixstatic.com/media/11062b_d1a6434bf6ad4d508d7c3e0d5a5c4e95~mv2.jpg' },
              { title: 'Drums', img: 'https://static.wixstatic.com/media/69c603f0e05a4d418583af8038a8d082.jpg' },
            ].map((p) => (
              <div key={p.title} className="rounded-lg overflow-hidden border bg-card shadow-sm">
                <img src={p.img} alt={p.title} className="h-20 w-full object-cover" />
                <div className="p-2 bg-card">
                  <h3 className="font-semibold text-foreground">{p.title}</h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-3 border-t bg-card text-sm text-foreground/70">
        <div className="container mx-auto">© {new Date().getFullYear()} {content.siteTitle}</div>
      </footer>
    </div>
  );
}

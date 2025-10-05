import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Clock,
  Headphones,
  Mic2,
  Star,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

import { getSiteContent } from "@/lib/siteContent";
import BookingForm from "@/components/BookingForm";

export default function Index() {
  const content = getSiteContent();
  return (
    <div className="min-h-screen">
      {/* Hero with site-inspired layout */}
      <section className="hero-bg py-20 bg-cover bg-center bg-gray-900">
        <div className="container mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div
            className="lg:col-span-7 text-white max-w-2xl"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}
          >
            <div className="inline-flex items-center gap-3 rounded-full bg-white/10 px-3 py-1 text-sm">
              <Star className="size-4 text-yellow-300" />
              West Lothian’s award-winning tuition
            </div>
            <h1 className="mt-6 text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight">
              {content.heroHeading}
            </h1>
            <p className="mt-4 text-lg text-white/90">
              {content.heroSubheading}
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link to="/contact">
                <Button size="lg" variant="gradient">
                  {content.ctaPrimary}
                </Button>
              </Link>
              <Link to="/lessons">
                <Button size="lg" variant="outline">
                  {content.ctaSecondary}
                </Button>
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 text-white/90 text-sm">
              <div className="flex items-center gap-2">
                <Headphones className="size-4" />
                Guitar
              </div>
              <div className="flex items-center gap-2">
                <Mic2 className="size-4" />
                Singing
              </div>
              <div className="flex items-center gap-2">
                <Headphones className="size-4" />
                Piano
              </div>
              <div className="flex items-center gap-2">
                <Headphones className="size-4" />
                Drums
              </div>
            </div>
          </div>

          <aside className="lg:col-span-5">
            <div className="bg-card rounded-xl p-6 shadow-lg max-w-md mx-auto">
              <h3 className="text-lg font-semibold">Book a free trial</h3>
              <p className="text-sm text-foreground/70 mt-1">
                No commitment — try a 30 minute lesson.
              </p>
              <BookingForm />
            </div>
          </aside>
        </div>
      </section>

      {/* Programs grid inspired by site */}
      <section className="container mx-auto py-16">
        <div className="p-6 bg-muted rounded-lg">
          <h2 className="text-2xl font-bold text-foreground">Programs</h2>
          <p className="mt-2 text-foreground/70 max-w-2xl">
            {content.programsIntro}
          </p>
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {[
              {
                title: "Guitar",
                img: "https://static.wixstatic.com/media/11062b_5a22f499b68b4cb4bd26d6c7b59b005f~mv2.jpg",
              },
              {
                title: "Singing",
                img: "https://static.wixstatic.com/media/7bc411_238d51c0e12341719cb19ee6ed9c56a5~mv2.jpeg",
              },
              {
                title: "Piano",
                img: "https://static.wixstatic.com/media/11062b_d1a6434bf6ad4d508d7c3e0d5a5c4e95~mv2.jpg",
              },
              {
                title: "Bass",
                img: "https://static.wixstatic.com/media/11062b_2523f4cfd4a94f45a97f561665934b4c~mv2_d_5195_3362_s_4_2.jpg",
              },
              {
                title: "Drums",
                img: "https://static.wixstatic.com/media/69c603f0e05a4d418583af8038a8d082.jpg",
              },
              {
                title: "Ukulele",
                img: "https://static.wixstatic.com/media/11062b_5a22f499b68b4cb4bd26d6c7b59b005f~mv2.jpg",
              },
              {
                title: "Bandjam",
                img: "https://static.wixstatic.com/media/11062b_67da4c327ae14c4a8fed63e683be364ef000.jpg",
              },
              {
                title: "Masterclass",
                img: "https://static.wixstatic.com/media/11062b_67da4c327ae14c4a8fed63e683be364ef000.jpg",
              },
            ].map((p) => (
              <div
                key={p.title}
                className="rounded-lg overflow-hidden border bg-card shadow-sm"
              >
                <img
                  src={p.img}
                  alt={p.title}
                  className="h-36 w-full object-cover"
                />
                <div className="p-3 bg-card">
                  <h3 className="font-semibold text-foreground">{p.title}</h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Location & contact snip */}
      <section className="container mx-auto py-12">
        <div className="grid md:grid-cols-2 gap-6 items-center">
          <div>
            <h3 className="text-xl font-semibold">Location</h3>
            <p className="mt-2 text-foreground/70">
              Music Studio, East Pavilion, Blackburn House
              <br />
              Redhouse Road, Seafield, West Lothian, EH47 7AQ, UK
            </p>
            <p className="mt-4 text-sm">
              Email:{" "}
              <a
                href="mailto:bookings@intunemusictuition.co.uk"
                className="text-primary hover:underline"
              >
                bookings@intunemusictuition.co.uk
              </a>
            </p>
            <p className="text-sm">
              Phone:{" "}
              <a
                href="tel:+447359224618"
                className="text-primary hover:underline"
              >
                +44 7359 224618
              </a>
            </p>
          </div>
          <div>
            <iframe
              title="location"
              src="https://www.google.com/maps?q=Blackburn+House+Seafield&output=embed"
              className="w-full h-64 rounded-md border"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

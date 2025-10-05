import { Logo } from "./Logo";
import { Link } from "react-router-dom";
import { getSiteContent } from "@/lib/siteContent";

function SiteContentAddress() {
  const c = getSiteContent();
  return (
    <>
      {c.address}
      <br />
      <a href={`mailto:${c.email}`} className="hover:text-foreground">
        {c.email}
      </a>
      <br />
      <a href={`tel:${c.phone}`} className="hover:text-foreground">
        {c.phone}
      </a>
    </>
  );
}

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <Logo />
          <p className="mt-3 text-sm text-foreground/70 max-w-xs">
            Modern, approachable music lessons for every level. In Tune helps
            you find your sound.
          </p>
        </div>
        <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-6 text-sm">
          <div>
            <p className="font-semibold mb-3">Learn</p>
            <ul className="space-y-2 text-foreground/70">
              <li>
                <Link to="/lessons" className="hover:text-foreground">
                  Lessons
                </Link>
              </li>
              <li>
                <Link to="/teachers" className="hover:text-foreground">
                  Teachers
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="hover:text-foreground">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold mb-3">Company</p>
            <ul className="space-y-2 text-foreground/70">
              <li>
                <Link to="/contact" className="hover:text-foreground">
                  Contact
                </Link>
              </li>
              <li>
                <a href="#" className="hover:text-foreground" aria-disabled>
                  About
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground" aria-disabled>
                  Careers
                </a>
              </li>
            </ul>
          </div>
          <div className="col-span-2">
            <p className="font-semibold mb-3">Location & contact</p>
            <address className="not-italic text-foreground/70 text-sm">
              {""}
              <SiteContentAddress />
            </address>
            <p className="mt-4 font-semibold mb-2">Stay in tune</p>
            <form className="flex gap-2 max-w-sm">
              <label htmlFor="footerSubscribeEmail" className="sr-only">
                Email address
              </label>
              <input
                id="footerSubscribeEmail"
                name="email"
                type="email"
                placeholder="Email address"
                className="flex-1 h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Email address"
              />
              <button className="h-10 px-4 rounded-md text-sm font-medium gradient-brand text-white">
                Subscribe
              </button>
            </form>
            <p className="mt-2 text-xs text-foreground/60">
              No spam. Unsubscribe anytime.
            </p>
          </div>
        </div>
      </div>
      <div className="border-t py-6 text-center text-xs text-foreground/60">
        © {new Date().getFullYear()} In Tune Music Tuition. All rights
        reserved.
      </div>
    </footer>
  );
}

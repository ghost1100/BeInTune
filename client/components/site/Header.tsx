import { Link, NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import ThemeToggle from "./ThemeToggle";

const nav = [
  { href: "/lessons", label: "Lessons" },
  { href: "/teachers", label: "Teachers" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between">
        <Logo />
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {nav.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                `transition-colors hover:text-foreground/80 ${
                  isActive ? "text-foreground" : "text-foreground/60"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/admin/login" className="hidden sm:block">
            <Button variant="ghost">Login</Button>
          </Link>
          <Link to="/contact" className="hidden sm:block">
            <Button variant="ghost">Contact</Button>
          </Link>
          <Link to="/lessons">
            <Button variant="gradient">Book a free trial</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

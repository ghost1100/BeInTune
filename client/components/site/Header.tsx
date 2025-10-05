import { Link, NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import ThemeToggle from "./ThemeToggle";
import useAuth from "@/hooks/use-auth";
import NotificationBell from "@/components/ui/NotificationBell";
import { Link } from "react-router-dom";

const publicNav = [
  { href: "/lessons", label: "Lessons" },
  { href: "/teachers", label: "Teachers" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const { user, loading } = useAuth();
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between">
        <Logo />
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {publicNav.map((item) => (
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
          {/* Notification bell */}
          <div className="hidden sm:block">
            <NotificationBell />
          </div>
          {user && user.role === "student" && (
            <Link to="/dashboard" className="hidden sm:block">
              <Button variant="ghost">Dashboard</Button>
            </Link>
          )}
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

import { Link } from "react-router-dom";

const logoUrl =
  "https://static.wixstatic.com/media/7bc411_e9382625812b44e989df4d74039a1e2b~mv2.png";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      to="/"
      className={`inline-flex items-center gap-3 group ${className}`}
      aria-label="In Tune home"
    >
      <img
        src={logoUrl}
        alt="In Tune logo"
        className="h-10 w-auto rounded-md"
      />
      <div className="leading-tight">
        <div className="text-sm font-semibold">InTune</div>
        <div className="text-xs text-foreground/60">Music Tuition</div>
      </div>
    </Link>
  );
}

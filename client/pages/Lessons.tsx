import { Link } from "react-router-dom";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Lessons() {
  return (
    <div className="container mx-auto py-20">
      <h1 className="text-3xl font-bold">Lessons</h1>
      <p className="mt-2 text-foreground/70 max-w-2xl">
        This page will showcase instruments, curricula, and how our lesson plans adapt to your goals. Tell me what you want here and I’ll build it out.
      </p>
      <div className="mt-6">
        <Link to="/"><Button variant="gradient">Back to home</Button></Link>
      </div>
    </div>
  );
}

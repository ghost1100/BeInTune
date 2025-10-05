import { Link } from "react-router-dom";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Contact() {
  return (
    <div className="container mx-auto py-20">
      <h1 className="text-3xl font-bold">Contact</h1>
      <p className="mt-2 text-foreground/70 max-w-2xl">
        We can add a contact form, studio address, and scheduling options. Share the details and I’ll implement it.
      </p>
      <div className="mt-6">
        <Link to="/"><Button variant="gradient">Back to home</Button></Link>
      </div>
    </div>
  );
}

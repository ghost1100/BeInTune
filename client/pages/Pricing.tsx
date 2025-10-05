import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Pricing() {
  return (
    <div className="container mx-auto py-20">
      <h1 className="text-3xl font-bold">Pricing</h1>
      <p className="mt-2 text-foreground/70 max-w-2xl">
        We can add tiered pricing, packages, and discounts. Tell me your structure and I’ll set it up.
      </p>
      <div className="mt-6">
        <Link to="/"><Button variant="gradient">Back to home</Button></Link>
      </div>
    </div>
  );
}

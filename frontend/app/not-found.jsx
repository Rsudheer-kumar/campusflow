import Link from "next/link";
import { Compass, ArrowLeft, Home } from "lucide-react";
import { Button, Card } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#050816] text-[#F8FAFC] flex flex-col justify-center items-center px-4 py-12 relative selection:bg-primary/30">
      <div className="absolute inset-0 bg-radial-[circle_at_50%_30%] from-primary/10 via-transparent to-transparent pointer-events-none" />

      <Card className="max-w-md w-full p-8 text-center bg-[#0B1224]/95 border-border shadow-2xl backdrop-blur-md z-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/30 text-primary-bright mb-5 shadow-[0_0_20px_rgba(79,140,255,0.2)]">
          <Compass className="h-8 w-8" />
        </div>

        <span className="font-mono text-xs font-bold text-primary-bright px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 uppercase tracking-widest inline-block mb-3">
          404 Not Found
        </span>

        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
          Page Does Not Exist
        </h1>

        <p className="text-sm text-muted leading-relaxed mb-6">
          The requested campus resource or navigation route could not be located. It may have been relocated or decommissioned.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button
              variant="primary"
              size="sm"
              icon={<ArrowLeft className="h-4 w-4" />}
              className="w-full sm:w-auto"
            >
              Back to Dashboard
            </Button>
          </Link>

          <Link href="/" className="w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              icon={<Home className="h-4 w-4" />}
              className="w-full sm:w-auto"
            >
              Campus Home
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}


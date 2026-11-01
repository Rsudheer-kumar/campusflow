import Link from "next/link";
import { Compass, ArrowLeft } from "lucide-react";
import { Button, Card } from "@/components/ui";

export default function DashboardNotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center bg-[#0B1224]/90 border-border/80 shadow-2xl backdrop-blur-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/30 text-primary-bright mb-4">
          <Compass className="h-7 w-7" />
        </div>

        <h2 className="text-xl font-bold tracking-tight text-foreground mb-2">
          Dashboard Section Not Found
        </h2>

        <p className="text-sm text-muted leading-relaxed mb-6">
          The requested dashboard module does not exist or may have been restricted.
        </p>

        <Link href="/dashboard">
          <Button
            variant="primary"
            size="sm"
            icon={<ArrowLeft className="h-4 w-4" />}
          >
            Return to Dashboard Overview
          </Button>
        </Link>
      </Card>
    </div>
  );
}


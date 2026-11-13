import { cn } from "@/lib/utils";
export function PageHeader({ title, description, action, className }) {
    return (<div className={cn("flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4", "pb-6 border-b border-border", className)}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (<p className="mt-1 text-sm text-muted">{description}</p>)}
      </div>

      {action && <div className="mt-3 sm:mt-0 shrink-0">{action}</div>}
    </div>);
}

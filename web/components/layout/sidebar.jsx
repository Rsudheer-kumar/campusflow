import { cn } from "@/lib/utils";
import { SidebarContent } from "./sidebar-content";
export function Sidebar({ className, ...props }) {
    return (<aside className={cn("hidden w-[260px] shrink-0 border-r border-border md:flex md:flex-col", className)} {...props}>
      <SidebarContent />
    </aside>);
}

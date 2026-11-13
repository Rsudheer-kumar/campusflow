import { AppLayout, AuthGuard } from "@/components/layout";
import { AuthProvider } from "@/lib/auth";
export const metadata = {
    title: "Dashboard",
    description: "CampusFlow dashboard and management interface",
};
export default function DashboardLayout({ children, }) {
    return (<AuthProvider>
      <AuthGuard>
        <AppLayout>{children}</AppLayout>
      </AuthGuard>
    </AuthProvider>);
}

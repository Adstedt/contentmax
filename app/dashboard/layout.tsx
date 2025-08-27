import { Sidebar } from '@/components/layout/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#000] flex">
      <Sidebar />
      <div className="flex-1 flex flex-col md:ml-0">{children}</div>
    </div>
  );
}

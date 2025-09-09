export default function SettingsLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse">
        <div className="h-8 w-48 bg-[#1a1a1a] rounded mb-8"></div>
        <div className="flex gap-4 mb-8">
          <div className="h-10 w-24 bg-[#1a1a1a] rounded"></div>
          <div className="h-10 w-32 bg-[#1a1a1a] rounded"></div>
          <div className="h-10 w-20 bg-[#1a1a1a] rounded"></div>
          <div className="h-10 w-24 bg-[#1a1a1a] rounded"></div>
        </div>
        <div className="space-y-4">
          <div className="h-4 w-full bg-[#1a1a1a] rounded"></div>
          <div className="h-4 w-3/4 bg-[#1a1a1a] rounded"></div>
          <div className="h-4 w-1/2 bg-[#1a1a1a] rounded"></div>
        </div>
      </div>
    </div>
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-dark-bg relative">
      <div className="w-full max-w-md z-10 relative">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600">
            Monitor
          </h1>
          <p className="text-foreground mt-2">李开开站点状态监控</p>
        </div>
        <div className="relative">
          {children}
        </div>
      </div>
    </div>
  );
} 
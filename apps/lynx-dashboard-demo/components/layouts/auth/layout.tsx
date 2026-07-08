import { LynxLogo } from "@repo/ui/components/brands/lynx-logo";
import { AuroraBackground } from "@repo/ui/components/ui/aurora-background";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuroraBackground>
      <div className="w-screen h-screen flex items-center justify-center ">
        <div className="p-10 border rounded-md min-w-120 bg-background z-50">
          <div className="flex text-xl gap-2 items-center text-foreground/70 mb-5">
            <LynxLogo className="size-7 text-primary" />
            <h1>Lynx</h1>
          </div>
          {children}
        </div>
      </div>
    </AuroraBackground>
  );
}

import AuthLayout from "@/components/layouts/auth/layout";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div>
      <AuthLayout>{children}</AuthLayout>
    </div>
  );
}

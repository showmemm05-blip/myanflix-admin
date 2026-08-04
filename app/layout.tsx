import type { Metadata } from "next";
import { Geist_Mono, Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { RoleProvider } from "@/lib/context/role-context";
import { SidebarProvider } from "@/lib/context/sidebar-context";
import { UploadProvider } from "@/lib/context/upload-context";
import { BulkUploadProvider } from "@/lib/context/bulk-upload-context";
import { AppShell } from "@/components/layout/AppShell";
import { GlobalUploadIndicator } from "@/components/uploads/GlobalUploadIndicator";
import { AdminDepositNotifications } from "@/components/deposits/AdminDepositNotifications";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MyanFlix Admin",
  description: "Admin dashboard for the MyanFlix streaming platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${plusJakartaSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          disableTransitionOnChange
        >
          <TooltipProvider>
            <RoleProvider>
              <SidebarProvider>
                <UploadProvider>
                  <BulkUploadProvider>
                    <AppShell>{children}</AppShell>
                    <GlobalUploadIndicator />
                    <AdminDepositNotifications />
                  </BulkUploadProvider>
                </UploadProvider>
              </SidebarProvider>
            </RoleProvider>
          </TooltipProvider>
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}

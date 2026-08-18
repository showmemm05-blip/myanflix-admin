import type { Metadata } from "next";
import { Geist_Mono, Inter, Noto_Sans_Myanmar, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/lib/context/language-context";
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

// Inter/Plus Jakarta Sans have no Myanmar glyphs — without this, Burmese
// text falls back to whatever generic font the OS picks. Included in the
// font stack (globals.css) as a fallback, not a replacement.
const notoSansMyanmar = Noto_Sans_Myanmar({
  variable: "--font-noto-myanmar",
  subsets: ["myanmar", "latin"],
  weight: ["400", "500", "600", "700"],
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
      className={`${inter.variable} ${plusJakartaSans.variable} ${geistMono.variable} ${notoSansMyanmar.variable} h-full antialiased`}
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
            <LanguageProvider>
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
            </LanguageProvider>
          </TooltipProvider>
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}

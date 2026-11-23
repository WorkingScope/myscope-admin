import type { Metadata } from "next";
import { IBM_Plex_Sans, Inter, Outfit } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { AuthProvider } from "@/contexts/auth-context";
import { GoogleAuthProvider } from "@/components/providers/google-auth-provider";
import { cn } from "@/lib/utils";

// Same three-font system as the organizer/consumer app (myscope-web), so
// admin's typography isn't visually a different product.
// Body / default sans — IBM Plex Sans.
const plexSans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Headings — Outfit.
const outfit = Outfit({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// UI labels / chrome — Inter.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MyScope Admin",
  description: "Admin panel for MyScope entertainment platform",
};

// Runs synchronously in <head> before paint to set the theme class — avoids a
// flash of the wrong theme on first load. Mirrors the persistence + system
// fallback logic in ThemeProvider.
const themeInitScript = `
(function(){
  try {
    var stored = localStorage.getItem('myscope-admin-theme');
    var theme = stored || 'system';
    var resolved = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    document.documentElement.classList.remove('light','dark');
    document.documentElement.classList.add(resolved);
    document.documentElement.style.colorScheme = resolved;
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", plexSans.variable, outfit.variable, inter.variable)}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={cn(plexSans.variable, outfit.variable, inter.variable, "font-sans antialiased")}>
        <ThemeProvider defaultTheme="system" storageKey="myscope-admin-theme">
          <GoogleAuthProvider>
            <AuthProvider>
              {children}
              <ToastProvider />
            </AuthProvider>
          </GoogleAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

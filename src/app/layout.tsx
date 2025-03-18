import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/error/error-boundary";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "ATLAS - Advanced Team Learning Assistant System",
  description: "AI-powered workspace for enhanced team learning and productivity",
  icons: {
    icon: [
      { url: "/branding/logo.svg" },
      { url: "/branding/favicon.ico" },
    ],
    apple: [
      { url: "/branding/logo.svg" },
    ],
  },
  manifest: "/manifest.json",
  themeColor: "#0F172A",
  viewport: "width=device-width, initial-scale=1",
  applicationName: "ATLAS",
  keywords: ["AI", "Learning", "Team", "Productivity", "Assistant"],
  authors: [{ name: "ATLAS Team" }],
  creator: "ATLAS Team",
  publisher: "ATLAS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-background text-foreground`}>
        <AuthProvider>
          <ThemeProvider>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
            <Toaster />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

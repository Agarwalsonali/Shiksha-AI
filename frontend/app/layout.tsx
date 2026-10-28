import type { Metadata } from "next";
import { Roboto, Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from '@/providers/query-provider'
import { ThemeProvider } from "@/providers/theme-provider";
import { Toaster } from '@/components/ui/sonner';

const roboto = Roboto({ 
  subsets: ['latin'], 
  variable: '--font-sans',
  weight: ['300', '400', '500', '700']
});
const inter = Inter({ 
  subsets: ['latin'], 
  variable: '--font-inter',
  weight: ['300', '400', '500', '600', '700']
});

export const metadata: Metadata = {
  title: "Shiksha AI - Your Personalized Learning Companion",
  description: "AI-powered learning platform for CBSE, ICSE, and State Board students. Get personalized tutoring, adaptive quizzes, and smart study plans.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${roboto.variable} antialiased`}
      >
        <QueryProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster richColors closeButton position="top-right" />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

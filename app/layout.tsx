import type { Metadata } from "next";
import "@/app/globals.css";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: { default: "KIDAFTARI", template: "%s | KIDAFTARI" },
  description: "A simple digital credit notebook for Tanzanian businesses.",
  applicationName: "KIDAFTARI",
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || "https://kitchen-orders-three.vercel.app",
  ),
  title: "Lumen Kitchen",
  description:
    "App creada para gestionar pedidos de cocina en un restaurante de manera eficiente y organizada.",
  openGraph: {
    title: "Lumen Kitchen",
    description:
      "App creada para gestionar pedidos de cocina en un restaurante de manera eficiente y organizada.",
    images: ["/logo.png"],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Lumen Kitchen",
    description:
      "App creada para gestionar pedidos de cocina en un restaurante de manera eficiente y organizada.",
    images: ["/logo.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#fffbf7",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={geist.variable}>
      <body className="antialiased">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}

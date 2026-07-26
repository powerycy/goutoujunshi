import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "狗头军师｜关系问题分析",
  description: "先接住情绪，再分清事实，最后给能执行的选择。",
  icons: {
    icon: "/doghead-logo.png",
    shortcut: "/doghead-logo.png",
    apple: "/doghead-logo.png",
  },
  openGraph: {
    type: "website",
    title: "狗头军师｜关系问题分析",
    description: "先接住情绪，再分清事实，最后给能执行的选择。",
  },
  twitter: {
    card: "summary",
    title: "狗头军师｜关系问题分析",
    description: "先接住情绪，再分清事实，最后给能执行的选择。",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

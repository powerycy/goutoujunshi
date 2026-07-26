import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const incomingHeaders = await headers();
  const host = incomingHeaders.get("x-forwarded-host") || incomingHeaders.get("host");
  const protocol = incomingHeaders.get("x-forwarded-proto") || "https";
  const baseUrl = host ? `${protocol}://${host}` : "https://goutoujunshi.example";
  const imageUrl = new URL("/og.png", baseUrl).toString();
  const title = "狗头军师｜关系问题分析";
  const description = "先接住情绪，再分清事实，最后给能执行的选择。";

  return {
    title,
    description,
    icons: {
      icon: "/doghead-logo.png",
      shortcut: "/doghead-logo.png",
      apple: "/doghead-logo.png",
    },
    openGraph: {
      type: "website",
      title,
      description,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: "狗头军师真实 AI 关系分析",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

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

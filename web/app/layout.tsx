import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "狗头军师｜先接住，再判断",
  description:
    "内置13万字符关系知识与决策体系，把情绪、事实、推测、互惠、风险与下一步拆清楚。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

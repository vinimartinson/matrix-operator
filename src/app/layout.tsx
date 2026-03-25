import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Matrix Operator — Command the Resistance",
  description: "You are the Operator. Guide Neo, Trinity, and Morpheus through the Matrix. A real-time terminal strategy game.",
  keywords: ["matrix", "operator", "terminal", "game", "hacker", "neo", "strategy"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

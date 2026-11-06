import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CartProvider } from "@/ui/cart";
import { Header } from "@/ui/Header";

export const metadata: Metadata = {
  title: "Biryani Direct: order from the kitchen, not the middleman",
  description: "Hyderabad biryani, ordered direct from your nearest outlet.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          <Header />
          {children}
        </CartProvider>
      </body>
    </html>
  );
}

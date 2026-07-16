import type { Metadata } from "next";
import { GuestPortal } from "@/components/customer/guest-portal";

export const metadata: Metadata = { title: "Area ospite", robots: { index: false, follow: false } };

export default function AccountPage() {
  return <GuestPortal />;
}

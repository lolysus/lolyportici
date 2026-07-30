import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ManageBooking } from "@/components/public-booking/manage-booking";
import { hasLocale } from "@/lib/i18n";
import { defaultRestaurantLocation } from "@/config/brand";
import { restaurantThemeStyle } from "@/lib/brand-theme";
import { findReservationForManagementToken } from "@/lib/public-reservation";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ManagePage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params; if (!hasLocale(locale)) notFound();
  const match = await findReservationForManagementToken(token);
  const location = match?.location ?? defaultRestaurantLocation;
  return <div style={restaurantThemeStyle(location)} className="dark min-h-screen bg-background"><header className="bg-[var(--brand-surface)] px-5 py-4 text-white"><div className="mx-auto w-36 sm:w-40"><BrandLogo priority restaurant={location} subtitle="Area ospite" /></div></header><ManageBooking token={token} locale={locale} /></div>;
}


import BookingPage, { generateMetadata as generateBookingMetadata } from "@/app/[locale]/book/[restaurantSlug]/page";

type DirectBookingParams = { params: Promise<{ restaurant: string }> };

export async function generateMetadata({ params }: DirectBookingParams) {
  const { restaurant } = await params;
  return generateBookingMetadata({ params: Promise.resolve({ locale: "it", restaurantSlug: restaurant }) });
}

export default async function DirectBookingPage({ params }: DirectBookingParams) {
  const { restaurant } = await params;
  return <BookingPage params={Promise.resolve({ locale: "it", restaurantSlug: restaurant })} />;
}

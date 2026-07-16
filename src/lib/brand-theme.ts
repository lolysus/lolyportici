import type { CSSProperties } from "react";
import type { RestaurantLocation } from "@/config/brand";

export type RestaurantThemeStyle = CSSProperties & {
  "--primary": string;
  "--primary-foreground": string;
  "--accent": string;
  "--ring": string;
  "--sidebar-primary": string;
  "--brand-surface": string;
  "--brand-glow": string;
};

export function restaurantThemeStyle(restaurant: RestaurantLocation): RestaurantThemeStyle {
  return {
    "--primary": restaurant.theme.primary,
    "--primary-foreground": restaurant.theme.primaryForeground,
    "--accent": restaurant.theme.primary,
    "--ring": restaurant.theme.primary,
    "--sidebar-primary": restaurant.theme.primary,
    "--brand-surface": restaurant.theme.surface,
    "--brand-glow": restaurant.theme.glow,
  };
}

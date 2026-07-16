import type { MetadataRoute } from "next";
import { getPublicUrl } from "@/lib/public-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/auth/", "/login", "/it/booking/manage/", "/en/booking/manage/", "/es/booking/manage/"],
    },
    sitemap: getPublicUrl("/sitemap.xml"),
  };
}

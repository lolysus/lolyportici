import type { MetadataRoute } from "next";
import { getRequestUrl } from "@/lib/public-url";

export default async function robots(): Promise<MetadataRoute.Robots> {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/auth/", "/login", "/gestione/", "/it/booking/manage/", "/en/booking/manage/", "/es/booking/manage/"],
    },
    // La sitemap dichiarata qui deve essere quella dello stesso dominio: un
    // crawler su kousushiportici.it che trova un rimando alla sitemap di
    // yukoardea.it la ignora, e comunque non è quello l'indirizzo giusto.
    sitemap: await getRequestUrl("/sitemap.xml"),
  };
}

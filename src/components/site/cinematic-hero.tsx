"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { SitePhoto } from "@/lib/site-photos";

/**
 * Sfondo dell'apertura: un video d'atmosfera che parte da solo, muto e in loop.
 * Su telefono (o con "riduci animazioni", o rete lenta) NON scarica il video:
 * mostra la foto poster, che pesa una frazione e si vede subito. Così l'effetto
 * "wow" resta su desktop senza penalizzare chi arriva da mobile in 4G.
 */
export function CinematicHero({ videoSrc, poster }: { videoSrc: string; poster: SitePhoto }) {
  const [playVideo, setPlayVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const wantsMotion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bigScreen = window.matchMedia("(min-width: 768px) and (hover: hover)").matches;
    // Rispetta il risparmio dati e le connessioni lente, se il browser li espone.
    const conn = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const cheapData = conn?.saveData || /2g/.test(conn?.effectiveType ?? "");
    if (wantsMotion && bigScreen && !cheapData) {
      const id = requestAnimationFrame(() => setPlayVideo(true));
      return () => cancelAnimationFrame(id);
    }
  }, []);

  useEffect(() => {
    if (playVideo) videoRef.current?.play().catch(() => {});
  }, [playVideo]);

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <Image
        src={poster.src}
        alt=""
        fill
        priority
        sizes="100vw"
        placeholder="blur"
        blurDataURL={poster.blurDataURL}
        className="hero-media object-cover"
      />
      {playVideo && (
        <video
          ref={videoRef}
          className="hero-media absolute inset-0 size-full object-cover"
          muted
          loop
          playsInline
          preload="none"
          poster={poster.src}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      )}
      <div className="hero-scrim absolute inset-0" />
    </div>
  );
}

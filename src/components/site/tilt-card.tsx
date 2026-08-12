"use client";

import { useRef, type ReactNode } from "react";

/**
 * Card con inclinazione 3D che segue il puntatore, con bagliore dorato nel
 * punto del mouse. Su schermi touch o con "riduci animazioni" resta ferma:
 * il tilt è un di più, non deve intralciare la lettura da telefono.
 */
export function TiltCard({
  children,
  className = "",
  max = 7,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef<number>(0);

  const allowed = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const node = ref.current;
    if (!node || !allowed()) return;
    const rect = node.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const rotY = (px - 0.5) * max * 2;
      const rotX = (0.5 - py) * max * 2;
      node.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
      node.style.setProperty("--mx", `${px * 100}%`);
      node.style.setProperty("--my", `${py * 100}%`);
    });
  }

  function reset() {
    const node = ref.current;
    if (!node) return;
    cancelAnimationFrame(raf.current);
    node.style.transform = "";
    node.style.removeProperty("--mx");
    node.style.removeProperty("--my");
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      className={`dish-card ${className}`}
    >
      {children}
    </div>
  );
}

"use client";
/**
 * Liquid lens: real refraction for glass surfaces. Mount <LiquidLensDefs />
 * once; elements with the `liquid-lens` class then bend what is behind them
 * at their rim (an SVG displacement map used as a backdrop filter).
 * Only Chromium renders SVG backdrop filters, so the class activates only
 * there (html.has-liquid-lens); every other browser keeps the regular glass.
 */
import { useEffect } from "react";

// Displacement map: red = x shift, green = y shift; neutral grey in the
// middle, pushing outward towards the edges like a convex lens rim.
const MAP = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <defs>
      <linearGradient id="x" x1="0" x2="1"><stop offset="0" stop-color="#000"/><stop offset=".22" stop-color="#808080"/><stop offset=".78" stop-color="#808080"/><stop offset="1" stop-color="#f00"/></linearGradient>
      <linearGradient id="y" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000"/><stop offset=".22" stop-color="#808080"/><stop offset=".78" stop-color="#808080"/><stop offset="1" stop-color="#0f0"/></linearGradient>
    </defs>
    <rect width="200" height="200" fill="#808080"/>
    <rect width="200" height="200" fill="url(#x)" style="mix-blend-mode:screen"/>
    <rect width="200" height="200" fill="url(#y)" style="mix-blend-mode:screen"/>
  </svg>`,
)}`;

function isChromium() {
  const nav = navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } };
  const brands = nav.userAgentData?.brands?.map((b) => b.brand) ?? [];
  return brands.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b));
}

export function LiquidLensDefs() {
  useEffect(() => {
    if (!isChromium()) return;
    document.documentElement.classList.add("has-liquid-lens");
    return () => document.documentElement.classList.remove("has-liquid-lens");
  }, []);
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden focusable="false">
      <filter id="hop-lens" x="0" y="0" width="100%" height="100%" primitiveUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
        <feImage href={MAP} x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="map" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="0.004" result="soft" />
        <feDisplacementMap in="soft" in2="map" scale="0.06" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}

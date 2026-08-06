"use client";

import { useRef } from "react";
import { motion } from "motion/react";
import DottedMap from "dotted-map";

/**
 * Dotted world map with standalone markers.
 *
 * The registry version takes start/end pairs and draws an animated arc between
 * them. That was rejected: the arcs implied routes rather than presence, so this
 * renders markers only — home in one colour, every market it supplies in
 * another, and nothing joining them.
 */

export interface MapMarker {
  lat: number;
  lng: number;
  label: string;
  /** Marks the home base, drawn larger and in `homeColor`. */
  home?: boolean;
}

interface MapProps {
  markers?: MapMarker[];
  /** Home marker. Defaults to the brand's sky accent. */
  homeColor?: string;
  /** Every other market. */
  marketColor?: string;
}

export default function WorldMap({
  markers = [],
  homeColor = "#38bdf8",
  marketColor = "#facc15",
}: MapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const map = new DottedMap({ height: 100, grid: "diagonal" });

  // Dark grid dots: the landing page is light. This was white-transparent while
  // the page was navy, which would have made the whole map invisible here. The
  // app toggles a `dark` class itself rather than using next-themes, so the
  // value is fixed rather than pulled from a theme provider that does not exist.
  const svgMap = map.getSVG({
    radius: 0.22,
    color: "#0a162833",
    shape: "circle",
    backgroundColor: "transparent",
  });

  const projectPoint = (lat: number, lng: number) => ({
    x: (lng + 180) * (800 / 360),
    y: (90 - lat) * (400 / 180),
  });

  return (
    <div className="relative aspect-[2/1] w-full font-sans">
      {/* eslint-disable-next-line @next/next/no-img-element -- an inline SVG
          data URI generated at render; next/image cannot optimise it. */}
      <img
        src={`data:image/svg+xml;utf8,${encodeURIComponent(svgMap)}`}
        className="pointer-events-none h-full w-full select-none [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)]"
        alt=""
        height="495"
        width="1056"
        draggable={false}
      />

      <svg
        ref={svgRef}
        viewBox="0 0 800 400"
        className="pointer-events-none absolute inset-0 h-full w-full select-none"
      >
        {markers.map((marker, i) => {
          const { x, y } = projectPoint(marker.lat, marker.lng);
          const color = marker.home ? homeColor : marketColor;
          return (
            <motion.g
              key={marker.label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.15 + i * 0.06 }}
            >
              <title>{marker.label}</title>
              {/* Halo, so a small dot still reads against the dotted field. */}
              <circle cx={x} cy={y} r={marker.home ? 7 : 5} fill={color} opacity={0.18} />
              <circle cx={x} cy={y} r={marker.home ? 3.5 : 2.5} fill={color} />
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}

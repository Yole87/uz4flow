"use client";

import { motion, useSpring } from "framer-motion";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface FunnelGradientStop {
  offset: string | number;
  color: string;
}

export interface FunnelStage {
  label: string;
  value: number;
  displayValue?: string;
  color?: string;
  gradient?: FunnelGradientStop[];
}

export interface FunnelChartProps {
  data: FunnelStage[];
  orientation?: "horizontal" | "vertical";
  color?: string;
  layers?: number;
  className?: string;
  style?: CSSProperties;
  showPercentage?: boolean;
  showValues?: boolean;
  showLabels?: boolean;
  hoveredIndex?: number | null;
  onHoverChange?: (index: number | null) => void;
  formatPercentage?: (pct: number) => string;
  formatValue?: (value: number) => string;
  staggerDelay?: number;
  gap?: number;
  edges?: "curved" | "straight";
}

const fmtPct = (p: number) => `${Math.round(p)}%`;
const fmtVal = (v: number) => v.toLocaleString("pt-BR");

const springConfig = { stiffness: 120, damping: 20, mass: 1 };
const hoverSpring = { stiffness: 300, damping: 24 };

// horizontal funnel: each segment is a wave from left → right
function hSegmentPath(
  normStart: number,
  normEnd: number,
  segW: number,
  H: number,
  layerScale: number,
  straight = false,
) {
  const my = H / 2;
  const h0 = normStart * H * 0.44 * layerScale;
  const h1 = normEnd * H * 0.44 * layerScale;
  if (straight) {
    return `M 0 ${my - h0} L ${segW} ${my - h1} L ${segW} ${my + h1} L 0 ${my + h0} Z`;
  }
  const cx = segW * 0.55;
  const top = `M 0 ${my - h0} C ${cx} ${my - h0}, ${segW - cx} ${my - h1}, ${segW} ${my - h1}`;
  const bot = `L ${segW} ${my + h1} C ${segW - cx} ${my + h1}, ${cx} ${my + h0}, 0 ${my + h0}`;
  return `${top} ${bot} Z`;
}

function vSegmentPath(
  normStart: number,
  normEnd: number,
  segH: number,
  W: number,
  layerScale: number,
  straight = false,
) {
  const mx = W / 2;
  const w0 = normStart * W * 0.44 * layerScale;
  const w1 = normEnd * W * 0.44 * layerScale;
  if (straight) {
    return `M ${mx - w0} 0 L ${mx - w1} ${segH} L ${mx + w1} ${segH} L ${mx + w0} 0 Z`;
  }
  const cy = segH * 0.55;
  const left = `M ${mx - w0} 0 C ${mx - w0} ${cy}, ${mx - w1} ${segH - cy}, ${mx - w1} ${segH}`;
  const right = `L ${mx + w1} ${segH} C ${mx + w1} ${segH - cy}, ${mx + w0} ${cy}, ${mx + w0} 0`;
  return `${left} ${right} Z`;
}

function HRing({
  d,
  color,
  fill,
  opacity,
  hovered,
  ringIndex,
  totalRings,
  showStroke = false,
}: {
  d: string;
  color: string;
  fill?: string;
  opacity: number;
  hovered: boolean;
  ringIndex: number;
  totalRings: number;
  showStroke?: boolean;
}) {
  const extraScale = 1 + (ringIndex / Math.max(totalRings - 1, 1)) * 0.12;
  const ringSpring = {
    stiffness: 300 - ringIndex * 60,
    damping: 24 - ringIndex * 3,
  };
  const scaleY = useSpring(1, ringSpring);
  useEffect(() => {
    scaleY.set(hovered ? extraScale : 1);
  }, [hovered, scaleY, extraScale]);

  return (
    <motion.path
      d={d}
      fill={fill ?? color}
      fillOpacity={opacity}
      stroke={showStroke ? "#000" : color}
      strokeOpacity={showStroke ? 0.4 : 0.15}
      strokeWidth={showStroke ? 1.5 : 0.5}
      style={{ scaleY, transformOrigin: "center" }}
    />
  );
}

function HSegment({
  index,
  normStart,
  normEnd,
  segW,
  fullH,
  color,
  layers,
  staggerDelay,
  hovered,
  dimmed,
  straight,
  gradientStops,
}: {
  index: number;
  normStart: number;
  normEnd: number;
  segW: number;
  fullH: number;
  color: string;
  layers: number;
  staggerDelay: number;
  hovered: boolean;
  dimmed: boolean;
  straight: boolean;
  gradientStops?: FunnelGradientStop[];
}) {
  const gradientId = `funnel-h-grad-${index}`;
  const growProgress = useSpring(0, springConfig);
  const dimOpacity = useSpring(1, hoverSpring);

  useEffect(() => {
    dimOpacity.set(dimmed ? 0.4 : 1);
  }, [dimmed, dimOpacity]);

  useEffect(() => {
    const timeout = setTimeout(
      () => growProgress.set(1),
      index * staggerDelay * 1000,
    );
    return () => clearTimeout(timeout);
  }, [growProgress, index, staggerDelay]);

  // 2 camadas por padrão: halo externo translúcido (1.15x) + corpo sólido (1x).
  // Camadas adicionais (raras) ficam entre as duas com opacidade média.
  const rings = Array.from({ length: layers }, (_, l) => {
    const isHalo = l === 0 && layers > 1;
    const isBody = l === layers - 1;
    let scale: number;
    let opacity: number;
    if (isHalo) {
      scale = 1.15;
      opacity = 0.15;
    } else if (isBody) {
      scale = 1;
      opacity = 0.95;
    } else {
      scale = 1.15 - (l / (layers - 1)) * 0.15;
      opacity = 0.3 + (l / (layers - 1)) * 0.4;
    }
    return {
      d: hSegmentPath(normStart, normEnd, segW, fullH, scale, straight),
      opacity,
      isBody,
    };
  });

  return (
    <motion.g
      style={{ opacity: dimOpacity, transformOrigin: "center" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        delay: index * staggerDelay,
        duration: 0.45,
        ease: "easeOut",
      }}
    >
      <defs>
        {gradientStops && (
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            {gradientStops.map((stop, i) => (
              <stop key={i} offset={stop.offset} stopColor={stop.color} />
            ))}
          </linearGradient>
        )}
      </defs>
      {rings.map((r, i) => {
        const ringFill =
          r.isBody && gradientStops ? `url(#${gradientId})` : undefined;
        return (
          <HRing
            key={i}
            d={r.d}
            color={color}
            fill={ringFill}
            opacity={r.opacity}
            hovered={hovered}
            ringIndex={i}
            totalRings={rings.length}
            showStroke={r.isBody}
          />
        );
      })}
    </motion.g>
  );
}

function SegmentLabel({
  stage,
  pct,
  showValues,
  showPercentage,
  showLabels,
  formatPercentage,
  formatValue,
}: {
  stage: FunnelStage;
  pct: number;
  showValues: boolean;
  showPercentage: boolean;
  showLabels: boolean;
  formatPercentage: (p: number) => string;
  formatValue: (v: number) => string;
}) {
  const display = stage.displayValue ?? formatValue(stage.value);
  return (
    <div className="pointer-events-none flex h-full flex-col items-center justify-between py-2">
      <div className="text-center">
        {showValues && (
          <div className="text-base font-bold text-foreground drop-shadow-sm tabular-nums">
            {display}
          </div>
        )}
        {showPercentage && (
          <div className="text-xs font-medium uppercase tracking-wider text-foreground/70">
            {formatPercentage(pct)}
          </div>
        )}
      </div>
      {showLabels && (
        <div className="max-w-[90%] truncate text-center text-xs font-medium text-foreground/90 drop-shadow-sm">
          {stage.label}
        </div>
      )}
    </div>
  );
}

export function FunnelChart({
  data,
  orientation = "horizontal",
  color = "hsl(var(--primary))",
  layers = 2,
  className,
  style,
  showPercentage = true,
  showValues = true,
  showLabels = true,
  hoveredIndex: hoveredIndexProp,
  onHoverChange,
  formatPercentage = fmtPct,
  formatValue = fmtVal,
  staggerDelay = 0.08,
  gap = 6,
  edges = "curved",
}: FunnelChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [sz, setSz] = useState({ w: 0, h: 0 });
  const [internalHovered, setInternalHovered] = useState<number | null>(null);

  const isControlled = hoveredIndexProp !== undefined;
  const hoveredIndex = isControlled ? hoveredIndexProp : internalHovered;
  const setHoveredIndex = useCallback(
    (i: number | null) => {
      if (isControlled) onHoverChange?.(i);
      else setInternalHovered(i);
    },
    [isControlled, onHoverChange],
  );

  const measure = useCallback(() => {
    if (!ref.current) return;
    const { width: w, height: h } = ref.current.getBoundingClientRect();
    if (w > 0 && h > 0) setSz({ w, h });
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [measure]);

  if (!data.length) return null;
  const first = data[0];
  if (!first) return null;

  const max = Math.max(first.value, 1);
  const n = data.length;
  // Escala raiz quadrada: suaviza diferenças muito grandes (ex: 311 → 22)
  // sem distorcer a hierarquia visual. Mínimo 8% para sempre haver corpo visível.
  const norms = data.map((d) => Math.max(Math.sqrt(d.value / max), 0.08));
  const horiz = orientation === "horizontal";
  const { w: W, h: H } = sz;

  const totalGap = gap * (n - 1);
  const segW = horiz ? (W - totalGap) / n : W;
  const segH = horiz ? H : (H - totalGap) / n;
  const straight = edges === "straight";

  return (
    <div ref={ref} className={cn("relative w-full", className)} style={style}>
      {W > 0 && H > 0 && (
        <>
          <svg
            width={W}
            height={H}
            className="absolute inset-0"
            style={{ pointerEvents: "none" }}
          >
            {data.map((stage, i) => {
              const normStart = norms[i] ?? 0;
              const isLast = i === n - 1;
              // Último estágio fecha em ponta (35% do próprio valor) para efeito de funil
              const normEnd = isLast
                ? Math.max((norms[i] ?? 0) * 0.35, 0.05)
                : (norms[i + 1] ?? 0);
              const firstStop = stage.gradient?.[0];
              const segColor = firstStop
                ? firstStop.color
                : (stage.color ?? color);
              const x = horiz ? (segW + gap) * i : 0;
              const y = horiz ? 0 : (segH + gap) * i;
              const isHovered = hoveredIndex === i;
              return (
                <g
                  key={i}
                  transform={`translate(${x}, ${y})`}
                  style={{
                    filter: isHovered
                      ? `drop-shadow(0 0 12px ${segColor})`
                      : undefined,
                    transition: "filter 200ms ease-out",
                  }}
                >
                  <HSegment
                    index={i}
                    normStart={normStart}
                    normEnd={normEnd}
                    segW={segW}
                    fullH={segH}
                    color={segColor}
                    layers={layers}
                    staggerDelay={staggerDelay}
                    hovered={isHovered}
                    dimmed={hoveredIndex !== null && hoveredIndex !== i}
                    straight={straight}
                    gradientStops={stage.gradient}
                  />
                </g>
              );
            })}
          </svg>

          {data.map((stage, i) => {
            const pct = (stage.value / max) * 100;
            const posStyle: CSSProperties = horiz
              ? { left: (segW + gap) * i, width: segW, top: 0, height: H }
              : { top: (segH + gap) * i, height: segH, left: 0, width: W };
            return (
              <motion.div
                key={i}
                className="absolute cursor-pointer"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{ ...posStyle, zIndex: 20 }}
                animate={{
                  scale: hoveredIndex === i ? 1.04 : 1,
                  opacity:
                    hoveredIndex !== null && hoveredIndex !== i ? 0.55 : 1,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
              >
                <SegmentLabel
                  stage={stage}
                  pct={pct}
                  showValues={showValues}
                  showPercentage={showPercentage}
                  showLabels={showLabels}
                  formatPercentage={formatPercentage}
                  formatValue={formatValue}
                />
              </motion.div>
            );
          })}
        </>
      )}
    </div>
  );
}

FunnelChart.displayName = "FunnelChart";

export default FunnelChart;

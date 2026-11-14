import React, { useEffect, useRef, useState } from "react";
import { CampaignCluster, NetworkEdge, SocialPostNode } from "../types";

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
const W = 900,
  H = 520;
const EDGE_COLOR: Record<string, string> = {
  semantic_copy: "#f43f5e",
  shared_url: "#f59e0b",
  temporal_burst: "#22d3ee",
  hashtag_cascade: "#a855f7",
  retweet_ring: "#64748b",
};

/** Small force-directed SVG graph: repulsion + spring edges + cluster gravity. Drag nodes, click to inspect. */
export const ForceGraph: React.FC<{
  nodes: SocialPostNode[];
  edges: NetworkEdge[];
  clusters: CampaignCluster[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  filter: number | null;
}> = ({ nodes, edges, clusters, selected, onSelect, filter }) => {
  const pos = useRef(new Map<string, P>());
  const [, tick] = useState(0);
  const drag = useRef<string | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const alpha = useRef(1);

  useEffect(() => {
    const m = new Map<string, P>();
    const k = Math.max(1, clusters.length);
    nodes.forEach((n, i) => {
      const a = n.clusterId ? ((n.clusterId - 1) / k) * Math.PI * 2 : (i * 2.4) % (Math.PI * 2);
      const r = n.clusterId ? 170 : 240;
      m.set(n.id, {
        x: W / 2 + Math.cos(a) * r + (Math.random() - 0.5) * 60,
        y: H / 2 + Math.sin(a) * r * 0.75 + (Math.random() - 0.5) * 60,
        vx: 0,
        vy: 0,
      });
    });
    pos.current = m;
    alpha.current = 1;
  }, [nodes, clusters.length]);

  useEffect(() => {
    let raf = 0;
    const step = () => {
      const m = pos.current,
        a = alpha.current;
      if (a > 0.01) {
        const arr = nodes.map((n) => [n, m.get(n.id)!] as const).filter((x) => x[1]);
        // Spatial bins keep graph layout responsive on larger uploaded networks.
        const cells = new Map<string, P[]>();
        for (const [, p] of arr) {
          const key = `${Math.floor(p.x / 80)}:${Math.floor(p.y / 80)}`;
          const cell = cells.get(key) || [];
          if (cell.length < 80) cell.push(p);
          cells.set(key, cell);
        }
        for (const [, p] of arr) {
          const cx = Math.floor(p.x / 80),
            cy = Math.floor(p.y / 80);
          for (let ox = -1; ox <= 1; ox++)
            for (let oy = -1; oy <= 1; oy++)
              for (const q of cells.get(`${cx + ox}:${cy + oy}`) || []) {
                if (p === q) continue;
                let dx = p.x - q.x,
                  dy = p.y - q.y;
                const d2 = dx * dx + dy * dy + 0.01,
                  f = (900 / d2) * a;
                const d = Math.sqrt(d2);
                dx /= d;
                dy /= d;
                p.vx += dx * f;
                p.vy += dy * f;
                q.vx -= dx * f;
                q.vy -= dy * f;
              }
        }
        edges.forEach((e) => {
          const p = m.get(e.source),
            q = m.get(e.target);
          if (!p || !q) return;
          const dx = q.x - p.x,
            dy = q.y - p.y,
            d = Math.hypot(dx, dy) || 1,
            f = (d - 60) * 0.02 * e.weight * a;
          p.vx += (dx / d) * f;
          p.vy += (dy / d) * f;
          q.vx -= (dx / d) * f;
          q.vy -= (dy / d) * f;
        });
        // cluster centroids pull members together
        const cent = new Map<number, { x: number; y: number; n: number }>();
        arr.forEach(([n, p]) => {
          const c = cent.get(n.clusterId) || { x: 0, y: 0, n: 0 };
          c.x += p.x;
          c.y += p.y;
          c.n++;
          cent.set(n.clusterId, c);
        });
        arr.forEach(([n, p]) => {
          const c = cent.get(n.clusterId)!;
          if (n.clusterId) {
            p.vx += (c.x / c.n - p.x) * 0.01 * a;
            p.vy += (c.y / c.n - p.y) * 0.01 * a;
          }
          p.vx += (W / 2 - p.x) * 0.002 * a;
          p.vy += (H / 2 - p.y) * 0.002 * a;
          if (drag.current !== n.id) {
            p.x += p.vx;
            p.y += p.vy;
          }
          p.vx *= 0.6;
          p.vy *= 0.6;
          p.x = Math.max(20, Math.min(W - 20, p.x));
          p.y = Math.max(20, Math.min(H - 20, p.y));
        });
        alpha.current *= 0.985;
        tick((t) => t + 1);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [nodes, edges]);

  const toLocal = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const color = (n: SocialPostNode) =>
    clusters.find((c) => c.id === n.clusterId)?.color || "#475569";
  const dim = (n: SocialPostNode) => filter != null && n.clusterId !== filter;
  const neighbours = new Set(
    selected
      ? edges
          .filter((e) => e.source === selected || e.target === selected)
          .flatMap((e) => [e.source, e.target])
      : [],
  );

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${W} ${H}`}
      className="h-[440px] w-full touch-none select-none rounded-lg bg-[#030712]"
      onPointerMove={(e) => {
        if (drag.current) {
          const p = pos.current.get(drag.current)!;
          Object.assign(p, toLocal(e));
          alpha.current = Math.max(alpha.current, 0.3);
        }
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerLeave={() => (drag.current = null)}
      onClick={() => onSelect(null)}
    >
      <defs>
        <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M30 0H0V30" fill="none" stroke="#0f172a" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#grid)" />
      {edges.map((e) => {
        const p = pos.current.get(e.source),
          q = pos.current.get(e.target);
        if (!p || !q) return null;
        const hl = selected && (e.source === selected || e.target === selected);
        return (
          <line
            key={e.id}
            x1={p.x}
            y1={p.y}
            x2={q.x}
            y2={q.y}
            stroke={EDGE_COLOR[e.coordinationType]}
            strokeOpacity={hl ? 0.95 : selected ? 0.08 : 0.35}
            strokeWidth={hl ? 2.2 : 0.6 + e.weight * 1.4}
          >
            <title>{e.description}</title>
          </line>
        );
      })}
      {nodes.map((n) => {
        const p = pos.current.get(n.id);
        if (!p) return null;
        const r = n.amplificationWeight * 0.9;
        const on = selected === n.id;
        const faded = dim(n) || (selected && !on && !neighbours.has(n.id));
        return (
          <g
            key={n.id}
            role="button"
            tabIndex={0}
            aria-label={`Inspect ${n.accountHandle}`}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(n.id);
              }
            }}
            transform={`translate(${p.x},${p.y})`}
            opacity={faded ? 0.2 : 1}
            className="cursor-pointer"
            onPointerDown={(e) => {
              e.stopPropagation();
              drag.current = n.id;
              (e.target as Element).setPointerCapture?.(e.pointerId);
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(n.id);
            }}
          >
            {n.suspicious && (
              <circle
                r={r + 5}
                fill="none"
                stroke={color(n)}
                strokeOpacity={0.35}
                strokeWidth={1}
              />
            )}
            <circle
              r={r}
              fill={color(n)}
              fillOpacity={n.clusterId ? 0.85 : 0.5}
              stroke={on ? "#fff" : "#020617"}
              strokeWidth={on ? 2.5 : 1.5}
            />
            <text
              y={r + 11}
              textAnchor="middle"
              fontSize="9"
              fill="#94a3b8"
              fontFamily="JetBrains Mono, monospace"
            >
              {n.accountHandle.slice(0, 16)}
            </text>
            <title>{`${n.accountHandle} · ${n.language} · click for relationship evidence`}</title>
          </g>
        );
      })}
    </svg>
  );
};

export const EDGE_LEGEND = EDGE_COLOR;

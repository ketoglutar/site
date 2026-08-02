import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { SiteCopy } from "@/lib/copy";
import { StarMark } from "./StarMark";
import { ViewportVideo } from "./ViewportVideo";

export type OrbitItem = {
  id: string;
  src: string;
  poster?: string;
  title: string;
  type: string;
};

type VideoOrbitProps = {
  copy: SiteCopy["orbit"];
  items: OrbitItem[];
  onSelect?: (item: OrbitItem) => void;
};

export function VideoOrbit({ copy, items, onSelect }: VideoOrbitProps) {
  const pointerStart = useRef(0);
  const angleStart = useRef(0);
  const velocity = useRef(0);
  const previousX = useRef(0);
  const previousTime = useRef(0);
  const animationFrame = useRef(0);
  const moved = useRef(false);
  const [angle, setAngle] = useState(0);
  const [dragging, setDragging] = useState(false);

  const displayItems = useMemo(() => {
    if (!items.length) return [];
    return Array.from({ length: Math.max(9, items.length) }, (_, index) => ({
      ...items[index % items.length],
      displayId: `${items[index % items.length].id}-${index}`,
    }));
  }, [items]);

  useEffect(() => {
    if (dragging || !displayItems.length) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    const coast = () => {
      velocity.current *= 0.94;
      const idle = Math.abs(velocity.current) < 0.008 ? 0.018 : velocity.current;
      setAngle((current) => current + idle);
      animationFrame.current = window.requestAnimationFrame(coast);
    };
    animationFrame.current = window.requestAnimationFrame(coast);
    return () => window.cancelAnimationFrame(animationFrame.current);
  }, [displayItems.length, dragging]);

  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    moved.current = false;
    pointerStart.current = event.clientX;
    angleStart.current = angle;
    previousX.current = event.clientX;
    previousTime.current = performance.now();
    velocity.current = 0;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const now = performance.now();
    const delta = event.clientX - pointerStart.current;
    if (Math.abs(delta) > 6) moved.current = true;
    const nextAngle = angleStart.current + delta * 0.12;
    const elapsed = Math.max(now - previousTime.current, 1);
    velocity.current = ((event.clientX - previousX.current) / elapsed) * 2.8;
    previousX.current = event.clientX;
    previousTime.current = now;
    setAngle(nextAngle);
  };

  const up = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  };

  const layouts = displayItems.map((item, index) => {
    const phase = ((360 / displayItems.length) * index + angle) * (Math.PI / 180);
    const depth = Math.cos(phase);
    return {
      item,
      depth,
      x: Math.sin(phase) * 46,
      y: Math.sin(phase * 2) * 11,
      scale: 0.44 + ((depth + 1) / 2) * 0.64,
      opacity: 0.12 + ((depth + 1) / 2) * 0.88,
      blur: (1 - (depth + 1) / 2) * 3.5,
      rotation: Math.sin(phase) * -8,
    };
  });
  const active =
    layouts.reduce<(typeof layouts)[number] | null>(
      (front, item) => (!front || item.depth > front.depth ? item : front),
      null,
    ) ?? null;

  return (
    <section className="orbit-section" id="orbit" aria-labelledby="orbit-title">
      <header className="orbit-section__head">
        <span className="section-kicker">
          <StarMark />
          {copy.eyebrow}
        </span>
        <h2 id="orbit-title">{copy.title.replace("\n", " ")}</h2>
        <span className="orbit-section__hint">{copy.hint} ↔</span>
      </header>

      <div
        aria-label={copy.hint}
        className={`infinite-menu${dragging ? " is-dragging" : ""}`}
        onPointerCancel={up}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          velocity.current = 0;
          setAngle((current) => current + (event.key === "ArrowLeft" ? -12 : 12));
        }}
        role="group"
        tabIndex={0}
      >
        <div className="infinite-menu__field" aria-hidden="true" />
        {layouts.map(({ item, x, y, scale, opacity, blur, rotation, depth }) => {
          const isActive = item.displayId === active?.item.displayId;
          return (
            <button
              aria-label={item.title}
              className={`infinite-disc${isActive ? " is-active" : ""}`}
              key={item.displayId}
              onClick={() => {
                if (moved.current) {
                  moved.current = false;
                  return;
                }
                if (isActive) onSelect?.(item);
              }}
              style={
                {
                  "--disc-x": `${x}vw`,
                  "--disc-y": `${y}vh`,
                  "--disc-scale": scale,
                  "--disc-opacity": opacity,
                  "--disc-blur": `${blur}px`,
                  "--disc-rotation": `${rotation}deg`,
                  zIndex: Math.round((depth + 1) * 50),
                } as CSSProperties
              }
              tabIndex={-1}
              type="button"
            >
              {isActive ? (
                <ViewportVideo
                  loop
                  muted
                  playsInline
                  poster={item.poster}
                  preload="metadata"
                  src={item.src}
                />
              ) : item.poster ? (
                <img alt="" decoding="async" loading="lazy" src={item.poster} />
              ) : (
                <i className="infinite-disc__placeholder" aria-hidden="true" />
              )}
              <span>{item.title}</span>
            </button>
          );
        })}

        <div className="infinite-menu__active">
          <strong>{active?.item.title}</strong>
          <span>{active?.item.type}</span>
        </div>
        <button
          aria-label={active?.item.title}
          className="infinite-menu__open"
          onClick={() => active && onSelect?.(active.item)}
          type="button"
        >
          ↗
        </button>
      </div>
    </section>
  );
}

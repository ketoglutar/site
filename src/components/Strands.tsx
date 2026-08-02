import { useEffect, useRef } from "react";

const COLORS = ["#89BFF6", "#4376B9", "#A1ECFE", "#226CB7"];

export function Strands() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvas.current) return;

    const element = canvas.current;
    const context = element.getContext("2d");
    if (!context) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const pointer = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    let width = 1;
    let height = 1;
    let frame = 0;

    const resize = () => {
      const rect = element.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio, 1.7);
      width = rect.width;
      height = rect.height;
      element.width = Math.max(1, Math.round(width * ratio));
      element.height = Math.max(1, Math.round(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const handlePointer = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      target.x = (event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5;
      target.y = (event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5;
    };

    const observer = new ResizeObserver(resize);
    observer.observe(element);
    window.addEventListener("pointermove", handlePointer, { passive: true });
    resize();

    const startedAt = performance.now();
    let isVisible = false;
    const scheduleRender = () => {
      if (frame || !isVisible || document.hidden) return;
      frame = window.requestAnimationFrame(render);
    };
    const render = (timestamp: number) => {
      frame = 0;
      const time = reduceMotion ? 1.1 : (timestamp - startedAt) / 1000;
      pointer.x += (target.x - pointer.x) * 0.035;
      pointer.y += (target.y - pointer.y) * 0.035;
      context.clearRect(0, 0, width, height);
      context.save();
      context.globalCompositeOperation = "lighter";

      COLORS.forEach((color, index) => {
        const lane = (index - 1.5) * 17;
        const amplitude = 38 + index * 8;
        const phase = time * (0.28 + index * 0.035) + index * 1.22;
        const centerY = height * 0.48 + lane + pointer.y * 34;
        const gradient = context.createLinearGradient(
          width * 0.17,
          centerY,
          width * 0.83,
          centerY,
        );
        gradient.addColorStop(0, "transparent");
        gradient.addColorStop(0.28, color);
        gradient.addColorStop(0.72, color);
        gradient.addColorStop(1, "transparent");

        context.beginPath();
        context.moveTo(width * 0.14, centerY);
        for (let step = 1; step <= 100; step += 1) {
          const progress = step / 100;
          const envelope = Math.sin(progress * Math.PI);
          const x = width * (0.14 + progress * 0.72);
          const y =
            centerY +
            Math.sin(progress * 8.4 + phase) * amplitude * envelope +
            Math.sin(progress * 3.1 - phase * 0.72) * 12 * envelope +
            pointer.x * 26 * envelope;
          context.lineTo(x, y);
        }
        context.strokeStyle = gradient;
        context.lineWidth = 1.2 + index * 0.45;
        context.shadowBlur = 15 + index * 6;
        context.shadowColor = color;
        context.globalAlpha = 0.72 - index * 0.08;
        context.stroke();
      });

      context.restore();
      if (!reduceMotion) scheduleRender();
    };
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible) scheduleRender();
        else if (frame) {
          window.cancelAnimationFrame(frame);
          frame = 0;
        }
      },
      { rootMargin: "120px 0px" },
    );
    const onVisibilityChange = () => {
      if (document.hidden && frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      } else {
        scheduleRender();
      }
    };
    visibilityObserver.observe(element);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", handlePointer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      observer.disconnect();
      visibilityObserver.disconnect();
    };
  }, []);

  return <canvas className="strands" ref={canvas} aria-hidden="true" />;
}

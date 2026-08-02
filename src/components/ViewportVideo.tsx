import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from "react";

type ViewportVideoProps = Omit<
  ComponentPropsWithoutRef<"video">,
  "autoPlay" | "ref"
>;

export function ViewportVideo(props: ViewportVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isNearViewport = useRef(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const { preload = "metadata", src, ...videoProps } = props;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        isNearViewport.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          setShouldLoad(true);
        } else {
          video.pause();
        }
      },
      {
        rootMargin: "180px 0px",
        threshold: 0.08,
      },
    );

    const onVisibilityChange = () => {
      if (document.hidden) {
        video.pause();
      } else if (isNearViewport.current && !reduceMotion) {
        void video.play().catch(() => undefined);
      }
    };

    observer.observe(video);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldLoad || document.hidden) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (isNearViewport.current) void video.play().catch(() => undefined);
  }, [shouldLoad, src]);

  return (
    <video
      {...videoProps}
      preload={shouldLoad ? preload : "none"}
      ref={videoRef}
      src={shouldLoad ? src : undefined}
    />
  );
}

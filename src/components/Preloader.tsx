import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { DiaTextReveal } from "@/registry/magicui/dia-text-reveal";
import { StarMark } from "./StarMark";

type PreloaderProps = {
  onComplete: () => void;
};

const BRAND_LETTERS = Array.from("MATVIX");

export function Preloader({ onComplete }: PreloaderProps) {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const navigation = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming | undefined;
    const skipIntro = params.get("intro") === "0";

    if (skipIntro) {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("intro");
      window.history.replaceState(
        window.history.state,
        "",
        `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`,
      );
    }

    if (skipIntro && navigation?.type !== "reload") {
      onComplete();
      return;
    }

    const media = gsap.matchMedia();

    media.add(
      {
        isDesktop: "(min-width: 761px)",
        isMobile: "(max-width: 760px)",
        reduceMotion: "(prefers-reduced-motion: reduce)",
      },
      (context) => {
        const { isMobile, reduceMotion } = context.conditions as {
          isMobile: boolean;
          reduceMotion: boolean;
        };
        const preloader = root.current;
        const heroBrand = document.querySelector<HTMLElement>(".hero-brand");
        const wordmark =
          preloader?.querySelector<HTMLElement>(".preloader__wordmark");
        const star = preloader?.querySelector<SVGSVGElement>(".preloader__star");
        const helloGlyphs = Array.from(
          preloader?.querySelectorAll<HTMLElement>(
            ".preloader__hello .dia-text__glyph",
          ) ?? [],
        );

        if (!preloader || !heroBrand || !wordmark || !star) {
          onComplete();
          return;
        }

        const heroMasks = Array.from(
          heroBrand.querySelectorAll<HTMLElement>(".hero-brand__mask"),
        );

        const alignWordmark = () => {
          const rect = heroBrand.getBoundingClientRect();
          gsap.set(wordmark, {
            x: rect.left,
            y: rect.top,
            width: rect.width,
          });
        };

        const getTextBounds = () => {
          const first = heroMasks.at(0)?.getBoundingClientRect();
          const last = heroMasks.at(-1)?.getBoundingClientRect();
          const heroRect = heroBrand.getBoundingClientRect();

          if (!first || !last) return heroRect;

          return {
            left: first.left,
            right: last.right,
            top: Math.min(first.top, last.top),
            bottom: Math.max(first.bottom, last.bottom),
            width: last.right - first.left,
            height: Math.max(first.bottom, last.bottom) - Math.min(first.top, last.top),
            x: first.left,
            y: Math.min(first.top, last.top),
            toJSON: () => "",
          } as DOMRect;
        };

        const getDockMetrics = () => {
          const text = getTextBounds();
          const diameter = gsap.utils.clamp(
            isMobile ? 24 : 28,
            isMobile ? 34 : 42,
            text.height * (isMobile ? 0.31 : 0.28),
          );
          const gap = isMobile ? 8 : 14;
          const unclampedCenterX = text.left - gap - diameter / 2;
          const centerX = Math.max(diameter / 2 + 8, unclampedCenterX);

          return {
            x: centerX - window.innerWidth / 2,
            y: text.top + text.height / 2 - window.innerHeight / 2,
            scale: diameter / star.clientWidth,
          };
        };

        const flightStart = 0.42;
        const flightDuration = isMobile ? 2.75 : 2.85;
        const flightEaseName = isMobile ? "power2.inOut" : "sine.inOut";
        const flightEase = gsap.parseEase(flightEaseName);
        const startCenterX = window.innerWidth * -0.28;
        const endCenterX = window.innerWidth * 1.28;
        const flightStarRadius =
          star.clientWidth * (isMobile ? 0.39 : 0.35);
        const revealLead = flightStarRadius * (isMobile ? 0.12 : 0.22);
        const invertEase = (target: number) => {
          let low = 0;
          let high = 1;

          for (let index = 0; index < 18; index += 1) {
            const middle = (low + high) / 2;
            if (flightEase(middle) < target) low = middle;
            else high = middle;
          }

          return (low + high) / 2;
        };
        const glyphRevealTimes = helloGlyphs.map((glyph) => {
          const rect = glyph.getBoundingClientRect();
          const revealCenterX = isMobile
            ? rect.left + rect.width / 2 - revealLead
            : rect.right + star.clientWidth * 0.52;
          const progress = gsap.utils.clamp(
            0,
            1,
            (revealCenterX - startCenterX) / (endCenterX - startCenterX),
          );

          return (
            flightStart +
            invertEase(progress) * flightDuration +
            (isMobile ? 0.015 : -0.02)
          );
        });

        alignWordmark();
        const resizeObserver = new ResizeObserver(alignWordmark);
        resizeObserver.observe(heroBrand);
        window.addEventListener("resize", alignWordmark);

        gsap.set(star, {
          x: "-78vw",
          y: 0,
          xPercent: -50,
          yPercent: -50,
          scale: isMobile ? 0.86 : 1.28,
          rotation: -18,
          autoAlpha: 0,
          transformOrigin: "50% 50%",
        });
        gsap.set(".preloader__hello", {
          autoAlpha: 1,
          xPercent: -50,
          yPercent: -50,
          y: 0,
          scale: 1,
          filter: "blur(0px)",
        });
        gsap.set(helloGlyphs, {
          autoAlpha: 0,
          yPercent: isMobile ? 50 : 34,
          skewX: isMobile ? -7 : -4,
          filter: isMobile ? "blur(15px)" : "blur(11px)",
        });
        gsap.set(wordmark, { autoAlpha: 1 });
        gsap.set(".preloader__wordmark-letter", {
          autoAlpha: 0,
          yPercent: isMobile ? 54 : 46,
          filter: "blur(14px)",
        });
        gsap.set(".preloader__trail", {
          x: "-78vw",
          xPercent: -100,
          yPercent: -50,
          scaleX: 0.25,
          transformOrigin: "100% 50%",
          autoAlpha: 0,
        });
        const timeline = gsap.timeline({
          defaults: { ease: "power3.inOut" },
          onComplete,
        });

        if (reduceMotion) {
          const dock = getDockMetrics();
          timeline
            .to({}, { duration: 0.2 })
            .set(".preloader__hello .dia-text__glyph", {
              autoAlpha: 1,
              yPercent: 0,
              skewX: 0,
              filter: "blur(0px)",
            })
            .to({}, { duration: 0.35 })
            .to(".preloader__hello", { autoAlpha: 0, duration: 0.2 })
            .set(".preloader__wordmark-letter", {
              autoAlpha: 1,
              yPercent: 0,
              filter: "blur(0px)",
            })
            .set(star, {
              x: dock.x,
              y: dock.y,
              scale: dock.scale,
              rotation: 180,
              autoAlpha: 1,
            })
            .to({}, { duration: 0.35 })
            .to(".preloader__surface", {
              clipPath: "inset(0 0 100% 0)",
              duration: 0.4,
              ease: "power2.inOut",
            });

          return () => {
            resizeObserver.disconnect();
            window.removeEventListener("resize", alignWordmark);
          };
        }

        timeline
          // The star becomes visible while it is still fully outside the viewport.
          .set(star, { autoAlpha: 1 }, flightStart)
          .to(
            star,
            {
              x: "78vw",
              y: 0,
              scale: isMobile ? 0.7 : 1.15,
              rotation: 58,
              duration: flightDuration,
              ease: flightEaseName,
            },
            flightStart,
          )
          .to(
            ".preloader__trail",
            {
              x: "78vw",
              scaleX: 1,
              autoAlpha: isMobile ? 0.58 : 0.44,
              duration: flightDuration,
              ease: flightEaseName,
            },
            flightStart,
          )
          .set(".preloader__trail", { autoAlpha: 0 }, flightStart + flightDuration);

        // Reveal under the star so the text is already visible as its glow clears.
        helloGlyphs.forEach((glyph, index) => {
          timeline.to(
            glyph,
            {
              autoAlpha: 1,
              yPercent: 0,
              skewX: 0,
              filter: "blur(0px)",
              duration: isMobile ? 0.44 : 0.32,
              ease: "power3.out",
            },
            glyphRevealTimes[index],
          );
        });

        timeline
          .to(
            ".preloader__trail",
            {
              autoAlpha: 0,
              duration: 0.34,
              ease: "power2.out",
            },
            flightStart + 2.18,
          )
          .to(
            ".preloader__hello",
            {
              autoAlpha: 0,
              y: -8,
              scale: 0.992,
              filter: "blur(10px)",
              duration: 0.68,
              ease: "power2.inOut",
            },
            3.28,
          )
          .to(
            ".preloader__wordmark-letter",
            {
              autoAlpha: 1,
              yPercent: 0,
              filter: "blur(0px)",
              duration: 0.9,
              stagger: 0.055,
              ease: "power4.out",
            },
            3.55,
          )
          .to(
            star,
            {
              x: () => getDockMetrics().x,
              y: () => getDockMetrics().y,
              scale: () => getDockMetrics().scale,
              rotation: 270,
              duration: 1.5,
              ease: "expo.inOut",
            },
            3.36,
          )
          .to({}, { duration: 0.82 })
          .to(".preloader__surface", {
            clipPath: "inset(0 0 100% 0)",
            duration: 1,
            ease: "power4.inOut",
          });

        return () => {
          resizeObserver.disconnect();
          window.removeEventListener("resize", alignWordmark);
        };
      },
      root,
    );

    return () => media.revert();
  }, [onComplete]);

  return (
    <div className="preloader" ref={root} aria-live="polite">
      <div className="preloader__surface">
        <div className="preloader__grid" />
        <div className="preloader__trail" />
        <StarMark className="preloader__star" />
        <div className="preloader__hello">
          <DiaTextReveal
            className="preloader__hello-text"
            colors={["#ffffff", "#A1ECFE", "#89BFF6", "#4376B9"]}
            text="Hello"
          />
        </div>
        <div className="preloader__wordmark" aria-label="Matvix">
          {BRAND_LETTERS.map((letter, index) => (
            <span
              className="preloader__wordmark-mask"
              key={`${letter}-${index}`}
            >
              <span className="preloader__wordmark-letter">{letter}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

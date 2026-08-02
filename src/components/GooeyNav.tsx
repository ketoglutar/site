import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Language, SiteCopy } from "@/lib/copy";
import { StarMark } from "./StarMark";

type GooeyNavProps = {
  language: Language;
  labels: SiteCopy["nav"];
  onLanguageChange: (language: Language) => void;
  onAdminOpen: () => void;
};

type Burst = {
  id: number;
  angle: number;
  distance: number;
  scale: number;
};

export function GooeyNav({
  language,
  labels,
  onLanguageChange,
  onAdminOpen,
}: GooeyNavProps) {
  const [active, setActive] = useState("work");
  const [hidden, setHidden] = useState(false);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const burstId = useRef(0);

  useEffect(() => {
    const sectionLinks = [
      ["work", "work"],
      ["about", "about"],
      ["orbit", "work"],
      ["contact", "contact"],
    ] as const;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => second.intersectionRatio - first.intersectionRatio);
        const section = sectionLinks.find(([id]) => id === visible[0]?.target.id);
        if (section) setActive(section[1]);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0.1, 0.35, 0.7] },
    );
    sectionLinks.forEach(([id]) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    let lastY = window.scrollY;
    let ticking = false;
    const scroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const currentY = window.scrollY;
        if (currentY < window.innerHeight * 0.55) setActive("work");
        setHidden(currentY > lastY && currentY > 160);
        lastY = currentY;
        ticking = false;
      });
    };
    window.addEventListener("scroll", scroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", scroll);
    };
  }, []);

  const triggerBurst = () => {
    const next = Array.from({ length: 12 }, (_, index) => ({
      id: burstId.current + index,
      angle: (360 / 12) * index + Math.random() * 14,
      distance: 18 + Math.random() * 22,
      scale: 0.55 + Math.random() * 0.7,
    }));
    burstId.current += next.length;
    setBursts(next);
    window.setTimeout(() => setBursts([]), 720);
  };

  const scrollBehavior = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";

  const goTo = (id: string) => {
    setActive(id);
    triggerBurst();
    document.getElementById(id)?.scrollIntoView({ behavior: scrollBehavior() });
  };

  return (
    <header className={`site-header${hidden ? " site-header--hidden" : ""}`}>
      <div className="nav-shell">
        <button
          className="nav-brand"
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: scrollBehavior() })}
          aria-label={labels.topLabel}
        >
          <StarMark className="nav-brand__star" />
          <span>MATVIX</span>
        </button>

        <nav className="nav-links" aria-label={labels.primaryLabel}>
          {(["work", "about", "contact"] as const).map((id) => (
            <button
              aria-current={active === id ? "page" : undefined}
              className={active === id ? "is-active" : ""}
              key={id}
              onClick={() => goTo(id)}
              type="button"
            >
              <span>{labels[id]}</span>
              {active === id ? (
                <span className="nav-bursts" aria-hidden="true">
                  {bursts.map((burst) => (
                    <i
                      key={burst.id}
                      style={
                        {
                          "--burst-angle": `${burst.angle}deg`,
                          "--burst-distance": `${burst.distance}px`,
                          "--burst-scale": burst.scale,
                        } as CSSProperties
                      }
                    />
                  ))}
                </span>
              ) : null}
            </button>
          ))}
          <button
            className="nav-links__admin"
            onClick={() => {
              triggerBurst();
              onAdminOpen();
            }}
            type="button"
          >
            {labels.admin}
          </button>
        </nav>

        <div
          aria-label={labels.languageLabel}
          className="language-switch"
          role="group"
        >
          {(["ru", "en"] as const).map((option) => (
            <button
              aria-pressed={language === option}
              className={language === option ? "is-active" : ""}
              key={option}
              onClick={() => onLanguageChange(option)}
              type="button"
            >
              {option.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { AdminPanel } from "@/components/AdminPanel";
import { CustomCursor } from "@/components/CustomCursor";
import { GooeyNav } from "@/components/GooeyNav";
import { MagneticButton, MagneticLink } from "@/components/MagneticLink";
import { Preloader } from "@/components/Preloader";
import { StarMark } from "@/components/StarMark";
import { Strands } from "@/components/Strands";
import { VideoOrbit, type OrbitItem } from "@/components/VideoOrbit";
import { ViewportVideo } from "@/components/ViewportVideo";
import { copy, type Language } from "@/lib/copy";
import { readVideos, type StoredVideo } from "@/lib/video-store";

gsap.registerPlugin(ScrollTrigger);

const LightPillar = lazy(() => import("@/components/LightPillar"));

type PortfolioItem = OrbitItem & {
  note: string;
  start: number;
  isUpload?: boolean;
};

const BRAND_LETTERS = Array.from("MATVIX");
const assetUrl = (path: string) =>
  `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;

const PORTFOLIO_ASSETS = [
  {
    id: "arcana-reel",
    src: assetUrl("media/portfolio/arcana-reel.mp4"),
    poster: assetUrl("media/portfolio/arcana-reel.webp"),
    title: "Arcana Reel",
    type: { ru: "Монтаж · Соцсети", en: "Social Edit" },
    note: {
      ru: "Плотный вертикальный монтаж с акцентом на темп, контраст и удержание внимания.",
      en: "A tightly paced vertical edit built around contrast, rhythm and retention.",
    },
  },
  {
    id: "back-to-the-moon",
    src: assetUrl("media/portfolio/back-to-the-moon.mp4"),
    poster: assetUrl("media/portfolio/back-to-the-moon.webp"),
    title: "Back to the Moon",
    type: { ru: "Бренд-фильм · Звук", en: "Brand Film · Sound" },
    note: {
      ru: "Атмосферная история, где монтаж и звук работают как одна драматургическая система.",
      en: "An atmospheric story where editing and sound shape a single narrative.",
    },
  },
  {
    id: "complex-motion-google",
    src: assetUrl("media/portfolio/complex-motion-google.mp4"),
    poster: assetUrl("media/portfolio/complex-motion-google.webp"),
    title: "Google / Complex Motion",
    type: { ru: "Моушн-графика", en: "Motion Graphics" },
    note: {
      ru: "Сложная графическая система превращена в ясную и ритмичную историю о продукте.",
      en: "A complex visual system shaped into a clear, rhythmic product story.",
    },
  },
  {
    id: "routine-1-2",
    src: assetUrl("media/portfolio/routine-1-2.mp4"),
    poster: assetUrl("media/portfolio/routine-1-2.webp"),
    title: "Routine 1.2",
    type: { ru: "Продуктовый релиз", en: "Product Launch" },
    note: {
      ru: "Релизный ролик с точной иерархией, чистой типографикой и выверенным темпом.",
      en: "A launch film with precise hierarchy, clean typography and controlled pacing.",
    },
  },
  {
    id: "sass-animation-explainer",
    src: assetUrl("media/portfolio/sass-animation-explainer.mp4"),
    poster: assetUrl("media/portfolio/sass-animation-explainer.webp"),
    title: "SaaS Animation Explainer",
    type: { ru: "Объясняющий ролик · Моушн", en: "Product Explainer" },
    note: {
      ru: "Продуктовая анимация, которая объясняет механику без лишнего визуального шума.",
      en: "Product animation that explains how the product works without unnecessary visual noise.",
    },
  },
  {
    id: "supreme-reel",
    src: assetUrl("media/portfolio/supreme-reel.mp4"),
    poster: assetUrl("media/portfolio/supreme-reel.webp"),
    title: "Supreme Reel",
    type: { ru: "Мода · Соцсети", en: "Fashion / Social" },
    note: {
      ru: "Динамичный вертикальный ролик с резкими акцентами и выразительным ритмом.",
      en: "A vertical fashion edit with sharp accents and expressive momentum.",
    },
  },
  {
    id: "viral-earnedits",
    src: assetUrl("media/portfolio/viral-earnedits.mp4"),
    poster: assetUrl("media/portfolio/viral-earnedits.webp"),
    title: "Viral / EarnEdits",
    type: { ru: "Вирусный рилс", en: "Viral Reel" },
    note: {
      ru: "Короткий ролик с мгновенным хуком и высоким темпом.",
      en: "A short-form edit designed to hook attention from the first frame.",
    },
  },
  {
    id: "viral-julian-alborna",
    src: assetUrl("media/portfolio/viral-julian-alborna.mp4"),
    poster: assetUrl("media/portfolio/viral-julian-alborna.webp"),
    title: "Viral / Julian Alborna",
    type: { ru: "Монтаж для соцсетей", en: "Social Edit" },
    note: {
      ru: "Выразительный ролик для соцсетей с точными паузами, сменой масштаба и акцентной типографикой.",
      en: "An expressive social edit built on precise pauses, shifts in scale and bold typographic hits.",
    },
  },
  {
    id: "viral-reel",
    src: assetUrl("media/portfolio/viral-reel.mp4"),
    poster: assetUrl("media/portfolio/viral-reel.webp"),
    title: "Viral Reel",
    type: { ru: "Короткий формат", en: "Short-Form Edit" },
    note: {
      ru: "Быстрый вертикальный монтаж, в котором каждый кадр подталкивает к следующему.",
      en: "A fast vertical edit where every frame propels the next one.",
    },
  },
] as const;

function App() {
  const [language, setLanguage] = useState<Language>(() =>
    localStorage.getItem("matvix-language") === "en" ? "en" : "ru",
  );
  const [introComplete, setIntroComplete] = useState(false);
  const [introKey, setIntroKey] = useState(0);
  const [adminOpen, setAdminOpen] = useState(false);
  const [records, setRecords] = useState<StoredVideo[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<
    Array<{ id: string; src: string }>
  >([]);
  const [selectedVideo, setSelectedVideo] = useState<PortfolioItem | null>(null);
  const [emailCopyState, setEmailCopyState] = useState<
    "idle" | "copied" | "error"
  >("idle");
  const emailCopiedTimer = useRef<number | null>(null);
  const videoModal = useRef<HTMLDivElement>(null);
  const videoModalClose = useRef<HTMLButtonElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const text = copy[language];
  const emailCopied = emailCopyState === "copied";
  const emailCopyError = emailCopyState === "error";
  const emailCopyErrorLabel =
    language === "ru" ? "Не удалось скопировать" : "Copy failed";
  const [aboutTitlePrimary, aboutTitleAccent] = text.about.title.split("\n");
  const [contactTitlePrimary, contactTitleAccent] = text.contact.title.split("\n");

  useEffect(() => {
    readVideos().then(setRecords).catch(() => setRecords([]));
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem("matvix-language", language);
    document.title =
      language === "ru"
        ? "MATVIX — моушн-дизайн и монтаж"
        : "MATVIX — Motion with intent";
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", text.hero.statement);
  }, [language, text.hero.statement]);

  useEffect(
    () => () => {
      if (emailCopiedTimer.current !== null) {
        window.clearTimeout(emailCopiedTimer.current);
      }
    },
    [],
  );

  useEffect(() => {
    const locked = !introComplete || adminOpen || Boolean(selectedVideo);
    document.body.classList.toggle("is-locked", locked);
    return () => document.body.classList.remove("is-locked");
  }, [adminOpen, introComplete, selectedVideo]);

  useEffect(() => {
    if (!selectedVideo) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusFrame = window.requestAnimationFrame(() =>
      videoModalClose.current?.focus(),
    );
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSelectedVideo(null);
        return;
      }
      if (event.key !== "Tab" || !videoModal.current) return;
      const focusable = Array.from(
        videoModal.current.querySelectorAll<HTMLElement>(
          'button, a[href], video[controls], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [selectedVideo]);

  useEffect(() => {
    const nextUrls = records.map((record) => ({
      id: record.id,
      src: URL.createObjectURL(record.blob),
    }));
    setUploadedUrls(nextUrls);
    return () => nextUrls.forEach((item) => URL.revokeObjectURL(item.src));
  }, [records]);

  const uploadedUrlMap = useMemo(
    () =>
      Object.fromEntries(uploadedUrls.map((item) => [item.id, item.src])) as Record<
        string,
        string
      >,
    [uploadedUrls],
  );

  const portfolioItems = useMemo<PortfolioItem[]>(() => {
    const uploads = records.flatMap((record, index) => {
      const src = uploadedUrlMap[record.id];
      if (!src) return [];
      return [
        {
          id: record.id,
          src,
          title: record.name,
          type: language === "ru" ? "Локальная загрузка" : "Local upload",
          note:
            language === "ru"
              ? "Добавлено через локальную панель управления."
              : "Added through the local studio console.",
          start: index * 0.65,
          isUpload: true,
        },
      ];
    });

    const builtIn = PORTFOLIO_ASSETS.map((asset, index) => ({
      id: asset.id,
      src: asset.src,
      poster: asset.poster,
      title: asset.title,
      type: asset.type[language],
      note: asset.note[language],
      start: (index * 0.78) % 7.2,
    }));

    return [...uploads, ...builtIn];
  }, [language, records, uploadedUrlMap]);

  const handleIntroComplete = useCallback(() => setIntroComplete(true), []);

  const replayIntro = () => {
    setAdminOpen(false);
    setIntroComplete(false);
    setIntroKey((key) => key + 1);
    window.scrollTo({ top: 0 });
  };

  const preferredScrollBehavior = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";

  const jumpTo = (id: string) => {
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: preferredScrollBehavior() });
  };

  const copyEmail = async () => {
    const email = "1matvix@mail.ru";

    const fallbackCopy = () => {
      const fallback = document.createElement("textarea");
      fallback.value = email;
      fallback.setAttribute("readonly", "");
      fallback.style.position = "fixed";
      fallback.style.opacity = "0";
      document.body.appendChild(fallback);
      fallback.select();
      try {
        return document.execCommand("copy");
      } catch {
        return false;
      } finally {
        fallback.remove();
      }
    };

    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(email);
        copied = true;
      } else {
        copied = fallbackCopy();
      }
    } catch {
      copied = fallbackCopy();
    }

    setEmailCopyState(copied ? "copied" : "error");
    if (emailCopiedTimer.current !== null) {
      window.clearTimeout(emailCopiedTimer.current);
    }
    emailCopiedTimer.current = window.setTimeout(() => {
      setEmailCopyState("idle");
      emailCopiedTimer.current = null;
    }, 5000);
  };

  useLayoutEffect(() => {
    if (!introComplete) return;
    const refreshFrame = window.requestAnimationFrame(() =>
      ScrollTrigger.refresh(),
    );
    return () => window.cancelAnimationFrame(refreshFrame);
  }, [introComplete, language]);

  useLayoutEffect(() => {
    if (!introComplete || !page.current) return;

    const context = gsap.context(() => {
      const media = gsap.matchMedia();
      media.add(
        {
          desktop: "(min-width: 901px)",
          reduceMotion: "(prefers-reduced-motion: reduce)",
        },
        (conditions) => {
          const { desktop, reduceMotion } = conditions.conditions as {
            desktop: boolean;
            reduceMotion: boolean;
          };

          if (!reduceMotion) {
            gsap.fromTo(
              ".hero-copy__meta, .hero-copy__subtitle, .hero-copy__action",
              { y: 18, autoAlpha: 0 },
              {
                y: 0,
                autoAlpha: 1,
                duration: 0.75,
                stagger: 0.1,
                delay: 0.28,
                ease: "power3.out",
              },
            );

            gsap.to(".hero-copy", {
              yPercent: -22,
              autoAlpha: 0,
              ease: "none",
              scrollTrigger: {
                trigger: ".hero",
                start: "34% top",
                end: "bottom top",
                scrub: 0.8,
              },
            });

            gsap.fromTo(
              ".portfolio-card",
              { y: 70, autoAlpha: 0, scale: 0.96 },
              {
                y: 0,
                autoAlpha: 1,
                scale: 1,
                duration: 0.9,
                stagger: 0.065,
                ease: "power3.out",
                scrollTrigger: {
                  trigger: ".portfolio-grid",
                  start: "top 84%",
                  once: true,
                },
              },
            );

            gsap.fromTo(
              "[data-reveal]",
              { y: 45, autoAlpha: 0 },
              {
                y: 0,
                autoAlpha: 1,
                duration: 0.95,
                stagger: 0.07,
                ease: "power3.out",
                scrollTrigger: {
                  trigger: ".approach-section",
                  start: "top 76%",
                  once: true,
                },
              },
            );

            gsap.to(".grain-section__word", {
              backgroundPosition: "100% 50%",
              ease: "none",
              scrollTrigger: {
                trigger: ".grain-section",
                start: "top bottom",
                end: "bottom top",
                scrub: 1,
              },
            });
          }

          if (desktop && !reduceMotion) {
            gsap.to(".approach-card--portrait", {
              yPercent: -12,
              ease: "none",
              scrollTrigger: {
                trigger: ".approach-section",
                start: "top bottom",
                end: "bottom top",
                scrub: 1,
              },
            });
          }
        },
      );

      ScrollTrigger.refresh();
      return () => media.revert();
    }, page);

    return () => context.revert();
  }, [introComplete, portfolioItems.length]);

  return (
    <div className="site" ref={page}>
      {!introComplete ? (
        <Preloader key={introKey} onComplete={handleIntroComplete} />
      ) : null}

      <CustomCursor />
      <GooeyNav
        labels={text.nav}
        language={language}
        onAdminOpen={() => setAdminOpen(true)}
        onLanguageChange={setLanguage}
      />

      <main>
        <section className="hero" id="top" aria-labelledby="hero-title">
          <div className="hero__light-field" aria-hidden="true">
            <Suspense fallback={<div className="hero__light-pillar--loading" />}>
              <LightPillar
                bottomColor="#A1ECFE"
                className="hero__light-pillar"
                glowAmount={0.002}
                intensity={1}
                interactive={false}
                mixBlendMode="screen"
                noiseIntensity={0.5}
                pillarHeight={0.6}
                pillarRotation={25}
                pillarWidth={10}
                quality="high"
                rotationSpeed={0.2}
                topColor="#4376B9"
              />
            </Suspense>
          </div>

          <div className="hero-copy">
            <span className="hero-copy__meta">
              <StarMark />
              {text.hero.eyebrow}
            </span>
            <h1 className="hero-brand" id="hero-title" aria-label="Matvix">
              {BRAND_LETTERS.map((letter, index) => (
                <span className="hero-brand__mask" key={`${letter}-${index}`}>
                  <span className="hero-brand__letter">{letter}</span>
                </span>
              ))}
            </h1>
            <p className="hero-copy__subtitle">{text.hero.statement}</p>
            <button
              className="hero-copy__action"
              onClick={() => jumpTo("work")}
              type="button"
            >
              <span>{text.hero.explore}</span>
              <span aria-hidden="true">↓</span>
            </button>
          </div>

          <div className="hero__coordinates" aria-hidden="true">
            <span>55.7558° N</span>
            <span>37.6173° E</span>
            <span>2025—2026</span>
          </div>
        </section>

        <section className="work-section" id="work" aria-labelledby="work-title">
          <header className="section-head">
            <div>
              <span className="section-kicker">
                <StarMark />
                {text.reel.eyebrow}
              </span>
              <h2 id="work-title">{text.reel.title}</h2>
            </div>
            <p>{text.reel.intro}</p>
          </header>

          <div className="portfolio-grid">
            {portfolioItems.slice(0, 9).map((item, index) => (
              <article className="portfolio-card" key={item.id}>
                <button
                  aria-label={`${text.reel.view}: ${item.title}`}
                  className="portfolio-card__media"
                  onClick={() => setSelectedVideo(item)}
                  type="button"
                >
                  <ViewportVideo
                    loop
                    muted
                    playsInline
                    poster={item.poster}
                    preload="metadata"
                    src={item.src}
                    style={{ "--cut-delay": `${-item.start}s` } as CSSProperties}
                  />
                  <span className="portfolio-card__number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="portfolio-card__open" aria-hidden="true">
                    ↗
                  </span>
                </button>
                <div className="portfolio-card__caption">
                  <strong>{item.title}</strong>
                  <span>{item.type}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          className="approach-section"
          id="about"
          aria-labelledby="approach-title"
        >
          <Strands />
          <div className="approach-section__inner">
            <div className="approach-copy">
              <span className="section-kicker" data-reveal>
                <StarMark />
                {text.about.eyebrow}
              </span>
              <h2
                className={language === "ru" ? "approach-title--ru" : undefined}
                id="approach-title"
                data-reveal
              >
                {aboutTitlePrimary}
                <br />
                <span className="approach-title__accent">{aboutTitleAccent}</span>
              </h2>
              <p data-reveal>{text.about.body}</p>
              <ol className="approach-steps" data-reveal>
                {text.about.facts.map(([number, label]) => (
                  <li key={number}>
                    <span>{number}</span>
                    <strong>{label}</strong>
                  </li>
                ))}
              </ol>
            </div>

            <figure className="approach-card approach-card--portrait" data-reveal>
              <div className="approach-card__frame">
                <img
                  alt={text.about.portraitAlt}
                  decoding="async"
                  loading="lazy"
                  src={assetUrl("media/matvix-portrait.webp")}
                />
                <span className="approach-card__index">
                  {text.about.portraitLabel}
                </span>
              </div>
              <figcaption>
                <strong>MATVEY / MATVIX</strong>
                <span>{text.about.portraitRole}</span>
              </figcaption>
            </figure>
          </div>
        </section>

        <section
          className="grain-section"
          aria-label={text.principle.ariaLabel}
        >
          <div className="grain-section__noise" />
          <span className="grain-section__index">{text.principle.label}</span>
          <h2
            className={`grain-section__word${language === "en" ? " grain-section__word--en" : ""}`}
          >
            {text.principle.title}
          </h2>
          <p>{text.principle.body}</p>
        </section>

        <VideoOrbit
          copy={text.orbit}
          items={portfolioItems}
          onSelect={(item) =>
            setSelectedVideo(portfolioItems.find((source) => source.id === item.id) ?? null)
          }
        />

        <section
          className="contact-section"
          id="contact"
          aria-labelledby="contact-title"
        >
          <ViewportVideo
            aria-hidden="true"
            className="contact-section__film"
            loop
            muted
            playsInline
            preload="metadata"
            src={assetUrl("media/particles.mp4")}
          />
          <div className="contact-section__inner">
            <span className="section-kicker">
              <StarMark />
              {text.contact.eyebrow}
            </span>
            <h2
              className={`contact-title--${language}`}
              id="contact-title"
            >
              <span className="contact-title__primary">{contactTitlePrimary}</span>
              <br />
              <span className="contact-title__accent">{contactTitleAccent}</span>
            </h2>
            <div className="contact-section__actions">
              <MagneticLink
                className="contact-link contact-link--telegram"
                href="https://t.me/bikalic"
                rel="noreferrer"
                target="_blank"
              >
                <span className="contact-link__copy">
                  <strong>{text.contact.telegram}</strong>
                  <small>@bikalic</small>
                </span>
                <i aria-hidden="true">↗</i>
              </MagneticLink>
              <MagneticButton
                aria-label={
                  emailCopied
                    ? text.contact.copied
                    : emailCopyError
                      ? emailCopyErrorLabel
                    : text.contact.mail
                }
                className={`contact-link contact-link--copy${emailCopied ? " is-copied" : ""}${emailCopyError ? " is-error" : ""}`}
                onClick={() => void copyEmail()}
                type="button"
              >
                <span className="contact-link__copy">
                  <strong>
                    {emailCopied
                      ? text.contact.copied
                      : emailCopyError
                        ? emailCopyErrorLabel
                        : text.contact.mail}
                  </strong>
                  <small>
                    {emailCopied ? text.contact.paste : "1matvix@mail.ru"}
                  </small>
                </span>
                <i aria-hidden="true">
                  {emailCopied ? "✓" : emailCopyError ? "!" : "+"}
                </i>
              </MagneticButton>
              <span className="sr-only" aria-live="polite" role="status">
                {emailCopied
                  ? text.contact.copied
                  : emailCopyError
                    ? emailCopyErrorLabel
                    : ""}
              </span>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span className="site-footer__brand">
          <StarMark />
          MATVIX
        </span>
        <span>{text.footer.role}</span>
        <button
          onClick={() =>
            window.scrollTo({ top: 0, behavior: preferredScrollBehavior() })
          }
          type="button"
        >
          {text.footer.top} ↑
        </button>
      </footer>

      <AdminPanel
        copy={text.admin}
        isOpen={adminOpen}
        onClose={() => setAdminOpen(false)}
        onReplayIntro={replayIntro}
        records={records}
        setRecords={setRecords}
        videoUrls={uploadedUrlMap}
      />

      {selectedVideo ? (
        <div
          aria-label={selectedVideo.title}
          aria-modal="true"
          className="video-modal"
          ref={videoModal}
          role="dialog"
        >
          <button
            aria-label={text.admin.close}
            className="video-modal__scrim"
            onClick={() => setSelectedVideo(null)}
            type="button"
          />
          <div className="video-modal__content">
            <header>
              <div>
                <span>{selectedVideo.type}</span>
                <h2>{selectedVideo.title}</h2>
              </div>
              <button
                className="round-button"
                onClick={() => setSelectedVideo(null)}
                ref={videoModalClose}
                type="button"
              >
                <span aria-hidden="true">×</span>
                <span className="sr-only">{text.admin.close}</span>
              </button>
            </header>
            <video
              autoPlay
              controls
              playsInline
              poster={selectedVideo.poster}
              preload="metadata"
              src={selectedVideo.src}
            />
            <p>{selectedVideo.note}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;

import type { CSSProperties } from "react";

type DiaTextRevealProps = {
  text: string;
  colors?: string[];
  className?: string;
  style?: CSSProperties;
};

export function DiaTextReveal({
  text,
  colors = ["#22d3ee", "#818cf8", "#f472b6", "#34d399"],
  className = "",
  style,
}: DiaTextRevealProps) {
  return (
    <span
      className={`dia-text ${className}`}
      style={
        {
          ...style,
          "--dia-gradient": `linear-gradient(115deg, ${colors.join(", ")})`,
        } as CSSProperties
      }
      aria-label={text}
    >
      {Array.from(text).map((character, index) => (
        <span
          aria-hidden="true"
          className="dia-text__glyph"
          key={`${character}-${index}`}
          style={{ "--glyph-index": index } as CSSProperties}
        >
          {character === " " ? "\u00a0" : character}
        </span>
      ))}
    </span>
  );
}

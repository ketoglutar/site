import {
  useRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type PointerEvent as ReactPointerEvent,
} from "react";

function useMagnetic<T extends HTMLElement>() {
  const element = useRef<T>(null);

  const move = (event: ReactPointerEvent<T>) => {
    const target = element.current;
    if (!target) return;
    const bounds = target.getBoundingClientRect();
    const x = event.clientX - bounds.left - bounds.width / 2;
    const y = event.clientY - bounds.top - bounds.height / 2;
    target.style.transform = `translate3d(${x * 0.13}px, ${y * 0.18}px, 0)`;
  };

  const reset = () => {
    if (element.current) element.current.style.transform = "";
  };

  return { element, move, reset };
}

export function MagneticLink({
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { element, move, reset } = useMagnetic<HTMLAnchorElement>();

  return (
    <a
      ref={element}
      onPointerMove={move}
      onPointerLeave={reset}
      {...props}
    >
      {children}
    </a>
  );
}

export function MagneticButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { element, move, reset } = useMagnetic<HTMLButtonElement>();

  return (
    <button
      ref={element}
      onPointerMove={move}
      onPointerLeave={reset}
      {...props}
    >
      {children}
    </button>
  );
}

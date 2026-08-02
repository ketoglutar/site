import type { SVGProps } from "react";

export function StarMark({ className = "", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 100 100"
      {...props}
    >
      <path
        d="M50 0C54.2 33.2 66.8 45.8 100 50C66.8 54.2 54.2 66.8 50 100C45.8 66.8 33.2 54.2 0 50C33.2 45.8 45.8 33.2 50 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

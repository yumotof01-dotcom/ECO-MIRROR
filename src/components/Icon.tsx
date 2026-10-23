import type { SVGProps } from "react";

type IconName =
  | "sprout"
  | "arrow"
  | "external"
  | "layers"
  | "scan"
  | "chart"
  | "info"
  | "reset";

const paths: Record<IconName, string> = {
  sprout:
    "M12 22V10M12 15C4 17 1 9 3 3c7 0 11 5 9 12Zm0-5C13 3 18 1 23 3c0 6-4 10-11 7Z",
  arrow: "M4 12h15m-6-6 6 6-6 6",
  external:
    "M14 3h7v7m0-7L10 14M10 3H4a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6",
  layers: "m12 3 10 5-10 5L2 8l10-5Zm-10 9 10 5 10-5M2 16l10 5 10-5",
  scan: "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M7 12h10M12 7v10",
  chart: "M4 3v17h17M9 15v-4m5 4V7m5 8v-5",
  info: "M12 8h.01M12 11v6M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  reset: "M3 10a9 9 0 1 1 1 8M3 4v6h6",
};

export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}

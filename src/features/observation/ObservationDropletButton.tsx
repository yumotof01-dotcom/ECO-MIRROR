import { useId } from "react";
import type { ExecutionStatus } from "../execution/client";
export function ObservationDropletButton({
  status,
  disabled,
  onClick,
}: {
  status: ExecutionStatus;
  disabled: boolean;
  onClick: () => void;
}) {
  const id = useId(),
    label =
      status === "loading"
        ? "読込中"
        : status === "running"
          ? "観測中"
          : status === "error"
            ? "もう一度観測"
            : status === "cancelled"
              ? "観測を再開"
              : status === "success"
                ? "もう一度観測"
                : "観測を実行";
  return (
    <button
      type="button"
      className={`observation-droplet droplet-${status}`}
      disabled={disabled}
      onClick={onClick}
      aria-label="シミュレーションを実行"
    >
      <svg className="droplet-surface" viewBox="0 0 130 150" aria-hidden="true">
        <defs>
          <linearGradient id={id} x2="1" y2="1">
            <stop stopColor="#92d1b8" stopOpacity=".65" />
            <stop offset=".5" stopColor="#245e60" stopOpacity=".9" />
            <stop offset="1" stopColor="#123b3d" />
          </linearGradient>
        </defs>
        <path
          d="M76 5 C85 7 76 25 89 44 C102 64 126 80 119 108 C112 136 90 146 61 143 C28 141 8 130 10 99 C12 74 39 65 48 43 C56 24 63 0 76 5Z"
          fill={`url(#${id})`}
          stroke="#a1dcc7"
          strokeWidth="1.2"
        />
        <path
          d="M69 18 C58 36 60 49 42 65 M19 100 Q15 125 42 133"
          fill="none"
          stroke="#d5ffdc"
          strokeOpacity=".6"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span>{label}</span>
      <span className="droplet-ripple" aria-hidden="true" />
    </button>
  );
}

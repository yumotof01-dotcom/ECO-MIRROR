/** Original vector scenery. Decorative only; never an observation network. */
export function ForestBackground() {
  return (
    <div className="forest-background" aria-hidden="true">
      <svg
        viewBox="0 0 1600 1000"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <defs>
          <radialGradient id="forest-light" cx="60%" cy="16%" r="83%">
            <stop stopColor="#b8cba0" />
            <stop offset=".27" stopColor="#516e52" />
            <stop offset=".62" stopColor="#153b32" />
            <stop offset="1" stopColor="#041b1b" />
          </radialGradient>
          <linearGradient id="forest-ground" x2="0" y2="1">
            <stop stopColor="#204a39" />
            <stop offset="1" stopColor="#041b1b" />
          </linearGradient>
          <linearGradient id="forest-ray" x2=".5" y2="1">
            <stop stopColor="#f2efb9" stopOpacity=".18" />
            <stop offset="1" stopColor="#edf5d1" stopOpacity="0" />
          </linearGradient>
          <g id="forest-fern">
            <path
              d="M0 100 Q10 15 0 -90"
              fill="none"
              stroke="#6b9365"
              strokeWidth="2"
            />
            {Array.from({ length: 9 }, (_, i) => (
              <g
                key={i}
                transform={`translate(0 ${85 - i * 18}) scale(${1 - i * 0.07})`}
              >
                <path
                  d="M0 0 Q-62 -4 -76 -34 Q-30 -39 0 0 M0 0 Q62 -4 76 -34 Q30 -39 0 0"
                  fill="#416d43"
                  stroke="#6b9365"
                  strokeWidth=".8"
                />
              </g>
            ))}
          </g>
        </defs>
        <path fill="url(#forest-light)" d="M0 0H1600V1000H0Z" />
        <g fill="#214637" opacity=".32">
          {[70, 190, 360, 520, 670, 820, 990, 1160, 1340, 1510].map((x, i) => (
            <path
              key={x}
              d={`M${x} -20 L${x + 8} 800 L${x + 40} 810 L${x + 25} -20Z M${x + 15} 280 Q${x - 100} 160 ${x - 130} 90 Q${x - 50} 165 ${x + 20} 210Z`}
              opacity={0.4 + (i % 3) * 0.15}
            />
          ))}
        </g>
        <g fill="url(#forest-ray)">
          <path d="M900 -20 320 940 800 940 1020 -20Z" />
          <path d="M1030 -20 990 850 1340 930 1110 -20Z" />
        </g>
        <g fill="#072a24">
          {[
            [-70, 120],
            [130, 83],
            [1430, 100],
            [1560, 170],
          ].map(([x, w], i) => (
            <path
              key={x}
              d={`M${x} -60 Q${x + 80} 290 ${x + 20} 640 L${x - 20} 1000 H${x + w + 65} Q${x + w - 70} 440 ${x + w} -60Z`}
              opacity={0.72 + i * 0.05}
            />
          ))}
        </g>
        <g fill="#1b4630" opacity=".88">
          {Array.from({ length: 24 }, (_, i) => (
            <ellipse
              key={i}
              cx={i * 79 - 90}
              cy={20 + (i % 4) * 25}
              rx={125}
              ry={100 + (i % 3) * 20}
              transform={`rotate(${i % 2 ? 18 : -20} ${i * 79} 50)`}
            />
          ))}
        </g>
        <path
          d="M0 820 Q260 730 500 900 Q900 820 1120 880 Q1420 700 1600 820V1000H0Z"
          fill="url(#forest-ground)"
        />
        <g opacity=".9">
          {[
            [-20, 760, 1.6, -24],
            [140, 940, 1.4, 28],
            [310, 1030, 1.3, 12],
            [1390, 1010, 1.7, -19],
            [1560, 860, 1.5, 32],
            [1200, 1010, 1, 18],
          ].map(([x, y, s, r]) => (
            <use
              href="#forest-fern"
              key={x}
              transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}
            />
          ))}
        </g>
        <g fill="#91ad62" opacity=".4">
          {Array.from({ length: 32 }, (_, i) => (
            <ellipse
              key={i}
              cx={i % 2 ? 1540 - (i % 7) * 18 : (i % 7) * 18}
              cy={180 + i * 22}
              rx="13"
              ry="33"
              transform={`rotate(${i % 2 ? -40 : 40} ${i % 2 ? 1540 - (i % 7) * 18 : (i % 7) * 18} ${180 + i * 22})`}
            />
          ))}
        </g>
      </svg>
      <div className="forest-shade" />
    </div>
  );
}

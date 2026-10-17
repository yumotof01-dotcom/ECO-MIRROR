export function BotanicalIllustration() {
  return (
    <figure className="botanical-figure">
      <div className="figure-label">
        <span>FIELD STUDY</span>
        <span>PLANTS × INSECTS</span>
      </div>
      <svg
        viewBox="0 0 540 460"
        role="img"
        aria-labelledby="botanical-title botanical-description"
      >
        <title id="botanical-title">花と訪花昆虫を描いた説明用イラスト</title>
        <desc id="botanical-description">
          花のまわりを昆虫が飛ぶ様子を表すコンセプト図です。実際の観測や分析結果ではありません。
        </desc>
        <defs>
          <pattern
            id="field-grid"
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r=".7" fill="#a0ad92" opacity=".3" />
          </pattern>
          <g id="leaf">
            <path d="M0 0C-42-6-59-42-50-67-15-58 5-26 0 0Z" fill="#68836b" />
            <path d="M0 0-43-57" stroke="#e5e8d7" strokeWidth="1" />
          </g>
          <g id="flower">
            <g fill="#f6f2db" stroke="#c7bd95" strokeWidth=".8">
              <ellipse cy="-18" rx="8" ry="21" />
              <ellipse cy="-18" rx="8" ry="21" transform="rotate(45)" />
              <ellipse cy="-18" rx="8" ry="21" transform="rotate(90)" />
              <ellipse cy="-18" rx="8" ry="21" transform="rotate(135)" />
              <ellipse cy="-18" rx="8" ry="21" transform="rotate(180)" />
              <ellipse cy="-18" rx="8" ry="21" transform="rotate(225)" />
              <ellipse cy="-18" rx="8" ry="21" transform="rotate(270)" />
              <ellipse cy="-18" rx="8" ry="21" transform="rotate(315)" />
            </g>
            <circle r="12" fill="#b49a51" />
            <circle
              r="7"
              fill="none"
              stroke="#7e6c33"
              strokeDasharray="1 3"
              strokeWidth="4"
            />
          </g>
        </defs>
        <rect width="540" height="460" fill="url(#field-grid)" />
        <circle cx="275" cy="230" r="174" fill="#e5e8d9" />
        <circle
          cx="275"
          cy="230"
          r="202"
          fill="none"
          stroke="#bec9b3"
          strokeWidth="1"
          strokeDasharray="2 7"
        />
        <path
          d="M190 424C197 320 222 238 246 160M337 426c-10-84-5-143 5-219M199 373c-48-55-53-85-50-113M214 305c39-28 58-65 61-94M332 354c34-32 52-60 58-93"
          fill="none"
          stroke="#3f6248"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <use
          href="#leaf"
          transform="translate(201 356) rotate(-16) scale(.9)"
        />
        <use
          href="#leaf"
          transform="translate(214 304) rotate(100) scale(.8)"
        />
        <use
          href="#leaf"
          transform="translate(228 242) rotate(-20) scale(.6)"
        />
        <use href="#leaf" transform="translate(334 367) rotate(-5) scale(.8)" />
        <use href="#leaf" transform="translate(336 298) rotate(90) scale(.6)" />
        <use
          href="#leaf"
          transform="translate(151 288) rotate(-35) scale(.55)"
        />
        <use
          href="#flower"
          transform="translate(248 153) rotate(12) scale(1.07)"
        />
        <use
          href="#flower"
          transform="translate(342 204) rotate(-10) scale(.8)"
        />
        <use href="#flower" transform="translate(149 253) scale(.6)" />
        <use href="#flower" transform="translate(389 258) scale(.5)" />
        <g transform="translate(365 105) rotate(-24)">
          <ellipse
            cx="-7"
            cy="-12"
            rx="8"
            ry="15"
            fill="#f7f8ec"
            stroke="#7c8f78"
          />
          <ellipse
            cx="7"
            cy="-12"
            rx="8"
            ry="15"
            fill="#f7f8ec"
            stroke="#7c8f78"
          />
          <ellipse cy="4" rx="9" ry="17" fill="#b49a51" />
          <path d="M-8-1H8M-8 7H8" stroke="#354b3c" strokeWidth="4" />
          <circle cy="-15" r="5" fill="#354b3c" />
          <path
            d="m-3-18-3-7m9 7 3-7M-8 1l-8 5m24-5 8 5m-22 4-7 9m21-9 7 9"
            fill="none"
            stroke="#354b3c"
            strokeWidth="1.5"
          />
        </g>
        <path
          d="M386 116c60 10 63 71 19 80"
          fill="none"
          stroke="#8b9a7f"
          strokeWidth="1.2"
          strokeDasharray="4 5"
        />
        <path
          d="M83 175h55M108 150v50"
          stroke="#819474"
          strokeWidth="1"
          opacity=".65"
        />
        <path
          d="M421 354h34m-17-17v34"
          stroke="#819474"
          strokeWidth="1"
          opacity=".65"
        />
        <text x="55" y="414" fill="#64745b" fontSize="10" letterSpacing="2">
          OBSERVE. QUESTION. UNDERSTAND.
        </text>
      </svg>
      <figcaption>
        <span>植物と昆虫、そのあいだにある関係。</span>
        <span>説明用イラスト · 実データではありません</span>
      </figcaption>
    </figure>
  );
}

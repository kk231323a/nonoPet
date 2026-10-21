import type { PetAction } from "../types";

interface BubuProps {
  action: PetAction;
}

const outline = "#53312e";

export function Bubu({ action }: BubuProps) {
  return (
    <div className={`bubu-shell state-${action}`}>
      <svg
        className="bubu-svg"
        viewBox="0 0 340 350"
        role="img"
        aria-label="白团子、深可可色圆耳的布布桌宠"
      >
        <ellipse className="ground-shadow" cx="170" cy="331" rx="96" ry="12" fill="#6c554d" opacity=".17" />

        <g className="character-rig">
          <g className="tail">
            <ellipse cx="275" cy="238" rx="17" ry="23" fill="#644039" stroke={outline} strokeWidth="6" />
          </g>

          <g className="feet">
            <ellipse className="foot foot-left" cx="116" cy="305" rx="27" ry="16" fill="#fff8ef" stroke={outline} strokeWidth="7" />
            <ellipse className="foot foot-right" cx="224" cy="305" rx="27" ry="16" fill="#fff8ef" stroke={outline} strokeWidth="7" />
            <ellipse cx="116" cy="309" rx="12" ry="7" fill="#f0d9c6" />
            <ellipse cx="224" cy="309" rx="12" ry="7" fill="#f0d9c6" />
          </g>

          <path
            className="body"
            d="M91 181c-27 22-35 73-15 106 18 30 60 40 94 40s76-10 94-40c20-33 12-84-15-106-31-25-127-25-158 0Z"
            fill="#fffaf6"
            stroke={outline}
            strokeWidth="8"
            strokeLinejoin="round"
          />

          <g className="arm arm-left">
            <path
              d="M94 193c-33 9-47 42-29 60 14 15 40 7 47-13 6-17 1-35-18-47Z"
              fill="#fffaf6"
              stroke={outline}
              strokeWidth="8"
              strokeLinejoin="round"
            />
          </g>

          <g className="arm arm-right">
            <path
              d="M246 193c33 9 47 42 29 60-14 15-40 7-47-13-6-17-1-35 18-47Z"
              fill="#fffaf6"
              stroke={outline}
              strokeWidth="8"
              strokeLinejoin="round"
            />
          </g>

          <g className="head-rig">
            <path
              className="top-tuft"
              d="M156 27c0-10 8-16 16-9 5-12 18-12 22 0 8-7 17 1 14 11"
              fill="#fffaf6"
              stroke={outline}
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <g className="ear ear-left">
              <circle cx="82" cy="58" r="35" fill="#54332f" stroke={outline} strokeWidth="5" />
              <path d="M53 48c9-19 32-27 49-15" fill="none" stroke="#6f4942" strokeWidth="7" strokeLinecap="round" />
            </g>
            <g className="ear ear-right">
              <circle cx="258" cy="58" r="35" fill="#54332f" stroke={outline} strokeWidth="5" />
              <path d="M230 34c17-11 39-3 49 15" fill="none" stroke="#6f4942" strokeWidth="7" strokeLinecap="round" />
            </g>

            <path
              className="head"
              d="M82 91c11-45 53-70 88-70 38 0 79 25 89 72 11 52-10 91-43 103-21 9-70 10-97 0-40-14-47-63-37-105Z"
              fill="#fffaf6"
              stroke={outline}
              strokeWidth="8.5"
              strokeLinejoin="round"
            />

            <ellipse cx="95" cy="158" rx="27" ry="16" fill="#ffc5c9" />
            <ellipse cx="245" cy="158" rx="27" ry="16" fill="#ffc5c9" />

            <g className="normal-eyes">
              <circle cx="132" cy="122" r="11" fill="#53312e" />
              <circle cx="208" cy="122" r="11" fill="#53312e" />
              <circle cx="135" cy="118" r="2.6" fill="#fff8f4" opacity=".92" />
              <circle cx="211" cy="118" r="2.6" fill="#fff8f4" opacity=".92" />
            </g>

            <g className="sleep-eyes">
              <path d="M118 123c9 9 19 9 28 0" fill="none" stroke={outline} strokeWidth="7" strokeLinecap="round" />
              <path d="M194 123c9 9 19 9 28 0" fill="none" stroke={outline} strokeWidth="7" strokeLinecap="round" />
            </g>

            <g className="happy-eyes">
              <path d="M119 126c8-10 19-10 27 0" fill="none" stroke={outline} strokeWidth="7" strokeLinecap="round" />
              <path d="M194 126c8-10 19-10 27 0" fill="none" stroke={outline} strokeWidth="7" strokeLinecap="round" />
            </g>

            <path
              className="mouth mouth-rest"
              d="M157 148c7-8 13-8 20 0 7-8 13-8 20 0"
              fill="none"
              stroke={outline}
              strokeWidth="6.5"
              strokeLinecap="round"
            />
            <path
              className="mouth mouth-happy"
              d="M158 144c7 0 12 4 16 10 5-6 11-10 17-10"
              fill="none"
              stroke={outline}
              strokeWidth="6.5"
              strokeLinecap="round"
            />
            <ellipse className="mouth mouth-sleep" cx="176" cy="151" rx="7" ry="9" fill="#f29ba5" stroke={outline} strokeWidth="4" />
          </g>

          <g className="drink-prop">
            <path d="M210 162l20-58" fill="none" stroke={outline} strokeWidth="7" strokeLinecap="round" />
            <path d="M230 104l-10 31" fill="none" stroke="#94d9e7" strokeWidth="3.5" strokeLinecap="round" />
            <path
              d="M184 151h64l-8 92c-1 11-10 17-20 17h-9c-11 0-19-7-20-17l-7-92Z"
              fill="#e8b18c"
              stroke={outline}
              strokeWidth="7"
              strokeLinejoin="round"
            />
            <path d="M184 151h64l-2 21h-61l-1-21Z" fill="#fff5e8" stroke={outline} strokeWidth="6" />
            <circle cx="206" cy="197" r="5.5" fill="#7a5148" opacity=".85" />
            <circle cx="226" cy="211" r="5" fill="#7a5148" opacity=".85" />
            <circle cx="238" cy="187" r="4.5" fill="#7a5148" opacity=".85" />
            <ellipse cx="187" cy="217" rx="14" ry="21" fill="#fffaf6" stroke={outline} strokeWidth="7" />
            <ellipse cx="245" cy="217" rx="14" ry="21" fill="#fffaf6" stroke={outline} strokeWidth="7" />
          </g>

          <g className="heart-effects" aria-hidden="true">
            <path className="heart heart-one" d="M86 102c-10-13-27-1-17 11l17 17 17-17c10-12-7-24-17-11Z" fill="#ff9caa" />
            <path className="heart heart-two" d="M250 95c-7-9-19-1-12 8l12 12 12-12c7-9-5-17-12-8Z" fill="#ffb7be" />
            <path className="heart heart-three" d="M267 147c-6-8-17-1-11 7l11 11 11-11c6-8-5-15-11-7Z" fill="#ffd1d5" />
          </g>

          <g className="sleep-effects" aria-hidden="true">
            <text className="sleep-z sleep-z-one" x="252" y="102" fill={outline} fontSize="25" fontWeight="800">Z</text>
            <text className="sleep-z sleep-z-two" x="273" y="75" fill={outline} fontSize="19" fontWeight="800">Z</text>
            <text className="sleep-z sleep-z-three" x="289" y="54" fill={outline} fontSize="14" fontWeight="800">z</text>
          </g>

          <g className="sparkle-effects" aria-hidden="true">
            <path className="sparkle sparkle-one" d="M73 117l5 13 13 5-13 5-5 13-5-13-13-5 13-5 5-13Z" fill="#ffd17c" />
            <path className="sparkle sparkle-two" d="M265 164l4 10 10 4-10 4-4 10-4-10-10-4 10-4 4-10Z" fill="#ffc0c8" />
            <path className="sparkle sparkle-three" d="M99 219l3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8Z" fill="#a8dcca" />
          </g>
        </g>
      </svg>
    </div>
  );
}

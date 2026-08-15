import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { calculate } from "./calculate";
import { isTauri, publishOverlayDrag, publishOverlayText } from "./env";
import {
  Theme,
  applyTheme,
  loadThemeLocal,
  parseTheme,
  persistThemeLocal,
} from "./theme";
import {
  ACTION_BADGE_FONT_SIZE,
  ACTION_BADGE_TOP,
  ACTION_BTN_GAP,
  ACTION_BTN_PAD_BOTTOM,
  ACTION_BTN_PAD_TOP,
  ACTION_BTN_WIDTH,
  ACTION_ICON_SIZE,
  EMOJI_SIZE,
  FIRE_COLOR,
  FIRE_COLOR_DARK,
  FONT_SIZE,
  LABEL_WIDTH,
  LEFT_COL_WIDTH,
  SPEED,
  THUNDER,
  TRUE_FALSE,
  WATER,
  WATER_COLOR,
  WATER_COLOR_DARK,
  applyThemeColors,
} from "./constants";
import {
  EMPTY_STATE,
  State,
  isExcluded,
  toggleValue,
} from "./state";
import speedIcon from "./assets/speed.webp";
import waterIcon from "./assets/water.webp";
import lightIcon from "./assets/light.webp";

type Choice = string | [string, string];

function choiceParts(choice: Choice): { text: string; value: string } {
  if (Array.isArray(choice)) {
    return { text: choice[0], value: choice[1] };
  }
  return { text: choice, value: choice };
}

function toggleClass(
  selected: boolean,
  hidden?: boolean,
  stacked?: boolean,
  colored?: boolean,
) {
  if (hidden) {
    return stacked
      ? "pointer-events-none box-border shrink-0 appearance-none border border-transparent bg-transparent text-transparent shadow-none"
      : "pointer-events-none min-w-[2.4em] appearance-none border border-transparent bg-transparent text-transparent shadow-none";
  }
  const base = stacked
    ? "relative z-10 box-border shrink-0 overflow-visible appearance-none rounded-sm border px-1 font-[inherit] text-[length:var(--font-size)] leading-none pointer-events-auto"
    : "min-w-[2.4em] appearance-none rounded-sm border px-1.5 py-px font-[inherit] text-[length:var(--font-size)] leading-snug";
  const textCls = colored
    ? ""
    : selected
      ? "text-black dark:text-[#e8e8e8]"
      : "text-black dark:text-[#e8e8e8]";
  const selectedCls =
    "border-[#0078d7] bg-[var(--btn-selected-bg)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] dark:border-[#8ec8ff]";
  const idle =
    "border-[#adadad] bg-[var(--btn-bg)] hover:enabled:border-[#0078d7] hover:enabled:bg-[var(--btn-hover-bg)] dark:border-[#555]";
  return `${base} ${textCls} cursor-pointer disabled:cursor-default disabled:text-[#777] dark:disabled:text-[#888] ${selected ? selectedCls : idle}`;
}

function iconFromChoice(choice: string): string {
  const parts = choice.split(" ");
  return parts.slice(1).join(" ") || choice;
}

function actionIconSrc(choice: string): string | undefined {
  if (choice.includes("⏩")) return speedIcon;
  if (choice.includes("💧")) return waterIcon;
  if (choice.includes("⚡")) return lightIcon;
  return undefined;
}

function ActionIconButton({ text, badge }: { text: string; badge: string }) {
  const src = actionIconSrc(text);
  return (
    <span className="relative flex w-full items-center justify-center">
      <span
        className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap font-bold leading-none"
        style={{
          top: ACTION_BADGE_TOP,
          fontSize: ACTION_BADGE_FONT_SIZE,
          color: "var(--badge-fill)",
          WebkitTextStroke: "1px var(--badge-stroke)",
          paintOrder: "stroke fill",
          textShadow:
            "-1px -1px 0 var(--badge-stroke), 1px -1px 0 var(--badge-stroke), -1px 1px 0 var(--badge-stroke), 1px 1px 0 var(--badge-stroke)",
        }}
      >
        {badge}
      </span>
      {src ? (
        <img
          src={src}
          alt=""
          className="object-contain"
          style={{ width: ACTION_ICON_SIZE, height: ACTION_ICON_SIZE }}
          draggable={false}
        />
      ) : (
        <span style={{ fontSize: ACTION_ICON_SIZE, lineHeight: 1 }}>
          {iconFromChoice(text)}
        </span>
      )}
    </span>
  );
}

function themeColor(theme: Theme | null, light: string, dark: string) {
  return theme === "dark" ? dark : light;
}

function QuestionMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="inline-block shrink-0 align-middle"
      style={{
        width: EMOJI_SIZE,
        height: EMOJI_SIZE,
        color: "var(--question-color)",
      }}
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.5 8.4a3.6 3.6 0 1 1 4.7 3.4c-.9.4-1.3 1.1-1.3 2.2V15"
      />
      <circle cx="12" cy="18.2" r="1.35" fill="currentColor" />
    </svg>
  );
}

function EmojiText({ text }: { text: string }) {
  const parts = text.split(/(\p{Extended_Pictographic}|？)/u);
  return (
    <>
      {parts.map((part, i) =>
        part === "❓" || part === "❔" || part === "？" ? (
          <QuestionMark key={i} />
        ) : /^\p{Extended_Pictographic}$/u.test(part) ? (
          <span
            key={i}
            className="inline-block leading-none"
            style={{ fontSize: EMOJI_SIZE }}
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function actionBtnClass(selected: boolean) {
  const base =
    "appearance-none rounded-sm border px-2.5 py-0.5 font-[inherit] text-[length:var(--font-size)]";
  const selectedCls =
    "border-[#0078d7] bg-[var(--btn-selected-bg)] text-black shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] dark:border-[#8ec8ff] dark:text-white";
  const idle =
    "cursor-pointer border-[#adadad] bg-[var(--btn-bg)] text-black hover:border-[#0078d7] hover:bg-[var(--btn-hover-bg)] dark:border-[#555] dark:text-white";
  return `${base} ${selected ? selectedCls : idle}`;
}

function ToggleButton({
  text,
  badge,
  selected,
  disabled,
  hidden,
  color,
  onClick,
}: {
  text: string;
  badge?: string;
  selected: boolean;
  disabled?: boolean;
  hidden?: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={toggleClass(selected, hidden, Boolean(badge), Boolean(color))}
      style={{
        ...(color && !hidden ? { color } : {}),
        ...(badge
          ? {
            width: ACTION_BTN_WIDTH,
            paddingTop: ACTION_BTN_PAD_TOP,
            paddingBottom: ACTION_BTN_PAD_BOTTOM,
          }
          : {}),
      }}
      aria-pressed={selected}
      disabled={disabled || hidden}
      tabIndex={-1}
      onClick={onClick}
    >
      {hidden ? (
        ""
      ) : badge ? (
        <ActionIconButton text={text} badge={badge} />
      ) : (
        <EmojiText text={text} />
      )}
    </button>
  );
}

function RadioGroup({
  label,
  choices,
  value,
  color,
  onChange,
}: {
  label: string;
  choices: Choice[];
  value: string;
  color?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mb-1 flex items-center gap-1">
      <span
        className="mr-1.5 whitespace-nowrap font-bold"
        style={color ? { color } : undefined}
      >
        <EmojiText text={label} />
      </span>
      {choices.map((choice) => {
        const { text, value: val } = choiceParts(choice);
        return (
          <ToggleButton
            key={val}
            text={text}
            selected={value === val}
            color={text === "？" ? undefined : color}
            onClick={() => onChange(toggleValue(value, val))}
          />
        );
      })}
    </div>
  );
}

function RadioGroupV({
  choices,
  badges,
  value,
  disabled,
  hidden,
  onChange,
}: {
  choices: readonly string[];
  badges: readonly string[];
  value: string;
  disabled: boolean;
  hidden: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {choices.map((choice, i) => (
        <ToggleButton
          key={choice}
          text={choice}
          badge={badges[i]}
          selected={value === choice}
          disabled={disabled}
          hidden={hidden}
          onClick={() => onChange(toggleValue(value, choice))}
        />
      ))}
    </div>
  );
}

function RoundBlock({
  title,
  rowLabels,
  rnd,
  state,
  setField,
}: {
  title: string;
  rowLabels: [string, string];
  rnd: "round1" | "round2";
  state: State;
  setField: (key: string, value: string) => void;
}) {
  const tf = state[`${rnd}_tf`] ?? "";
  const speedEx = isExcluded(state, rnd, "speed");
  const waterEx = isExcluded(state, rnd, "water");
  const thunderEx = isExcluded(state, rnd, "thunder");

  return (
    <div className="mb-2 flex items-start">
      <span
        className="mt-0.5 mr-0 shrink-0 text-left leading-snug [font-feature-settings:'ordn'_0,'sups'_0] [font-variant-numeric:lining-nums]"
        style={{ fontSize: FONT_SIZE, width: `${LABEL_WIDTH}ch` }}
      >
        {title}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-2 flex items-center justify-start gap-1">
          <ToggleButton
            text="真 十字"
            selected={tf === TRUE_FALSE[0]}
            onClick={() => setField(`${rnd}_tf`, toggleValue(tf, TRUE_FALSE[0]))}
          />
          <ToggleButton
            text="❓ 十字"
            selected={tf === TRUE_FALSE[1]}
            onClick={() => setField(`${rnd}_tf`, toggleValue(tf, TRUE_FALSE[1]))}
          />
        </div>
        <div className="relative z-10 flex" style={{ gap: ACTION_BTN_GAP }}>
          <RadioGroupV
            choices={SPEED}
            badges={rowLabels}
            value={state[`${rnd}_speed`] ?? ""}
            disabled={speedEx}
            hidden={speedEx}
            onChange={(v) => setField(`${rnd}_speed`, v)}
          />
          <RadioGroupV
            choices={WATER}
            badges={rowLabels}
            value={state[`${rnd}_water`] ?? ""}
            disabled={waterEx}
            hidden={waterEx}
            onChange={(v) => setField(`${rnd}_water`, v)}
          />
          <RadioGroupV
            choices={THUNDER}
            badges={rowLabels}
            value={state[`${rnd}_thunder`] ?? ""}
            disabled={thunderEx}
            hidden={thunderEx}
            onChange={(v) => setField(`${rnd}_thunder`, v)}
          />
        </div>
      </div>
    </div>
  );
}

function App() {
  const [state, setState] = useState<State>(EMPTY_STATE);
  const [changeMode, setChangeMode] = useState(false);
  const [theme, setTheme] = useState<Theme | null>(null);

  const setField = useCallback((key: string, value: string) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const fireColor = themeColor(theme, FIRE_COLOR, FIRE_COLOR_DARK);
  const waterColor = themeColor(theme, WATER_COLOR, WATER_COLOR_DARK);

  useEffect(() => {
    if (isTauri()) {
      invoke<string>("get_theme")
        .then((value) => setTheme(parseTheme(value)))
        .catch(() => setTheme("light"));
      return;
    }
    setTheme(loadThemeLocal());
  }, []);

  useEffect(() => {
    if (!theme) return;
    applyTheme(theme);
    applyThemeColors(theme);
    if (isTauri()) {
      invoke("set_theme", { theme }).catch(() => { });
      getCurrentWindow()
        .setTheme(theme)
        .catch(() => { });
      return;
    }
    persistThemeLocal(theme);
  }, [theme]);

  useEffect(() => {
    if (isTauri()) {
      invoke("calculate_text", { state }).catch(() => { });
      return;
    }
    publishOverlayText(calculate(state));
  }, [state]);

  useEffect(() => {
    if (isTauri()) {
      emit("overlay-drag", changeMode).catch(() => { });
      getCurrentWindow()
        .setResizable(changeMode)
        .catch(() => { });
      return;
    }
    publishOverlayDrag(changeMode);
  }, [changeMode]);

  useEffect(() => {
    if (!isTauri()) return;
    const block = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", block, true);
    return () => window.removeEventListener("keydown", block, true);
  }, []);

  return (
    <main className="h-full w-full select-none overflow-hidden bg-[var(--app-bg)] text-black dark:text-[#e8e8e8]">
      <div className="flex h-full p-2">
        <section
          className="flex min-w-0 shrink-0 flex-col overflow-hidden p-1"
          style={{ width: LEFT_COL_WIDTH, flexBasis: LEFT_COL_WIDTH }}
        >
          <RadioGroup
            label="🔥"
            choices={[
              ["真火", TRUE_FALSE[0]],
              ["❓火", TRUE_FALSE[1]],
            ]}
            value={state.fire}
            color={fireColor}
            onChange={(v) => setField("fire", v)}
          />
          <RadioGroup
            label="💧"
            choices={[
              ["真水", TRUE_FALSE[0]],
              ["❓水", TRUE_FALSE[1]],
            ]}
            value={state.water}
            color={waterColor}
            onChange={(v) => setField("water", v)}
          />
          <hr className="my-1 border-0 border-t border-[#c0c0c0] dark:border-[#444] mt-2 mb-3" />
          <RadioGroup
            label="石化眼--雷"
            choices={["？"]}
            value={state.thunder}
            onChange={(v) => setField("thunder", v)}
          />
          <div className="mb-2"></div>
          <RadioGroup
            label="二回目--冰"
            choices={["？"]}
            value={state.ice}
            onChange={(v) => setField("ice", v)}
          />
          <div className="mt-auto flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className={actionBtnClass(false)}
              tabIndex={-1}
              onClick={() => setState({ ...EMPTY_STATE })}
            >
              清除
            </button>
            <button
              type="button"
              className={actionBtnClass(changeMode)}
              tabIndex={-1}
              aria-pressed={changeMode}
              onClick={() => setChangeMode((on) => !on)}
            >
              變更
            </button>
            {changeMode ? (
              <button
                type="button"
                className={actionBtnClass(true)}
                tabIndex={-1}
                aria-pressed={theme === "dark"}
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? "深色" : "淺色"}
              </button>
            ) : null}
          </div>
        </section>

        <section className="relative z-10 flex min-w-0 flex-1 flex-col p-1">
          <RoundBlock
            title="1st"
            rowLabels={["0~50", "1m"]}
            rnd="round1"
            state={state}
            setField={setField}
          />
          <hr className="mb-2 border-0 border-t border-[#c0c0c0] dark:border-[#444]" />
          <RoundBlock
            title="2nd"
            rowLabels={["0~35", "36~1m"]}
            rnd="round2"
            state={state}
            setField={setField}
          />
        </section>
      </div>
    </main>
  );
}

export default App;

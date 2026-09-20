import { useCallback, useEffect, useRef, useState } from "react";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { overlayText } from "./calculate";
import { applyMainWindowLayout } from "./windowSize";
import {
  CALCULATOR_SET_EVENT,
  CALCULATOR_STATE_REQUEST_EVENT,
  isTauri,
  publishCalculatorState,
  publishDebuffOverlay,
  publishOverlayDrag,
  publishOverlayLineGap,
  publishOverlayText,
  type CalculatorSet,
} from "./env";
import {
  Theme,
  applyTheme,
  loadThemeLocal,
  parseTheme,
  persistThemeLocal,
} from "./theme";
import {
  ShadeEdge,
  loadShadeEdgeLocal,
  parseShadeEdge,
  persistShadeEdgeLocal,
} from "./shadeEdge";
import {
  DEFAULT_LINE_GAP,
  MAX_LINE_GAP,
  loadLineGapLocal,
  parseLineGap,
  persistLineGapLocal,
} from "./lineGap";
import {
  loadDebuffOverlayLocal,
  parseDebuffOverlay,
  persistDebuffOverlayLocal,
} from "./debuffOverlay";
import {
  loadOriginalMenuLocal,
  parseOriginalMenu,
  persistOriginalMenuLocal,
} from "./originalMenu";
import {
  DEFAULT_POSTNAMAZU_PORT,
  loadPostnamazuEnabledLocal,
  loadPostnamazuPortLocal,
  parsePostnamazuEnabled,
  parsePostnamazuPort,
  persistPostnamazuEnabledLocal,
  persistPostnamazuPortLocal,
} from "./postnamazu";
import {
  DEFAULT_LOG_REGEX,
  DEFAULT_OVERLAY_WS_PORT,
  loadActTtsEnabledLocal,
  loadLogRegexLocal,
  loadOverlayWsPortLocal,
  loadTtsDelaysLocal,
  parseActTtsEnabled,
  parseLogRegex,
  parseOverlayWsPort,
  parseTtsDelayMs,
  parseTtsDelays,
  persistActTtsEnabledLocal,
  persistLogRegexLocal,
  persistOverlayWsPortLocal,
  persistTtsDelaysLocal,
  TTS_SLOT_LABELS,
} from "./actTts";
import {
  ACTION_BADGE_FONT_SIZE,
  ACTION_BADGE_TOP,
  ACTION_BTN_GAP,
  ACTION_BTN_PAD_BOTTOM,
  ACTION_BTN_PAD_TOP,
  ACTION_BTN_WIDTH,
  ACTION_EXCLUDED_OPACITY,
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
  DEFAULT_LABELS,
  LABEL_GROUPS,
  Labels,
  LabelKey,
  loadLabelsLocal,
  mergeLabels,
  persistLabelsLocal,
  sparseLabels,
} from "./labels";
import {
  EMPTY_STATE,
  State,
  isExcluded,
  isStateKey,
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
      : "pointer-events-none min-w-[2.4em] appearance-none rounded-sm border px-1.5 py-px font-[inherit] text-[length:var(--font-size)] leading-snug opacity-0";
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
      {hidden && badge ? (
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
  onChange,
}: {
  choices: readonly string[];
  badges: readonly string[];
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className="flex min-w-0 flex-col gap-1"
      style={disabled ? { opacity: ACTION_EXCLUDED_OPACITY } : undefined}
    >
      {choices.map((choice, i) => (
        <ToggleButton
          key={choice}
          text={choice}
          badge={badges[i]}
          selected={value === choice}
          disabled={disabled}
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
            hidden={tf === TRUE_FALSE[1]}
            onClick={() => setField(`${rnd}_tf`, toggleValue(tf, TRUE_FALSE[0]))}
          />
          <ToggleButton
            text="❓ 十字"
            selected={tf === TRUE_FALSE[1]}
            hidden={tf === TRUE_FALSE[0]}
            onClick={() => setField(`${rnd}_tf`, toggleValue(tf, TRUE_FALSE[1]))}
          />
        </div>
        <div className="relative z-10 flex" style={{ gap: ACTION_BTN_GAP }}>
          <RadioGroupV
            choices={SPEED}
            badges={rowLabels}
            value={state[`${rnd}_speed`] ?? ""}
            disabled={speedEx}
            onChange={(v) => setField(`${rnd}_speed`, v)}
          />
          <RadioGroupV
            choices={WATER}
            badges={rowLabels}
            value={state[`${rnd}_water`] ?? ""}
            disabled={waterEx}
            onChange={(v) => setField(`${rnd}_water`, v)}
          />
          <RadioGroupV
            choices={THUNDER}
            badges={rowLabels}
            value={state[`${rnd}_thunder`] ?? ""}
            disabled={thunderEx}
            onChange={(v) => setField(`${rnd}_thunder`, v)}
          />
        </div>
      </div>
    </div>
  );
}

function delayInputClass() {
  return "box-border w-[5.5em] min-w-0 rounded-sm border border-[#adadad] bg-[var(--btn-bg)] px-1.5 py-0.5 font-[inherit] text-[length:var(--font-size)] text-black outline-none select-text focus:border-[#0078d7] dark:border-[#555] dark:text-white";
}

const GROUP_BODY =
  "border-[#c0c0c0] pl-6 dark:border-[#555]";

function TtsDelayEditor({
  delays,
  onChange,
}: {
  delays: number[];
  onChange: (index: number, ms: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 font-bold">TTS 延遲</div>
      <p className="mb-2 text-[11px] leading-snug text-[#555] dark:text-[#aaa]">
        從日誌正則命中起算，各行獨立播放（略過 (0) 與分隔線）。
      </p>
      <div className={GROUP_BODY}>
        <table className="w-full border-collapse text-left text-[length:var(--font-size)]">
          <thead>
            <tr className="text-[11px] text-[#555] dark:text-[#aaa]">
              <th className="w-[7.5em] py-0.5 pr-2 font-normal" />
              <th className="w-[6.5em] py-0.5 text-right font-normal">ms</th>
            </tr>
          </thead>
          <tbody>
            {TTS_SLOT_LABELS.map((label, i) => (
              <tr key={label} className="border-b border-[#c0c0c0] dark:border-[#444]">
                <td className="w-[7.5em] whitespace-nowrap py-1 pr-2 align-middle text-[#555] dark:text-[#aaa]">
                  {label}
                </td>
                <td className="w-[6.5em] py-1 text-right align-middle">
                  <input
                    type="number"
                    min={0}
                    max={120000}
                    value={delays[i] ?? 0}
                    aria-label={`${label} ms`}
                    autoComplete="off"
                    spellCheck={false}
                    className={delayInputClass()}
                    onChange={(e) => {
                      const raw = e.target.value;
                      onChange(i, raw === "" ? 0 : parseTtsDelayMs(raw));
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LabelsEditor({
  labels,
  onChange,
  onReset,
}: {
  labels: Labels;
  onChange: (key: LabelKey, value: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {LABEL_GROUPS.map((group) => (
        <div key={group.title}>
          <div className="mb-1 font-bold">{group.title}</div>
          <p className="mb-2 text-[11px] leading-snug text-[#555] dark:text-[#aaa]">
            留空會刪除該行。若要空行，請輸入 \n
          </p>
          <div className={GROUP_BODY}>

            <table className="w-full border-collapse text-left text-[length:var(--font-size)]">
              <tbody>
                {group.keys.map((key) => (
                  <tr key={key} className="border-b border-[#c0c0c0] dark:border-[#444]">
                    <td className="w-[7.5em] whitespace-nowrap py-1 pr-2 align-middle text-[#555] dark:text-[#aaa]">
                      {DEFAULT_LABELS[key]}
                    </td>
                    <td className="py-1">
                      <input
                        type="text"
                        value={labels[key]}
                        placeholder={DEFAULT_LABELS[key]}
                        autoComplete="off"
                        spellCheck={false}
                        className="box-border w-full min-w-0 rounded-sm border border-[#adadad] bg-[var(--btn-bg)] px-1.5 py-0.5 font-[inherit] text-[length:var(--font-size)] text-black outline-none select-text focus:border-[#0078d7] dark:border-[#555] dark:text-white"
                        onChange={(e) => onChange(key, e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <div>
        <button
          type="button"
          className={actionBtnClass(false)}
          tabIndex={-1}
          onClick={onReset}
        >
          重設
        </button>
      </div>
    </div>
  );
}

function App() {
  const [state, setState] = useState<State>(EMPTY_STATE);
  const [changeMode, setChangeMode] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"general" | "custom">("general");
  const [postnamazuEnabled, setPostnamazuEnabled] = useState<boolean | null>(null);
  const [postnamazuPort, setPostnamazuPort] = useState<number | null>(null);
  const [postnamazuTest, setPostnamazuTest] = useState<string | null>(null);
  const [actTtsEnabled, setActTtsEnabled] = useState<boolean | null>(null);
  const [overlayWsPort, setOverlayWsPort] = useState<number | null>(null);
  const [logRegex, setLogRegex] = useState<string | null>(null);
  const [ttsDelays, setTtsDelays] = useState<number[] | null>(null);
  const [actTtsTest, setActTtsTest] = useState<string | null>(null);
  const [regexTest, setRegexTest] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [shadeEdge, setShadeEdge] = useState<ShadeEdge | null>(null);
  const [lineGap, setLineGap] = useState<number | null>(null);
  const [debuffOverlay, setDebuffOverlay] = useState<boolean | null>(null);
  const [originalMenu, setOriginalMenu] = useState<boolean | null>(null);
  const [labels, setLabels] = useState<Labels>({ ...DEFAULT_LABELS });
  const [labelsReady, setLabelsReady] = useState(false);

  const setField = useCallback((key: string, value: string) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);
  const clearCalculator = useCallback(() => {
    setState({ ...EMPTY_STATE });
    if (isTauri()) {
      invoke("cancel_scheduled_tts").catch(() => { });
    }
  }, []);
  const stateRef = useRef(state);
  stateRef.current = state;

  const fireColor = themeColor(theme, FIRE_COLOR, FIRE_COLOR_DARK);
  const waterColor = themeColor(theme, WATER_COLOR, WATER_COLOR_DARK);

  useEffect(() => {
    if (isTauri()) {
      invoke<string>("get_theme")
        .then((value) => setTheme(parseTheme(value)))
        .catch(() => setTheme("light"));
      invoke<string>("get_shade_edge")
        .then((value) => setShadeEdge(parseShadeEdge(value)))
        .catch(() => setShadeEdge("bottom"));
      invoke<number>("get_line_gap")
        .then((value) => setLineGap(parseLineGap(value)))
        .catch(() => setLineGap(DEFAULT_LINE_GAP));
      invoke<boolean>("get_debuff_overlay")
        .then((value) => setDebuffOverlay(parseDebuffOverlay(value)))
        .catch(() => setDebuffOverlay(true));
      invoke<boolean>("get_original_menu")
        .then((value) => setOriginalMenu(parseOriginalMenu(value)))
        .catch(() => setOriginalMenu(true));
      invoke<boolean>("get_postnamazu_enabled")
        .then((value) => setPostnamazuEnabled(parsePostnamazuEnabled(value)))
        .catch(() => setPostnamazuEnabled(false));
      invoke<number>("get_postnamazu_port")
        .then((value) => setPostnamazuPort(parsePostnamazuPort(value)))
        .catch(() => setPostnamazuPort(DEFAULT_POSTNAMAZU_PORT));
      invoke<boolean>("get_act_tts_enabled")
        .then((value) => setActTtsEnabled(parseActTtsEnabled(value)))
        .catch(() => setActTtsEnabled(true));
      invoke<number>("get_overlay_ws_port")
        .then((value) => setOverlayWsPort(parseOverlayWsPort(value)))
        .catch(() => setOverlayWsPort(DEFAULT_OVERLAY_WS_PORT));
      invoke<string>("get_log_regex")
        .then((value) => setLogRegex(parseLogRegex(value)))
        .catch(() => setLogRegex(DEFAULT_LOG_REGEX));
      invoke<number[]>("get_tts_delays_ms")
        .then((value) => setTtsDelays(parseTtsDelays(value)))
        .catch(() => setTtsDelays(parseTtsDelays(null)));
      invoke<Partial<Record<string, string>>>("get_labels")
        .then((value) => {
          setLabels(mergeLabels(value));
          setLabelsReady(true);
        })
        .catch(() => setLabelsReady(true));
      return;
    }
    setTheme(loadThemeLocal());
    setShadeEdge(loadShadeEdgeLocal());
    setLineGap(loadLineGapLocal());
    setDebuffOverlay(loadDebuffOverlayLocal());
    setOriginalMenu(loadOriginalMenuLocal());
    setPostnamazuEnabled(loadPostnamazuEnabledLocal());
    setPostnamazuPort(loadPostnamazuPortLocal());
    setActTtsEnabled(loadActTtsEnabledLocal());
    setOverlayWsPort(loadOverlayWsPortLocal());
    setLogRegex(loadLogRegexLocal());
    setTtsDelays(loadTtsDelaysLocal());
    setLabels(loadLabelsLocal());
    setLabelsReady(true);
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
    if (!shadeEdge) return;
    if (isTauri()) {
      invoke("set_shade_edge", { edge: shadeEdge }).catch(() => { });
      return;
    }
    persistShadeEdgeLocal(shadeEdge);
  }, [shadeEdge]);

  useEffect(() => {
    if (lineGap === null) return;
    if (isTauri()) {
      invoke("set_line_gap", { px: lineGap }).catch(() => { });
      return;
    }
    persistLineGapLocal(lineGap);
    publishOverlayLineGap(lineGap);
  }, [lineGap]);

  useEffect(() => {
    if (debuffOverlay === null) return;
    if (isTauri()) {
      invoke("set_debuff_overlay", { enabled: debuffOverlay }).catch(() => { });
      return;
    }
    persistDebuffOverlayLocal(debuffOverlay);
    publishDebuffOverlay(debuffOverlay);
  }, [debuffOverlay]);

  useEffect(() => {
    if (originalMenu === null) return;
    if (isTauri()) {
      invoke("set_original_menu", { enabled: originalMenu }).catch(() => { });
      return;
    }
    persistOriginalMenuLocal(originalMenu);
  }, [originalMenu]);

  useEffect(() => {
    if (postnamazuEnabled === null) return;
    if (isTauri()) {
      invoke("set_postnamazu_enabled", { enabled: postnamazuEnabled }).catch(() => { });
      return;
    }
    persistPostnamazuEnabledLocal(postnamazuEnabled);
  }, [postnamazuEnabled]);

  useEffect(() => {
    if (postnamazuPort === null) return;
    if (isTauri()) {
      invoke("set_postnamazu_port", { port: postnamazuPort }).catch(() => { });
      return;
    }
    persistPostnamazuPortLocal(postnamazuPort);
  }, [postnamazuPort]);

  useEffect(() => {
    if (actTtsEnabled === null) return;
    if (isTauri()) {
      invoke("set_act_tts_enabled", { enabled: actTtsEnabled }).catch(() => { });
      return;
    }
    persistActTtsEnabledLocal(actTtsEnabled);
  }, [actTtsEnabled]);

  useEffect(() => {
    if (overlayWsPort === null) return;
    if (isTauri()) {
      invoke("set_overlay_ws_port", { port: overlayWsPort }).catch(() => { });
      return;
    }
    persistOverlayWsPortLocal(overlayWsPort);
  }, [overlayWsPort]);

  useEffect(() => {
    if (logRegex === null) return;
    if (isTauri()) {
      invoke("set_log_regex", { pattern: logRegex }).catch(() => { });
      return;
    }
    persistLogRegexLocal(logRegex);
  }, [logRegex]);

  useEffect(() => {
    if (ttsDelays === null) return;
    if (isTauri()) {
      invoke("set_tts_delays_ms", { delays: ttsDelays }).catch(() => { });
      return;
    }
    persistTtsDelaysLocal(ttsDelays);
  }, [ttsDelays]);

  useEffect(() => {
    if (originalMenu === null) return;
    void applyMainWindowLayout({
      compact: !changeMode && originalMenu === false,
      settings: changeMode,
      shadeFromBottom: (shadeEdge ?? "bottom") === "bottom",
    });
  }, [changeMode, originalMenu, shadeEdge]);

  useEffect(() => {
    if (!labelsReady) return;
    const merged = mergeLabels(labels);
    if (isTauri()) {
      invoke("set_labels", { labels: sparseLabels(merged) }).catch(() => { });
      return;
    }
    persistLabelsLocal(merged);
  }, [labels, labelsReady]);

  useEffect(() => {
    if (!labelsReady) return;
    const merged = mergeLabels(labels);
    if (isTauri()) {
      invoke("calculate_text", { state, labels: sparseLabels(merged) }).catch(() => { });
      return;
    }
    publishOverlayText(overlayText(state, merged));
  }, [state, labels, labelsReady]);

  useEffect(() => {
    if (isTauri()) {
      emit("calculator-state", state).catch(() => { });
      return;
    }
    publishCalculatorState(state);
  }, [state]);

  useEffect(() => {
    if (isTauri()) {
      const unlistenSet = listen<CalculatorSet>("calculator-set", (event) => {
        const key = event.payload?.key;
        const value = event.payload?.value;
        if (typeof key === "string" && isStateKey(key) && typeof value === "string") {
          setField(key, value);
        }
      });
      const unlistenReq = listen("calculator-state-request", () => {
        emit("calculator-state", stateRef.current).catch(() => { });
      });
      return () => {
        unlistenSet.then((fn) => fn()).catch(() => { });
        unlistenReq.then((fn) => fn()).catch(() => { });
      };
    }
    const onSet = (event: Event) => {
      const patch = (event as CustomEvent<CalculatorSet>).detail;
      if (patch && isStateKey(patch.key) && typeof patch.value === "string") {
        setField(patch.key, patch.value);
      }
    };
    const onReq = () => publishCalculatorState(stateRef.current);
    window.addEventListener(CALCULATOR_SET_EVENT, onSet);
    window.addEventListener(CALCULATOR_STATE_REQUEST_EVENT, onReq);
    return () => {
      window.removeEventListener(CALCULATOR_SET_EVENT, onSet);
      window.removeEventListener(CALCULATOR_STATE_REQUEST_EVENT, onReq);
    };
  }, [setField]);

  useEffect(() => {
    if (isTauri()) {
      emit("overlay-drag", changeMode).catch(() => { });
      return;
    }
    publishOverlayDrag(changeMode);
  }, [changeMode]);

  useEffect(() => {
    if (!isTauri()) return;
    invoke("set_input_mode", { enabled: changeMode }).catch(() => { });
  }, [changeMode]);

  useEffect(() => {
    if (!isTauri()) return;
    const block = (e: KeyboardEvent) => {
      if (changeMode) return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", block, true);
    return () => window.removeEventListener("keydown", block, true);
  }, [changeMode]);

  const changeButton = (
    <button
      type="button"
      className={actionBtnClass(changeMode)}
      tabIndex={-1}
      aria-pressed={changeMode}
      onClick={() => setChangeMode((on) => !on)}
    >
      變更
    </button>
  );

  if (changeMode) {
    const edge = shadeEdge ?? "bottom";
    return (
      <main className="h-full w-full select-none overflow-hidden bg-[var(--app-bg)] text-black dark:text-[#e8e8e8]">
        <div className="flex h-full flex-col p-2">
          <div className="mb-1 flex flex-wrap gap-1 p-1">
            <button
              type="button"
              className={actionBtnClass(settingsTab === "general")}
              tabIndex={-1}
              aria-pressed={settingsTab === "general"}
              onClick={() => setSettingsTab("general")}
            >
              一般
            </button>
            <button
              type="button"
              className={actionBtnClass(settingsTab === "custom")}
              tabIndex={-1}
              aria-pressed={settingsTab === "custom"}
              onClick={() => setSettingsTab("custom")}
            >
              自定義
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {settingsTab === "custom" ? (
              <OverlayScrollbarsComponent
                defer
                className="h-full"
                options={{
                  overflow: { x: "hidden" },
                  scrollbars: {
                    theme: theme === "dark" ? "os-theme-light" : "os-theme-dark",
                    autoHide: "leave",
                    autoHideDelay: 600,
                  },
                }}
              >
                <div className="flex flex-col gap-3 p-1">
                  <TtsDelayEditor
                    delays={ttsDelays ?? parseTtsDelays(null)}
                    onChange={(index, ms) =>
                      setTtsDelays((prev) => {
                        const next = parseTtsDelays(prev);
                        next[index] = ms;
                        return next;
                      })
                    }
                  />
                  <LabelsEditor
                    labels={labels}
                    onChange={(key, value) =>
                      setLabels((prev) => ({ ...prev, [key]: value }))
                    }
                    onReset={() => setLabels({ ...DEFAULT_LABELS })}
                  />
                </div>
              </OverlayScrollbarsComponent>
            ) : (
              <OverlayScrollbarsComponent
                defer
                className="h-full"
                options={{
                  overflow: { x: "hidden" },
                  scrollbars: {
                    theme: theme === "dark" ? "os-theme-light" : "os-theme-dark",
                    autoHide: "leave",
                    autoHideDelay: 600,
                  },
                }}
              >
                <div className="flex flex-col gap-3 p-1">
                  <div>
                    <div className="mb-1 font-bold">偏好</div>
                    <div className={GROUP_BODY}>
                      <table className="w-full border-collapse text-left text-[length:var(--font-size)]">
                        <tbody>
                          <tr className="border-b border-[#c0c0c0] dark:border-[#444]">
                            <td className="whitespace-nowrap py-1.5 pr-3">主題</td>
                            <td className="py-1.5">
                              <div className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  className={actionBtnClass(theme !== "dark")}
                                  tabIndex={-1}
                                  aria-pressed={theme !== "dark"}
                                  onClick={() => setTheme("light")}
                                >
                                  淺色
                                </button>
                                <button
                                  type="button"
                                  className={actionBtnClass(theme === "dark")}
                                  tabIndex={-1}
                                  aria-pressed={theme === "dark"}
                                  onClick={() => setTheme("dark")}
                                >
                                  深色
                                </button>
                              </div>
                            </td>
                          </tr>
                          <tr className="border-b border-[#c0c0c0] dark:border-[#444]">
                            <td className="whitespace-nowrap py-1.5 pr-3">收合方向</td>
                            <td className="py-1.5">
                              <div className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  className={actionBtnClass(edge === "top")}
                                  tabIndex={-1}
                                  aria-pressed={edge === "top"}
                                  onClick={() => setShadeEdge("top")}
                                >
                                  向上
                                </button>
                                <button
                                  type="button"
                                  className={actionBtnClass(edge === "bottom")}
                                  tabIndex={-1}
                                  aria-pressed={edge === "bottom"}
                                  onClick={() => setShadeEdge("bottom")}
                                >
                                  向下
                                </button>
                              </div>
                            </td>
                          </tr>
                          <tr className="border-b border-[#c0c0c0] dark:border-[#444]">
                            <td className="whitespace-nowrap py-1.5 pr-3">行距</td>
                            <td className="py-1.5">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="range"
                                  min={0}
                                  max={MAX_LINE_GAP}
                                  step={1}
                                  value={lineGap ?? DEFAULT_LINE_GAP}
                                  tabIndex={-1}
                                  className="min-w-0 flex-1 accent-[#0078d7]"
                                  onChange={(e) => setLineGap(parseLineGap(e.target.value))}
                                />
                                <span className="w-[3.2em] shrink-0 text-[#555] dark:text-[#aaa]">
                                  {lineGap ?? DEFAULT_LINE_GAP} px
                                </span>
                              </div>
                            </td>
                          </tr>
                          <tr className="border-b border-[#c0c0c0] dark:border-[#444]">
                            <td className="whitespace-nowrap py-1.5 pr-0">文字 Overlay</td>
                            <td className="py-1.5 text-[#555] dark:text-[#aaa]">
                              可拖曳調整位置
                            </td>
                          </tr>
                          <tr className="border-b border-[#c0c0c0] dark:border-[#444]">
                            <td className="whitespace-nowrap py-1.5 pr-3">Show Steps Overlay</td>
                            <td className="py-1.5">
                              <div className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  className={actionBtnClass(debuffOverlay !== false)}
                                  tabIndex={-1}
                                  aria-pressed={debuffOverlay !== false}
                                  onClick={() => setDebuffOverlay(true)}
                                >
                                  開
                                </button>
                                <button
                                  type="button"
                                  className={actionBtnClass(debuffOverlay === false)}
                                  tabIndex={-1}
                                  aria-pressed={debuffOverlay === false}
                                  onClick={() => setDebuffOverlay(false)}
                                >
                                  關
                                </button>
                              </div>
                            </td>
                          </tr>
                          <tr className="border-b border-[#c0c0c0] dark:border-[#444]">
                            <td className="whitespace-nowrap py-1.5 pr-3">Show Original Menu</td>
                            <td className="py-1.5">
                              <div className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  className={actionBtnClass(originalMenu !== false)}
                                  tabIndex={-1}
                                  aria-pressed={originalMenu !== false}
                                  onClick={() => setOriginalMenu(true)}
                                >
                                  開
                                </button>
                                <button
                                  type="button"
                                  className={actionBtnClass(originalMenu === false)}
                                  tabIndex={-1}
                                  aria-pressed={originalMenu === false}
                                  onClick={() => setOriginalMenu(false)}
                                >
                                  關
                                </button>
                              </div>
                            </td>
                          </tr>
                          <tr className="border-b border-[#c0c0c0] dark:border-[#444]">
                            <td className="whitespace-nowrap py-1.5 pr-3">PostNamazu /e</td>
                            <td className="py-1.5">
                              <div className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  className={actionBtnClass(postnamazuEnabled === true)}
                                  tabIndex={-1}
                                  aria-pressed={postnamazuEnabled === true}
                                  onClick={() => setPostnamazuEnabled(true)}
                                >
                                  開
                                </button>
                                <button
                                  type="button"
                                  className={actionBtnClass(postnamazuEnabled !== true)}
                                  tabIndex={-1}
                                  aria-pressed={postnamazuEnabled !== true}
                                  onClick={() => setPostnamazuEnabled(false)}
                                >
                                  關
                                </button>
                              </div>
                            </td>
                          </tr>
                          <tr className="border-b border-[#c0c0c0] dark:border-[#444]">
                            <td className="whitespace-nowrap py-1.5 pr-3">ACT TTS</td>
                            <td className="py-1.5">
                              <div className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  className={actionBtnClass(actTtsEnabled !== false)}
                                  tabIndex={-1}
                                  aria-pressed={actTtsEnabled !== false}
                                  onClick={() => setActTtsEnabled(true)}
                                >
                                  開
                                </button>
                                <button
                                  type="button"
                                  className={actionBtnClass(actTtsEnabled === false)}
                                  tabIndex={-1}
                                  aria-pressed={actTtsEnabled === false}
                                  onClick={() => setActTtsEnabled(false)}
                                >
                                  關
                                </button>
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <td className="whitespace-nowrap py-1.5 pr-3">日誌正則</td>
                            <td className="py-1.5">
                              <input
                                type="text"
                                value={logRegex ?? DEFAULT_LOG_REGEX}
                                placeholder={DEFAULT_LOG_REGEX}
                                autoComplete="off"
                                spellCheck={false}
                                className="box-border w-full min-w-0 rounded-sm border border-[#adadad] bg-[var(--btn-bg)] px-1.5 py-0.5 font-[inherit] text-[length:var(--font-size)] text-black outline-none select-text focus:border-[#0078d7] dark:border-[#555] dark:text-white"
                                onChange={(e) => setLogRegex(e.target.value)}
                              />
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 font-bold">測試</div>
                    <div className={GROUP_BODY}>
                      <table className="w-full border-collapse text-left text-[length:var(--font-size)]">
                        <tbody>
                          {postnamazuEnabled === true ? (
                            <tr className="border-b border-[#c0c0c0] dark:border-[#444]">
                              <td className="whitespace-nowrap py-1.5 pr-3">/e</td>
                              <td className="py-1.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <button
                                    type="button"
                                    className={actionBtnClass(false)}
                                    tabIndex={-1}
                                    disabled={!isTauri()}
                                    onClick={() => {
                                      if (!isTauri()) return;
                                      setPostnamazuTest("…");
                                      invoke("postnamazu_command", {
                                        command: "command",
                                        payload: "/e P4 Calculator",
                                        port: postnamazuPort ?? DEFAULT_POSTNAMAZU_PORT,
                                      })
                                        .then(() => setPostnamazuTest("OK"))
                                        .catch((err: unknown) =>
                                          setPostnamazuTest(
                                            typeof err === "string"
                                              ? err
                                              : err instanceof Error
                                                ? err.message
                                                : String(err),
                                          ),
                                        );
                                    }}
                                  >
                                    測試
                                  </button>
                                  <span className="text-[#555] dark:text-[#aaa]">端口</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={65535}
                                    value={postnamazuPort ?? DEFAULT_POSTNAMAZU_PORT}
                                    autoComplete="off"
                                    spellCheck={false}
                                    className={delayInputClass()}
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      if (raw === "") {
                                        setPostnamazuPort(DEFAULT_POSTNAMAZU_PORT);
                                        return;
                                      }
                                      setPostnamazuPort(parsePostnamazuPort(raw));
                                    }}
                                  />
                                  {postnamazuTest ? (
                                    <span className="min-w-0 text-[#555] dark:text-[#aaa]">
                                      {postnamazuTest}
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          ) : null}
                          <tr className="border-b border-[#c0c0c0] dark:border-[#444]">
                            <td className="whitespace-nowrap py-1.5 pr-3">TTS</td>
                            <td className="py-1.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  className={actionBtnClass(false)}
                                  tabIndex={-1}
                                  disabled={!isTauri()}
                                  onClick={() => {
                                    if (!isTauri()) return;
                                    setActTtsTest("…");
                                    invoke("act_tts_say", { text: "TTS 測試成功" })
                                      .then(() => setActTtsTest("應已播放"))
                                      .catch((err: unknown) =>
                                        setActTtsTest(
                                          typeof err === "string"
                                            ? err
                                            : err instanceof Error
                                              ? err.message
                                              : String(err),
                                        ),
                                      );
                                  }}
                                >
                                  播放
                                </button>
                                <span className="text-[#555] dark:text-[#aaa]">端口</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={65535}
                                  value={overlayWsPort ?? DEFAULT_OVERLAY_WS_PORT}
                                  autoComplete="off"
                                  spellCheck={false}
                                  className={delayInputClass()}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    if (raw === "") {
                                      setOverlayWsPort(DEFAULT_OVERLAY_WS_PORT);
                                      return;
                                    }
                                    setOverlayWsPort(parseOverlayWsPort(raw));
                                  }}
                                />
                                {actTtsTest ? (
                                  <span className="min-w-0 text-[#555] dark:text-[#aaa]">
                                    {actTtsTest}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <td className="whitespace-nowrap py-1.5 pr-3">正則</td>
                            <td className="py-1.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  className={actionBtnClass(false)}
                                  tabIndex={-1}
                                  disabled={!isTauri()}
                                  onClick={() => {
                                    if (!isTauri()) return;
                                    setRegexTest("…");
                                    invoke<string>("act_tts_trigger")
                                      .then((msg) => setRegexTest(msg))
                                      .catch((err: unknown) =>
                                        setRegexTest(
                                          typeof err === "string"
                                            ? err
                                            : err instanceof Error
                                              ? err.message
                                              : String(err),
                                        ),
                                      );
                                  }}
                                >
                                  觸發
                                </button>
                                {regexTest ? (
                                  <span className="min-w-0 text-[#555] dark:text-[#aaa]">
                                    {regexTest}
                                  </span>
                                ) : (
                                  <span className="min-w-0 text-[#555] dark:text-[#aaa]">
                                    模擬日誌命中
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <td className="whitespace-nowrap py-1.5 pr-3">排程</td>
                            <td className="py-1.5">
                              <button
                                type="button"
                                className={actionBtnClass(false)}
                                tabIndex={-1}
                                disabled={!isTauri()}
                                onClick={() => {
                                  if (!isTauri()) return;
                                  invoke("cancel_scheduled_tts")
                                    .then(() => setActTtsTest("已停止並清除排程"))
                                    .catch((err: unknown) =>
                                      setActTtsTest(
                                        typeof err === "string"
                                          ? err
                                          : err instanceof Error
                                            ? err.message
                                            : String(err),
                                      ),
                                    );
                                }}
                              >
                                停止並清除全部排程
                              </button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </OverlayScrollbarsComponent>
            )}
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-1.5 p-1">
            {changeButton}
          </div>
        </div>
      </main>
    );
  }

  if (originalMenu === false) {
    return (
      <main className="h-full w-full select-none overflow-hidden bg-[var(--app-bg)] text-black dark:text-[#e8e8e8]">
        <div className="flex h-full items-center gap-1.5 p-2">
          <button
            type="button"
            className={actionBtnClass(false)}
            tabIndex={-1}
            onClick={clearCalculator}
          >
            清除
          </button>
          {changeButton}
        </div>
      </main>
    );
  }

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
          <hr className="my-1 mt-2 mb-3 border-0 border-t border-[#c0c0c0] dark:border-[#444]" />
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
              onClick={clearCalculator}
            >
              清除
            </button>
            {changeButton}
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

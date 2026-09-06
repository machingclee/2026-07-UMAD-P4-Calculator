import type { ReactNode } from "react";
import speedIcon from "./assets/speed.webp";
import waterIcon from "./assets/water.webp";
import lightIcon from "./assets/light.webp";
import {
  DRAG_BG,
  FIRE_COLOR_DARK,
  STEPS_OVERLAY_BADGE_FONT_SIZE,
  STEPS_OVERLAY_DIM_OPACITY,
  STEPS_OVERLAY_EMOJI_SIZE,
  STEPS_OVERLAY_FONT_SIZE,
  STEPS_OVERLAY_QUESTION_SIZE,
  STEPS_OVERLAY_SIZE,
  QUESTION_COLOR_DARK,
  SPEED,
  THUNDER,
  TRUE_FALSE,
  WATER,
  WATER_COLOR_DARK,
} from "./constants";
import {
  isExcluded,
  toggleValue,
  type State,
  type WizardStep,
} from "./state";

const LABEL_STROKE =
  "-1px -1px 0 #000000, 1px -1px 0 #000000, -1px 1px 0 #000000, 1px 1px 0 #000000";

function QuestionMark({ color }: { color?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="inline-block shrink-0 align-middle"
      style={{
        width: STEPS_OVERLAY_QUESTION_SIZE,
        height: STEPS_OVERLAY_QUESTION_SIZE,
        color: color ?? QUESTION_COLOR_DARK,
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

function OverlayLabel({
  text,
  color,
}: {
  text: string;
  color?: string;
}) {
  const parts = text.split(/(❓|？)/);
  return (
    <span style={{ color: color ?? "#ffffff", textShadow: LABEL_STROKE }}>
      {parts.map((part, i) =>
        part === "❓" || part === "？" ? (
          <QuestionMark key={i} color={color ?? QUESTION_COLOR_DARK} />
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

function OverlayButton({
  selected,
  disabled,
  color,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  color?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
      className="appearance-none rounded-sm border px-3 py-1 font-bold leading-snug"
      style={{
        fontSize: STEPS_OVERLAY_FONT_SIZE,
        cursor: disabled ? "default" : "pointer",
        color: color ?? "#ffffff",
        background: selected ? "rgba(27, 61, 85, 0.92)" : "rgba(0, 0, 0, 0.45)",
        borderColor: selected ? "#8ec8ff" : "rgba(255, 255, 255, 0.35)",
        opacity: disabled ? STEPS_OVERLAY_DIM_OPACITY : 1,
        WebkitTextStroke: "0.4px #000000",
        paintOrder: "stroke fill",
        textShadow: LABEL_STROKE,
      }}
    >
      {children}
    </button>
  );
}

function Caption({ text }: { text: string }) {
  return (
    <div
      className="font-bold leading-none"
      style={{
        color: "#ffffff",
        textShadow: LABEL_STROKE,
        fontSize: STEPS_OVERLAY_FONT_SIZE,
      }}
    >
      {text}
    </div>
  );
}

function TfRow({
  value,
  disabled,
  onSet,
}: {
  value: string;
  disabled?: boolean;
  onSet: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <OverlayButton
        selected={value === TRUE_FALSE[0]}
        disabled={disabled}
        onClick={() => onSet(toggleValue(value, TRUE_FALSE[0]))}
      >
        <OverlayLabel text="真 十字" />
      </OverlayButton>
      <OverlayButton
        selected={value === TRUE_FALSE[1]}
        disabled={disabled}
        onClick={() => onSet(toggleValue(value, TRUE_FALSE[1]))}
      >
        <OverlayLabel text="❓ 十字" />
      </OverlayButton>
    </div>
  );
}

function FireWaterRow({
  kind,
  value,
  disabled,
  onSet,
}: {
  kind: "fire" | "water";
  value: string;
  disabled?: boolean;
  onSet: (value: string) => void;
}) {
  const color = kind === "fire" ? FIRE_COLOR_DARK : WATER_COLOR_DARK;
  const trueText = kind === "fire" ? "真火" : "真水";
  const askText = kind === "fire" ? "❓火" : "❓水";
  const icon = kind === "fire" ? "🔥" : "💧";
  return (
    <div className="flex items-center gap-1">
      <span
        className="mr-0.5 shrink-0 font-bold leading-none"
        style={{ fontSize: STEPS_OVERLAY_EMOJI_SIZE, color, textShadow: LABEL_STROKE }}
      >
        {icon}
      </span>
      <OverlayButton
        selected={value === TRUE_FALSE[0]}
        disabled={disabled}
        color={color}
        onClick={() => onSet(toggleValue(value, TRUE_FALSE[0]))}
      >
        <OverlayLabel text={trueText} color={color} />
      </OverlayButton>
      <OverlayButton
        selected={value === TRUE_FALSE[1]}
        disabled={disabled}
        color={color}
        onClick={() => onSet(toggleValue(value, TRUE_FALSE[1]))}
      >
        <OverlayLabel text={askText} color={color} />
      </OverlayButton>
    </div>
  );
}

function actionIconSrc(choice: string): string | undefined {
  if (choice.includes("⏩")) return speedIcon;
  if (choice.includes("💧")) return waterIcon;
  if (choice.includes("⚡")) return lightIcon;
  return undefined;
}

function ActionCell({
  choice,
  badge,
  selected,
  dimmed,
  disabled,
  onClick,
}: {
  choice: string;
  badge: string;
  selected: boolean;
  dimmed: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const src = actionIconSrc(choice);
  return (
    <button
      type="button"
      tabIndex={-1}
      disabled={disabled || dimmed}
      aria-pressed={selected}
      onClick={onClick}
      className="flex appearance-none flex-col items-center rounded-sm border-0 bg-transparent p-0"
      style={{
        width: STEPS_OVERLAY_SIZE,
        cursor: disabled || dimmed ? "default" : "pointer",
        opacity: dimmed ? STEPS_OVERLAY_DIM_OPACITY : 1,
        outline: selected ? "2px solid #8ec8ff" : "2px solid transparent",
        outlineOffset: 0,
      }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          className="pointer-events-none object-contain"
          style={{ width: STEPS_OVERLAY_SIZE, height: STEPS_OVERLAY_SIZE }}
          draggable={false}
        />
      ) : null}
      <span
        className="pointer-events-none whitespace-nowrap font-bold leading-none"
        style={{
          marginTop: -6,
          fontSize: STEPS_OVERLAY_BADGE_FONT_SIZE,
          color: "#ffffff",
          WebkitTextStroke: "1px #000000",
          paintOrder: "stroke fill",
          textShadow: LABEL_STROKE,
        }}
      >
        {badge}
      </span>
    </button>
  );
}

function ActionGrid({
  rnd,
  state,
  disabled,
  badges,
  onSet,
}: {
  rnd: "round1" | "round2";
  state: State;
  disabled?: boolean;
  badges: readonly [string, string];
  onSet: (key: string, value: string) => void;
}) {
  const columns: { key: "speed" | "water" | "thunder"; choices: readonly string[] }[] = [
    { key: "speed", choices: SPEED },
    { key: "water", choices: WATER },
    { key: "thunder", choices: THUNDER },
  ];
  return (
    <div className="flex" style={{ gap: 0 }}>
      {columns.map((col, j) => {
        const dimmed = isExcluded(state, rnd, col.key);
        const current = state[`${rnd}_${col.key}`] ?? "";
        return (
          <div key={col.key} className="flex flex-col gap-1">
            {col.choices.map((choice, i) => (
              <div style={{ marginBottom: i === 0 ? 5 : 0, width: j === 2 ? "unset" : 80 }}>
                <ActionCell
                  key={choice}
                  choice={choice}
                  badge={badges[i]}
                  selected={current === choice}
                  dimmed={dimmed}
                  disabled={disabled}
                  onClick={() =>
                    onSet(`${rnd}_${col.key}`, toggleValue(current, choice))
                  }
                />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function StepsOverlayWizard({
  state,
  step,
  dragEnabled,
  onSet,
}: {
  state: State;
  step: WizardStep;
  dragEnabled: boolean;
  onSet: (key: string, value: string) => void;
}) {
  const locked = dragEnabled;
  return (
    <div
      className={`box-border flex flex-col gap-1.5 ${dragEnabled ? "cursor-move rounded px-3.5 py-2.5" : "rounded px-2 py-1.5"
        }`}
      {...(dragEnabled ? { "data-tauri-drag-region": true } : {})}
      style={{ background: dragEnabled ? DRAG_BG : "transparent" }}
    >
      {step === 1 ? (
        <>
          <Caption text="1st" />
          <TfRow
            value={state.round1_tf}
            disabled={locked}
            onSet={(value) => onSet("round1_tf", value)}
          />
        </>
      ) : null}
      {step === 2 ? (
        <>
          <FireWaterRow
            kind="fire"
            value={state.fire}
            disabled={locked}
            onSet={(value) => onSet("fire", value)}
          />

          <FireWaterRow
            kind="water"
            value={state.water}
            disabled={locked}
            onSet={(value) => onSet("water", value)}
          />
        </>
      ) : null}
      {step === 3 ? (
        <>
          <Caption text="1st" />
          <ActionGrid
            rnd="round1"
            state={state}
            disabled={locked}
            badges={["0~50", "1m"]}
            onSet={onSet}
          />
        </>
      ) : null}
      {step === 4 ? (
        <>
          <Caption text="2nd" />
          <TfRow
            value={state.round2_tf}
            disabled={locked}
            onSet={(value) => onSet("round2_tf", value)}
          />
        </>
      ) : null}
      {step === 5 ? (
        <>
          {!state.fire ? (
            <FireWaterRow
              kind="fire"
              value={state.fire}
              disabled={locked}
              onSet={(value) => onSet("fire", value)}
            />
          ) : null}
          {!state.water ? (
            <FireWaterRow
              kind="water"
              value={state.water}
              disabled={locked}
              onSet={(value) => onSet("water", value)}
            />
          ) : null}
        </>
      ) : null}
      {step === 6 ? (
        <>
          <Caption text="2nd" />
          <ActionGrid
            rnd="round2"
            state={state}
            disabled={locked}
            badges={["0~35", "36~1m"]}
            onSet={onSet}
          />
        </>
      ) : null}
      {step === 7 ? (
        <>
          <div className="flex items-center gap-4">
            <Caption text="石化眼--雷" />
            <OverlayButton
              selected={state.thunder === "？"}
              disabled={locked}
              onClick={() => onSet("thunder", toggleValue(state.thunder, "？"))}
            >
              <OverlayLabel text="？" />
            </OverlayButton>
          </div>
          <div className="flex items-center gap-4">
            <Caption text="二回目--冰" />
            <OverlayButton
              selected={state.ice === "？"}
              disabled={locked}
              onClick={() => onSet("ice", toggleValue(state.ice, "？"))}
            >
              <OverlayLabel text="？" />
            </OverlayButton>
          </div>
        </>
      ) : null}
    </div>
  );
}

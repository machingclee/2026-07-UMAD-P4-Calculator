import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { calculate } from "./calculate";
import { isTauri, publishOverlayText } from "./env";
import {
  EMPTY_STATE,
  SPEED,
  State,
  THUNDER,
  WATER,
  isExcluded,
  toggleValue,
} from "./state";
import "./App.css";

type Choice = string | [string, string];

function choiceParts(choice: Choice): { text: string; value: string } {
  if (Array.isArray(choice)) {
    return { text: choice[0], value: choice[1] };
  }
  return { text: choice, value: choice };
}

function ToggleButton({
  text,
  selected,
  disabled,
  hidden,
  color,
  onClick,
}: {
  text: string;
  selected: boolean;
  disabled?: boolean;
  hidden?: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`toggle${selected ? " selected" : ""}${hidden ? " hidden-slot" : ""}`}
      style={color && !hidden ? { color } : undefined}
      aria-pressed={selected}
      disabled={disabled || hidden}
      tabIndex={-1}
      onClick={onClick}
    >
      {hidden ? "" : text}
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
    <div className="radio-group">
      <span className="radio-label" style={color ? { color } : undefined}>
        {label}
      </span>
      {choices.map((choice) => {
        const { text, value: val } = choiceParts(choice);
        return (
          <ToggleButton
            key={val}
            text={text}
            selected={value === val}
            color={color}
            onClick={() => onChange(toggleValue(value, val))}
          />
        );
      })}
    </div>
  );
}

function RadioGroupV({
  choices,
  value,
  disabled,
  hidden,
  onChange,
}: {
  choices: string[];
  value: string;
  disabled: boolean;
  hidden: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="radio-group-v">
      {choices.map((choice) => (
        <ToggleButton
          key={choice}
          text={choice}
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
  const localOn = tf !== "";
  const speedEx = isExcluded(state, rnd, "speed");
  const waterEx = isExcluded(state, rnd, "water");
  const thunderEx = isExcluded(state, rnd, "thunder");

  return (
    <div className="round-block">
      <div className="title-row">
        <span className="round-title">{title}</span>
        <ToggleButton
          text="真—十字"
          selected={tf === "真"}
          onClick={() => setField(`${rnd}_tf`, toggleValue(tf, "真"))}
        />
        <ToggleButton
          text="假—十字"
          selected={tf === "？"}
          onClick={() => setField(`${rnd}_tf`, toggleValue(tf, "？"))}
        />
      </div>
      <div className="action-row">
        <div className="row-labels">
          {rowLabels.map((lbl) => (
            <span key={lbl}>{lbl}</span>
          ))}
        </div>
        <RadioGroupV
          choices={SPEED}
          value={state[`${rnd}_speed`] ?? ""}
          disabled={!localOn || speedEx}
          hidden={speedEx}
          onChange={(v) => setField(`${rnd}_speed`, v)}
        />
        <RadioGroupV
          choices={WATER}
          value={state[`${rnd}_water`] ?? ""}
          disabled={!localOn || waterEx}
          hidden={waterEx}
          onChange={(v) => setField(`${rnd}_water`, v)}
        />
        <RadioGroupV
          choices={THUNDER}
          value={state[`${rnd}_thunder`] ?? ""}
          disabled={!localOn || thunderEx}
          hidden={thunderEx}
          onChange={(v) => setField(`${rnd}_thunder`, v)}
        />
      </div>
    </div>
  );
}

function App() {
  const [state, setState] = useState<State>(EMPTY_STATE);

  const setField = useCallback((key: string, value: string) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    if (isTauri()) {
      invoke("calculate_text", { state }).catch(() => {});
      return;
    }
    publishOverlayText(calculate(state));
  }, [state]);

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
    <main className="app">
      <div className="columns">
        <section className="col left">
          <RadioGroup
            label="🔥"
            choices={[
              ["真—火", "真"],
              ["假—火", "？"],
            ]}
            value={state.fire}
            color="#cc3300"
            onChange={(v) => setField("fire", v)}
          />
          <RadioGroup
            label="💧"
            choices={[
              ["真—水", "真"],
              ["假—水", "？"],
            ]}
            value={state.water}
            color="#0066cc"
            onChange={(v) => setField("water", v)}
          />
          <hr />
          <RadioGroup
            label="石化眼雷"
            choices={["？"]}
            value={state.thunder}
            onChange={(v) => setField("thunder", v)}
          />
          <RadioGroup
            label="二回目冰"
            choices={["？"]}
            value={state.ice}
            onChange={(v) => setField("ice", v)}
          />
          <button
            type="button"
            className="clear-btn"
            tabIndex={-1}
            onClick={() => setState({ ...EMPTY_STATE })}
          >
            清除
          </button>
        </section>

        <section className="col right">
          <RoundBlock
            title="1st"
            rowLabels={["0~50", "1m"]}
            rnd="round1"
            state={state}
            setField={setField}
          />
          <hr />
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

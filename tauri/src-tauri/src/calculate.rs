use std::collections::HashMap;

pub type State = HashMap<String, String>;

fn get<'a>(state: &'a State, key: &str) -> &'a str {
    state.get(key).map(String::as_str).unwrap_or("")
}

/// Same as python/main.py `_actions`.
fn actions(selections: &State, prefix: &str) -> Vec<&'static str> {
    let mut out = Vec::new();
    for rnd in ["round1", "round2"] {
        let tf = get(selections, &format!("{rnd}_tf"));
        if tf.is_empty() {
            continue;
        }
        let is_true = tf == "真";
        let spd = get(selections, &format!("{rnd}_speed"));
        let wat = get(selections, &format!("{rnd}_water"));
        let thu = get(selections, &format!("{rnd}_thunder"));
        if spd.contains(prefix) {
            out.push(if is_true { "不動" } else { "動" });
        }
        if wat.contains(prefix) {
            out.push(if is_true { "水分攤" } else { "水出去" });
        }
        if thu.contains(prefix) {
            out.push(if is_true { "雷出去" } else { "雷分攤" });
        }
    }
    out
}

/// Same as python/main.py `calculate`.
pub fn calculate(state: &State) -> String {
    let mut lines: Vec<String> = Vec::new();
    for (rnd, prefix) in [("round1", "1"), ("round2", "2")] {
        let tf = get(state, &format!("{rnd}_tf"));
        let eye = if tf == "真" {
            "背對眼"
        } else if !tf.is_empty() {
            "面對眼"
        } else {
            ""
        };
        let acts = actions(state, prefix);
        if tf.is_empty() && acts.is_empty() {
            continue;
        }
        if !lines.is_empty() {
            lines.push(String::new());
        }
        let label = if rnd == "round1" { "R1" } else { "R2" };
        let action_text = acts.join("  ");
        lines.push(format!("{label} {action_text}").trim().to_string());
        if !eye.is_empty() {
            lines.push(format!("  {eye}"));
        }
        if rnd == "round1" {
            let f_val = get(state, "fire");
            if !f_val.is_empty() {
                lines.push(format!(
                    "  {}",
                    if f_val == "真" { "放鋼鐵" } else { "放月環" }
                ));
            }
        } else {
            let w_val = get(state, "water");
            if !w_val.is_empty() {
                lines.push(format!(
                    "  {}",
                    if w_val == "真" { "放月環" } else { "放鋼鐵" }
                ));
            }
        }
    }
    lines.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn s(pairs: &[(&str, &str)]) -> State {
        pairs
            .iter()
            .map(|(k, v)| ((*k).to_string(), (*v).to_string()))
            .collect()
    }

    #[test]
    fn empty_state_is_blank() {
        assert_eq!(calculate(&State::new()), "");
    }

    #[test]
    fn fire_alone_does_nothing() {
        assert_eq!(calculate(&s(&[("fire", "真")])), "");
    }

    #[test]
    fn r1_true_cross_only() {
        assert_eq!(calculate(&s(&[("round1_tf", "真")])), "R1\n  背對眼");
    }

    #[test]
    fn r1_false_cross_with_fire() {
        assert_eq!(
            calculate(&s(&[("round1_tf", "？"), ("fire", "真")])),
            "R1\n  面對眼\n  放鋼鐵"
        );
    }

    #[test]
    fn r1_true_fire_fake() {
        assert_eq!(
            calculate(&s(&[("round1_tf", "真"), ("fire", "？")])),
            "R1\n  背對眼\n  放月環"
        );
    }

    #[test]
    fn r1_speed1_true() {
        assert_eq!(
            calculate(&s(&[("round1_tf", "真"), ("round1_speed", "1 ⏩")])),
            "R1 不動\n  背對眼"
        );
    }

    #[test]
    fn r1_all_actions_false() {
        assert_eq!(
            calculate(&s(&[
                ("round1_tf", "？"),
                ("round1_speed", "1 ⏩"),
                ("round1_water", "1 💧"),
                ("round1_thunder", "1 ⚡"),
            ])),
            "R1 動  水出去  雷分攤\n  面對眼"
        );
    }

    #[test]
    fn r2_true_water_true() {
        assert_eq!(
            calculate(&s(&[("round2_tf", "真"), ("water", "真")])),
            "R2\n  背對眼\n  放月環"
        );
    }

    #[test]
    fn r2_false_water_fake() {
        assert_eq!(
            calculate(&s(&[("round2_tf", "？"), ("water", "？")])),
            "R2\n  面對眼\n  放鋼鐵"
        );
    }

    #[test]
    fn r2_actions_true() {
        assert_eq!(
            calculate(&s(&[
                ("round2_tf", "真"),
                ("round2_speed", "2 ⏩"),
                ("round2_water", "2 💧"),
                ("round2_thunder", "2 ⚡"),
            ])),
            "R2 不動  水分攤  雷出去\n  背對眼"
        );
    }

    #[test]
    fn both_rounds() {
        let text = calculate(&s(&[
            ("round1_tf", "真"),
            ("round2_tf", "？"),
            ("fire", "真"),
            ("water", "真"),
            ("round1_speed", "1 ⏩"),
            ("round2_water", "2 💧"),
        ]));
        assert_eq!(
            text,
            "R1 不動\n  背對眼\n  放鋼鐵\n\nR2 水出去\n  面對眼\n  放月環"
        );
    }

    #[test]
    fn prefix_crosses_rounds() {
        // Speed "1" selected in round2 still contributes to R1 actions,
        // using round2's 真/假 — same as python `_actions`.
        let text = calculate(&s(&[
            ("round1_tf", "真"),
            ("round2_tf", "？"),
            ("round2_speed", "1 ⏩"),
        ]));
        assert_eq!(text, "R1 動\n  背對眼\n\nR2\n  面對眼");
    }

    #[test]
    fn r2_only_from_r1_prefixed_action() {
        let text = calculate(&s(&[("round1_tf", "真"), ("round1_water", "2 💧")]));
        assert_eq!(text, "R1\n  背對眼\n\nR2 水分攤");
    }
}

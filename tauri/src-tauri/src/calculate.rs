use std::collections::HashMap;

pub type State = HashMap<String, String>;
pub type Labels = HashMap<String, String>;

fn get<'a>(state: &'a State, key: &str) -> &'a str {
    state.get(key).map(String::as_str).unwrap_or("")
}

fn label<'a>(labels: &'a Labels, key: &str, default: &'static str) -> &'a str {
    match labels.get(key) {
        Some(value) => value.as_str(),
        None => default,
    }
}

/// Empty omits the line. `\n` in the field becomes a real newline.
fn lines_from_label(text: &str) -> Option<Vec<String>> {
    if text.is_empty() {
        return None;
    }
    let expanded = text.replace("\\n", "\n");
    if !expanded.is_empty() && expanded.chars().all(|c| c == '\n') {
        return Some(vec![String::new(); expanded.len()]);
    }
    Some(expanded.split('\n').map(str::to_string).collect())
}

fn push_label(lines: &mut Vec<String>, text: &str, indent: &str) {
    if let Some(parts) = lines_from_label(text) {
        for part in parts {
            lines.push(format!("{indent}{part}"));
        }
    }
}

/// 水出/雷出 may be blank; 水分攤/雷分攤 fall back to 分攤.
fn water_thunder_word(text: &str, is_out: bool) -> String {
    if !text.is_empty() {
        text.to_string()
    } else if is_out {
        String::new()
    } else {
        "分攤".to_string()
    }
}

/// Same as python/main.py `_actions`.
fn actions(selections: &State, prefix: &str, labels: &Labels) -> Vec<String> {
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
            out.push(
                if is_true {
                    label(labels, "stay", "不動")
                } else {
                    label(labels, "move", "要動")
                }
                .to_string(),
            );
        }
        if wat.contains(prefix) {
            out.push(if is_true {
                water_thunder_word(label(labels, "waterShare", "水分攤"), false)
            } else {
                water_thunder_word(label(labels, "waterOut", "水出"), true)
            });
        }
        if thu.contains(prefix) {
            out.push(if is_true {
                water_thunder_word(label(labels, "thunderOut", "雷出"), true)
            } else {
                water_thunder_word(label(labels, "thunderShare", "雷分攤"), false)
            });
        }
    }
    out.into_iter().filter(|s| !s.is_empty()).collect()
}

fn r2_step_hint<'a>(state: &State, labels: &'a Labels) -> &'a str {
    let is_thunder_faked = !get(state, "thunder").is_empty();
    let is_ice_faked = !get(state, "ice").is_empty();
    match (is_thunder_faked, is_ice_faked) {
        (true, true) => label(labels, "stepBoth", "都踩"),
        (true, false) => label(labels, "stepThunder", "踩雷"),
        (false, true) => label(labels, "stepIce", "踩冰"),
        (false, false) => label(labels, "stepNone", "都不踩"),
    }
}

/// Same as python/main.py `calculate`.
pub fn calculate(state: &State) -> String {
    calculate_labeled(state, &Labels::new())
}

pub fn calculate_labeled(state: &State, labels: &Labels) -> String {
    let mut lines: Vec<String> = Vec::new();
    for (rnd, prefix) in [("round1", "1"), ("round2", "2")] {
        let tf = get(state, &format!("{rnd}_tf"));
        let eye = if tf == "真" {
            label(labels, "lookAway", "背眼")
        } else if !tf.is_empty() {
            label(labels, "lookAt", "望眼")
        } else {
            ""
        };
        let acts = actions(state, prefix, labels);
        if tf.is_empty() && acts.is_empty() {
            continue;
        }
        let mut block = Vec::new();
        let round_label = if rnd == "round1" {
            label(labels, "r1", "R1")
        } else {
            label(labels, "r2", "R2")
        };
        push_label(&mut block, round_label, "");
        if !acts.is_empty() {
            push_label(&mut block, &acts.join("  "), "  ");
        }
        push_label(&mut block, eye, "  ");
        if rnd == "round1" {
            let f_val = get(state, "fire");
            if !f_val.is_empty() {
                let place = if f_val == "真" {
                    label(labels, "steel", "放鋼鐵")
                } else {
                    label(labels, "moon", "放月環")
                };
                push_label(&mut block, place, "  ");
            }
        } else {
            let w_val = get(state, "water");
            if !w_val.is_empty() {
                let place = if w_val == "真" {
                    label(labels, "moon", "放月環")
                } else {
                    label(labels, "steel", "放鋼鐵")
                };
                let hint = r2_step_hint(state, labels);
                let parts: Vec<&str> = [place, hint]
                    .into_iter()
                    .filter(|s| !s.is_empty())
                    .collect();
                if !parts.is_empty() {
                    push_label(&mut block, &parts.join(" "), "  ");
                }
            }
        }
        if block.is_empty() {
            continue;
        }
        lines.extend(block);
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
        assert_eq!(calculate(&s(&[("round1_tf", "真")])), "R1\n  背眼");
    }

    #[test]
    fn r1_false_cross_with_fire() {
        assert_eq!(
            calculate(&s(&[("round1_tf", "？"), ("fire", "真")])),
            "R1\n  望眼\n  放鋼鐵"
        );
    }

    #[test]
    fn r1_true_fire_fake() {
        assert_eq!(
            calculate(&s(&[("round1_tf", "真"), ("fire", "？")])),
            "R1\n  背眼\n  放月環"
        );
    }

    #[test]
    fn r1_speed1_true() {
        assert_eq!(
            calculate(&s(&[("round1_tf", "真"), ("round1_speed", "1 ⏩")])),
            "R1\n  不動\n  背眼"
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
            "R1\n  要動  水出  雷分攤\n  望眼"
        );
    }

    #[test]
    fn r2_true_water_true() {
        assert_eq!(
            calculate(&s(&[("round2_tf", "真"), ("water", "真")])),
            "R2\n  背眼\n  放月環 都不踩"
        );
    }

    #[test]
    fn r2_false_water_fake() {
        assert_eq!(
            calculate(&s(&[("round2_tf", "？"), ("water", "？")])),
            "R2\n  望眼\n  放鋼鐵 都不踩"
        );
    }

    #[test]
    fn r2_step_ice_only() {
        assert_eq!(
            calculate(&s(&[("round2_tf", "真"), ("water", "真"), ("ice", "？")])),
            "R2\n  背眼\n  放月環 踩冰"
        );
    }

    #[test]
    fn r2_step_thunder_only() {
        assert_eq!(
            calculate(&s(&[("round2_tf", "真"), ("water", "真"), ("thunder", "？")])),
            "R2\n  背眼\n  放月環 踩雷"
        );
    }

    #[test]
    fn r2_step_both() {
        assert_eq!(
            calculate(&s(&[
                ("round2_tf", "真"),
                ("water", "真"),
                ("thunder", "？"),
                ("ice", "？"),
            ])),
            "R2\n  背眼\n  放月環 都踩"
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
            "R2\n  不動  水分攤  雷出\n  背眼"
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
            "R1\n  不動\n  背眼\n  放鋼鐵\nR2\n  水出\n  望眼\n  放月環 都不踩"
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
        assert_eq!(text, "R1\n  要動\n  背眼\nR2\n  望眼");
    }

    #[test]
    fn r2_only_from_r1_prefixed_action() {
        let text = calculate(&s(&[("round1_tf", "真"), ("round1_water", "2 💧")]));
        assert_eq!(text, "R1\n  背眼\nR2\n  水分攤");
    }

    #[test]
    fn custom_labels_replace_defaults() {
        let mut labels = Labels::new();
        labels.insert("r1".into(), "第一".into());
        labels.insert("stay".into(), "Stand".into());
        let text = calculate_labeled(
            &s(&[("round1_tf", "真"), ("round1_speed", "1 ⏩")]),
            &labels,
        );
        assert_eq!(text, "第一\n  Stand\n  背眼");
    }

    #[test]
    fn empty_label_drops_that_line() {
        let mut labels = Labels::new();
        labels.insert("r1".into(), "".into());
        labels.insert("lookAway".into(), "".into());
        labels.insert("stay".into(), "".into());
        let text = calculate_labeled(
            &s(&[("round1_tf", "真"), ("round1_speed", "1 ⏩")]),
            &labels,
        );
        assert_eq!(text, "");
    }

    #[test]
    fn empty_action_keeps_siblings_on_the_line() {
        let mut labels = Labels::new();
        labels.insert("stay".into(), "".into());
        let text = calculate_labeled(
            &s(&[
                ("round1_tf", "真"),
                ("round1_speed", "1 ⏩"),
                ("round1_water", "1 💧"),
            ]),
            &labels,
        );
        assert_eq!(text, "R1\n  水分攤\n  背眼");
    }

    #[test]
    fn empty_half_of_r2_place_line() {
        let mut labels = Labels::new();
        labels.insert("stepNone".into(), "".into());
        let text = calculate_labeled(&s(&[("round2_tf", "真"), ("water", "真")]), &labels);
        assert_eq!(text, "R2\n  背眼\n  放月環");
    }

    #[test]
    fn empty_share_falls_back_to_fen_tan() {
        let mut labels = Labels::new();
        labels.insert("waterShare".into(), "".into());
        labels.insert("thunderShare".into(), "".into());
        let text = calculate_labeled(
            &s(&[
                ("round1_tf", "真"),
                ("round1_water", "1 💧"),
                ("round2_tf", "？"),
                ("round2_thunder", "2 ⚡"),
            ]),
            &labels,
        );
        assert_eq!(text, "R1\n  分攤\n  背眼\nR2\n  分攤\n  望眼");
    }

    #[test]
    fn empty_out_stays_omitted() {
        let mut labels = Labels::new();
        labels.insert("waterOut".into(), "".into());
        labels.insert("thunderOut".into(), "".into());
        let text = calculate_labeled(
            &s(&[
                ("round1_tf", "？"),
                ("round1_water", "1 💧"),
                ("round2_tf", "真"),
                ("round2_thunder", "2 ⚡"),
            ]),
            &labels,
        );
        assert_eq!(text, "R1\n  望眼\nR2\n  背眼");
    }

    #[test]
    fn escaped_newline_inserts_blank_line() {
        let mut labels = Labels::new();
        labels.insert("r1".into(), "R1\\n".into());
        labels.insert("r2".into(), "".into());
        let text = calculate_labeled(
            &s(&[
                ("round1_tf", "真"),
                ("round2_tf", "真"),
                ("fire", "真"),
                ("water", "真"),
            ]),
            &labels,
        );
        assert_eq!(text, "R1\n\n  背眼\n  放鋼鐵\n  背眼\n  放月環 都不踩");
    }
}

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

fn share_label<'a>(labels: &'a Labels) -> &'a str {
    labels
        .get("share")
        .or_else(|| labels.get("waterShare"))
        .or_else(|| labels.get("thunderShare"))
        .map(String::as_str)
        .unwrap_or("分攤")
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

fn join_parts(parts: &[&str]) -> String {
    parts
        .iter()
        .copied()
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("  ")
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

/// Same as python/main.py `_actions`, with 分攤/水出/雷出 before 要動/不動.
fn actions(selections: &State, prefix: &str, labels: &Labels) -> Vec<String> {
    let mut water_thunder = Vec::new();
    let mut speed_acts = Vec::new();
    let mut has_share = false;
    let share = water_thunder_word(share_label(labels), false);
    for rnd in ["round1", "round2"] {
        let tf = get(selections, &format!("{rnd}_tf"));
        if tf.is_empty() {
            continue;
        }
        let is_true = tf == "真";
        let spd = get(selections, &format!("{rnd}_speed"));
        let wat = get(selections, &format!("{rnd}_water"));
        let thu = get(selections, &format!("{rnd}_thunder"));
        if wat.contains(prefix) {
            if is_true {
                if !has_share {
                    water_thunder.push(share.clone());
                    has_share = true;
                }
            } else {
                let word = water_thunder_word(label(labels, "waterOut", "水出"), true);
                if !word.is_empty() {
                    water_thunder.push(word);
                }
            }
        }
        if thu.contains(prefix) {
            if is_true {
                let word = water_thunder_word(label(labels, "thunderOut", "雷出"), true);
                if !word.is_empty() {
                    water_thunder.push(word);
                }
            } else if !has_share {
                water_thunder.push(share.clone());
                has_share = true;
            }
        }
        if spd.contains(prefix) {
            speed_acts.push(
                if is_true {
                    label(labels, "stay", "不動")
                } else {
                    label(labels, "move", "要動")
                }
                .to_string(),
            );
        }
    }
    water_thunder
        .into_iter()
        .chain(speed_acts)
        .filter(|s| !s.is_empty())
        .collect()
}

fn with_share_if_no_out(mut acts: Vec<String>, labels: &Labels) -> Vec<String> {
    let share = water_thunder_word(share_label(labels), false);
    let water_out = water_thunder_word(label(labels, "waterOut", "水出"), true);
    let thunder_out = water_thunder_word(label(labels, "thunderOut", "雷出"), true);
    let has_out = acts.iter().any(|a| {
        (!water_out.is_empty() && a == &water_out)
            || (!thunder_out.is_empty() && a == &thunder_out)
    });
    let has_share = !share.is_empty() && acts.iter().any(|a| a == &share);
    if !has_out && !has_share && !share.is_empty() {
        acts.insert(0, share);
    }
    acts
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
        let mut acts = actions(state, prefix, labels);
        if tf.is_empty() && acts.is_empty() {
            continue;
        }
        acts = with_share_if_no_out(acts, labels);
        let suffix = label(labels, "recordTf", "記錄真假");
        let mut block = Vec::new();
        let round_label = if rnd == "round1" {
            label(labels, "r1", "R1")
        } else {
            label(labels, "r2", "R2")
        };
        push_label(&mut block, round_label, "");
        if !acts.is_empty() {
            let acts_text = acts.join("  ");
            let line = if rnd == "round2" {
                join_parts(&[&acts_text, suffix])
            } else {
                acts_text
            };
            push_label(&mut block, &line, "  ");
        } else if rnd == "round2" {
            push_label(&mut block, suffix, "  ");
        }
        let eye_line = if rnd == "round1" {
            join_parts(&[eye, suffix])
        } else {
            eye.to_string()
        };
        push_label(&mut block, &eye_line, "  ");
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
        assert_eq!(
            calculate(&s(&[("round1_tf", "真")])),
            "R1\n  分攤\n  背眼  記錄真假"
        );
    }

    #[test]
    fn r1_false_cross_with_fire() {
        assert_eq!(
            calculate(&s(&[("round1_tf", "？"), ("fire", "真")])),
            "R1\n  分攤\n  望眼  記錄真假\n  放鋼鐵"
        );
    }

    #[test]
    fn r1_true_fire_fake() {
        assert_eq!(
            calculate(&s(&[("round1_tf", "真"), ("fire", "？")])),
            "R1\n  分攤\n  背眼  記錄真假\n  放月環"
        );
    }

    #[test]
    fn r1_speed1_true() {
        assert_eq!(
            calculate(&s(&[("round1_tf", "真"), ("round1_speed", "1 ⏩")])),
            "R1\n  分攤  不動\n  背眼  記錄真假"
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
            "R1\n  水出  分攤  要動\n  望眼  記錄真假"
        );
    }

    #[test]
    fn r2_true_water_true() {
        assert_eq!(
            calculate(&s(&[("round2_tf", "真"), ("water", "真")])),
            "R2\n  分攤  記錄真假\n  背眼\n  放月環 都不踩"
        );
    }

    #[test]
    fn r2_false_water_fake() {
        assert_eq!(
            calculate(&s(&[("round2_tf", "？"), ("water", "？")])),
            "R2\n  分攤  記錄真假\n  望眼\n  放鋼鐵 都不踩"
        );
    }

    #[test]
    fn r2_step_ice_only() {
        assert_eq!(
            calculate(&s(&[("round2_tf", "真"), ("water", "真"), ("ice", "？")])),
            "R2\n  分攤  記錄真假\n  背眼\n  放月環 踩冰"
        );
    }

    #[test]
    fn r2_step_thunder_only() {
        assert_eq!(
            calculate(&s(&[("round2_tf", "真"), ("water", "真"), ("thunder", "？")])),
            "R2\n  分攤  記錄真假\n  背眼\n  放月環 踩雷"
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
            "R2\n  分攤  記錄真假\n  背眼\n  放月環 都踩"
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
            "R2\n  分攤  雷出  不動  記錄真假\n  背眼"
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
            "R1\n  分攤  不動\n  背眼  記錄真假\n  放鋼鐵\nR2\n  水出  記錄真假\n  望眼\n  放月環 都不踩"
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
        assert_eq!(
            text,
            "R1\n  分攤  要動\n  背眼  記錄真假\nR2\n  分攤  記錄真假\n  望眼"
        );
    }

    #[test]
    fn r2_only_from_r1_prefixed_action() {
        let text = calculate(&s(&[("round1_tf", "真"), ("round1_water", "2 💧")]));
        assert_eq!(text, "R1\n  分攤\n  背眼  記錄真假\nR2\n  分攤  記錄真假");
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
        assert_eq!(text, "第一\n  分攤  Stand\n  背眼  記錄真假");
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
        assert_eq!(text, "  分攤\n  記錄真假");
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
        assert_eq!(text, "R1\n  分攤\n  背眼  記錄真假");
    }

    #[test]
    fn empty_half_of_r2_place_line() {
        let mut labels = Labels::new();
        labels.insert("stepNone".into(), "".into());
        let text = calculate_labeled(&s(&[("round2_tf", "真"), ("water", "真")]), &labels);
        assert_eq!(text, "R2\n  分攤  記錄真假\n  背眼\n  放月環");
    }

    #[test]
    fn empty_share_falls_back_to_fen_tan() {
        let mut labels = Labels::new();
        labels.insert("share".into(), "".into());
        let text = calculate_labeled(
            &s(&[
                ("round1_tf", "真"),
                ("round1_water", "1 💧"),
                ("round2_tf", "？"),
                ("round2_thunder", "2 ⚡"),
            ]),
            &labels,
        );
        assert_eq!(
            text,
            "R1\n  分攤\n  背眼  記錄真假\nR2\n  分攤  記錄真假\n  望眼"
        );
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
        assert_eq!(
            text,
            "R1\n  分攤\n  望眼  記錄真假\nR2\n  分攤  記錄真假\n  背眼"
        );
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
        assert_eq!(
            text,
            "R1\n\n  分攤\n  背眼  記錄真假\n  放鋼鐵\n  分攤  記錄真假\n  背眼\n  放月環 都不踩"
        );
    }

    #[test]
    fn custom_record_tf_replaces_default() {
        let mut labels = Labels::new();
        labels.insert("recordTf".into(), "記TF".into());
        let text = calculate_labeled(
            &s(&[
                ("round1_tf", "真"),
                ("round2_tf", "真"),
                ("round1_speed", "1 ⏩"),
                ("round2_speed", "2 ⏩"),
            ]),
            &labels,
        );
        assert_eq!(
            text,
            "R1\n  分攤  不動\n  背眼  記TF\nR2\n  分攤  不動  記TF\n  背眼"
        );
    }

    #[test]
    fn empty_record_tf_omits_suffix() {
        let mut labels = Labels::new();
        labels.insert("recordTf".into(), "".into());
        let text = calculate_labeled(
            &s(&[
                ("round1_tf", "真"),
                ("round2_tf", "真"),
                ("round1_speed", "1 ⏩"),
                ("round2_speed", "2 ⏩"),
            ]),
            &labels,
        );
        assert_eq!(text, "R1\n  分攤  不動\n  背眼\nR2\n  分攤  不動\n  背眼");
    }
}

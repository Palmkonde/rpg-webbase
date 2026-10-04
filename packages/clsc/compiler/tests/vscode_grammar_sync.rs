use serde_json::Value;
use std::collections::BTreeSet;
use std::path::Path;

/// The VS Code grammar repeats the pest `keyword` rule by hand, so a keyword added to the language
/// would otherwise go unhighlighted without anything failing.
#[test]
fn every_pest_keyword_is_highlighted_by_the_vscode_grammar() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"));
    let pest = std::fs::read_to_string(root.join("src/clsc.pest")).unwrap();
    let grammar: Value = serde_json::from_str(&std::fs::read_to_string(root.join("../vscode/syntaxes/clsc.tmLanguage.json")).unwrap()).unwrap();

    let mut highlighted = BTreeSet::new();
    collect_pattern_words(&grammar, &mut highlighted);

    let missing: Vec<String> = pest_keywords(&pest).into_iter().filter(|keyword| !highlighted.contains(keyword)).collect();
    assert!(missing.is_empty(), "keywords in clsc.pest but not in clsc.tmLanguage.json: {missing:?}");
}

fn pest_keywords(pest: &str) -> Vec<String> {
    let start = pest.find("\nkeyword ").expect("clsc.pest has a `keyword` rule");
    let rule = &pest[start..start + pest[start..].find('}').unwrap()];
    rule.split('"').skip(1).step_by(2).map(str::to_owned).collect()
}

fn collect_pattern_words(value: &Value, words: &mut BTreeSet<String>) {
    match value {
        Value::Object(fields) => {
            for (field, child) in fields {
                if let ("match" | "begin", Value::String(regex)) = (field.as_str(), child) {
                    words.extend(regex_words(regex));
                }
                collect_pattern_words(child, words);
            }
        }
        Value::Array(items) => items.iter().for_each(|item| collect_pattern_words(item, words)),
        _ => {}
    }
}

/// Escapes like `\b` become a gap, so `\bin\b` yields `in`, not `bin`.
fn regex_words(regex: &str) -> Vec<String> {
    let mut unescaped = String::new();
    let mut chars = regex.chars();
    while let Some(c) = chars.next() {
        if c == '\\' {
            chars.next();
            unescaped.push(' ');
        } else {
            unescaped.push(c);
        }
    }
    unescaped.split(|c: char| !c.is_ascii_alphanumeric() && c != '_').filter(|word| !word.is_empty()).map(str::to_owned).collect()
}

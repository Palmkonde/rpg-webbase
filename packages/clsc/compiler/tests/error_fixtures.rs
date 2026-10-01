use clsc::{compile, compile_sources, Severity};
use std::path::{Path, PathBuf};

type Expected = (String, usize, Severity, String);

/// Each fixture under `tests/errors/` is a `.clsc` file, or a directory compiled as one scripts
/// root. A `// error: <message>` or `// warning: <message>` comment marks the line a diagnostic
/// points at, and the compile must report exactly those diagnostics and no others.
#[test]
fn every_error_fixture_reports_exactly_its_annotated_diagnostics() {
    let fixtures = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/errors");
    let mut failures = Vec::new();

    for fixture in sorted_entries(&fixtures) {
        let compiled = if fixture.is_dir() {
            compile(&fixture).unwrap()
        } else {
            compile_sources(&[(fixture.display().to_string(), std::fs::read_to_string(&fixture).unwrap())])
        };

        let mut actual: Vec<Expected> = compiled
            .diagnostics
            .iter()
            .map(|diagnostic| (relative(&fixtures, Path::new(&diagnostic.path)), diagnostic.line, diagnostic.severity, diagnostic.message.clone()))
            .collect();
        actual.sort();

        let expected = annotations(&fixtures, &fixture);
        if actual != expected {
            failures.push(format!("{}\n  expected {expected:#?}\n  actual {actual:#?}", relative(&fixtures, &fixture)));
        }
    }

    assert!(failures.is_empty(), "{}", failures.join("\n\n"));
}

/// Read straight from the text, never through the parser, which may be what's failing.
fn annotations(fixtures: &Path, fixture: &Path) -> Vec<Expected> {
    let files = if fixture.is_dir() { sorted_entries(fixture) } else { vec![fixture.to_path_buf()] };
    let mut expected = Vec::new();

    for file in files {
        for (index, line) in std::fs::read_to_string(&file).unwrap().lines().enumerate() {
            for (marker, severity) in [("// error: ", Severity::Error), ("// warning: ", Severity::Warning)] {
                if let Some((_, message)) = line.split_once(marker) {
                    expected.push((relative(fixtures, &file), index + 1, severity, message.to_owned()));
                }
            }
        }
    }

    expected.sort();
    expected
}

fn sorted_entries(dir: &Path) -> Vec<PathBuf> {
    let mut entries: Vec<PathBuf> = std::fs::read_dir(dir).unwrap().map(|entry| entry.unwrap().path()).collect();
    entries.sort();
    entries
}

fn relative(root: &Path, path: &Path) -> String {
    path.strip_prefix(root).unwrap().display().to_string()
}

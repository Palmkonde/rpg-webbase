use clsc::{compile, compile_sources, HostData, Severity, StringTable};
use std::path::{Path, PathBuf};

type Expected = (String, usize, Severity, String);

/// Each fixture under `tests/errors/` is a `.clsc` file, or a directory compiled as one scripts
/// root, with its `strings.json` as the String Table if it has one. A `// error: <message>` or
/// `// warning: <message>` comment marks the line a diagnostic points at, and the compile must
/// report exactly those diagnostics and no others.
#[test]
fn every_error_fixture_reports_exactly_its_annotated_diagnostics() {
    let fixtures = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/errors");
    let mut failures = Vec::new();

    for fixture in sorted_entries(&fixtures) {
        let compiled = if fixture.is_dir() {
            let strings = fixture.join("strings.json");
            let host = HostData { strings: strings.exists().then(|| StringTable::read(&strings).unwrap()) };
            compile(&fixture, &host).unwrap()
        } else {
            compile_sources(&fixtures, &[(relative(&fixtures, &fixture), std::fs::read_to_string(&fixture).unwrap())], &HostData::default())
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
    let mut expected = Vec::new();

    for file in files_under(fixture) {
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

fn files_under(path: &Path) -> Vec<PathBuf> {
    if !path.is_dir() {
        return vec![path.to_path_buf()];
    }
    sorted_entries(path).iter().flat_map(|entry| files_under(entry)).collect()
}

fn sorted_entries(dir: &Path) -> Vec<PathBuf> {
    let mut entries: Vec<PathBuf> = std::fs::read_dir(dir).unwrap().map(|entry| entry.unwrap().path()).collect();
    entries.sort();
    entries
}

fn relative(root: &Path, path: &Path) -> String {
    path.strip_prefix(root).unwrap().display().to_string()
}

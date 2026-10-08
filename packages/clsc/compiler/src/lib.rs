pub mod bytecode;
mod check;
mod facts;
pub mod opcodes;
mod parse;
mod strings;
#[cfg(target_arch = "wasm32")]
mod wasm;

use parse::{Item, ParseError};
use pest::error::{ErrorVariant, LineColLocation};
use pest::Span;
use std::path::{Path, PathBuf};

pub use facts::Facts;
pub use strings::StringTable;

/// What the Host supplies that a compile checks Scripts against, when given.
#[derive(Default)]
pub struct HostData {
    pub strings: Option<StringTable>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum Severity {
    Error,
    Warning,
}

#[derive(Debug)]
pub struct Diagnostic {
    pub severity: Severity,
    pub path: String,
    pub line: usize,
    pub message: String,

    // `path:line:col`, the source line, a caret and the message, in pest's own format.
    pub rendered: String,
}

impl Diagnostic {
    fn error(path: &str, span: Span<'_>, message: String) -> Self {
        Self::at(Severity::Error, path, span, message)
    }

    fn warning(path: &str, span: Span<'_>, message: String) -> Self {
        Self::at(Severity::Warning, path, span, message)
    }

    fn at(severity: Severity, path: &str, span: Span<'_>, message: String) -> Self {
        let label = match severity {
            Severity::Error => message.clone(),
            Severity::Warning => format!("warning: {message}"),
        };
        let rendered = ParseError::new_from_span(ErrorVariant::CustomError { message: label }, span).with_path(path).to_string();

        Self { severity, path: path.to_owned(), line: span.start_pos().line_col().0, message, rendered }
    }

    fn from_parse_error(path: &str, error: ParseError) -> Self {
        let (LineColLocation::Pos((line, _)) | LineColLocation::Span((line, _), _)) = error.line_col;
        let message = error.variant.message().into_owned();

        Self { severity: Severity::Error, path: path.to_owned(), line, message, rendered: error.with_path(path).to_string() }
    }
}

pub struct Compiled {
    /// `None` when any diagnostic is an error.
    pub bytecode: Option<Vec<u8>>,

    // Sorted by path, then line.
    pub diagnostics: Vec<Diagnostic>,

    // False when a file didn't parse, which leaves `facts` empty.
    pub parsed: bool,
    pub facts: Facts,
}

struct SourceFile<'s> {
    path: String,

    // What `use` names this file by: `a.b` for `a/b.clsc` under the scripts root.
    module: String,
    items: Vec<Item<'s>>,
}

/// Compiles every `.clsc` file under `root` as one program (`adr/0032`), checking it against `host`.
///
/// # Errors
///
/// When `root` or a file under it can't be read.
pub fn compile(root: &Path, host: &HostData) -> Result<Compiled, String> {
    let mut sources = Vec::new();

    for path in source_files(root)? {
        let text = std::fs::read_to_string(&path).map_err(|error| format!("{}: {error}", path.display()))?;
        let relative = path.strip_prefix(root).map_err(|error| format!("{}: {error}", path.display()))?;
        sources.push((relative.display().to_string(), text));
    }

    Ok(compile_sources(root, &sources, host))
}

/// Compiles `(path, text)` pairs as one program, each `path` relative to the scripts `root`.
#[must_use]
pub fn compile_sources(root: &Path, sources: &[(String, String)], host: &HostData) -> Compiled {
    let mut files = Vec::new();
    let mut diagnostics = Vec::new();

    for (relative, text) in sources {
        let path = root.join(relative).display().to_string();
        match parse::parse(text) {
            Ok(items) => files.push(SourceFile { module: module_name(Path::new(relative)), path, items }),
            Err(error) => diagnostics.push(Diagnostic::from_parse_error(&path, error)),
        }
    }

    // Names can't be resolved against a file that didn't parse.
    let parsed = diagnostics.is_empty();
    if parsed {
        diagnostics = check::check(&files, host);
    }
    let facts = if parsed { Facts::collect(&files) } else { Facts::default() };

    diagnostics.sort_by(|a, b| (&a.path, a.line).cmp(&(&b.path, b.line)));
    let failed = diagnostics.iter().any(|diagnostic| diagnostic.severity == Severity::Error);

    Compiled { bytecode: (!failed).then(|| bytecode::encode(&files)), diagnostics, parsed, facts }
}

fn module_name(relative: &Path) -> String {
    let parts: Vec<_> = relative.with_extension("").iter().map(|part| part.to_string_lossy().into_owned()).collect();
    parts.join(".")
}

pub(crate) fn read_json<T>(path: &Path, parse: fn(&str) -> Result<T, String>) -> Result<T, String> {
    let text = std::fs::read_to_string(path).map_err(|error| format!("{}: {error}", path.display()))?;
    parse(&text).map_err(|error| format!("{}: {error}", path.display()))
}

/// Sorted, so a compile never depends on directory order.
fn source_files(dir: &Path) -> Result<Vec<PathBuf>, String> {
    let entries = std::fs::read_dir(dir).map_err(|error| format!("{}: {error}", dir.display()))?;
    let mut files = Vec::new();

    for entry in entries {
        let path = entry.map_err(|error| format!("{}: {error}", dir.display()))?.path();

        if path.is_dir() {
            files.extend(source_files(&path)?);
        } else if path.extension().is_some_and(|extension| extension == "clsc") {
            files.push(path);
        }
    }

    files.sort();
    Ok(files)
}

#[cfg(test)]
mod tests {
    use super::compile;

    #[test]
    fn compile_reads_clsc_files_in_nested_folders() {
        let root = std::env::temp_dir().join(format!("clsc-test-{}", std::process::id()));
        std::fs::create_dir_all(root.join("story")).unwrap();
        std::fs::write(root.join("story/guard.clsc"), "// fine\nnot a script\n").unwrap();

        let compiled = compile(&root, &super::HostData::default()).unwrap();
        std::fs::remove_dir_all(&root).unwrap();

        assert!(compiled.diagnostics[0].rendered.contains("story/guard.clsc:2:1"), "{}", compiled.diagnostics[0].rendered);
    }
}

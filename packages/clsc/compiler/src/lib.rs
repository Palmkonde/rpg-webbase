pub mod bytecode;
pub mod opcodes;

use pest::Parser as _;
use std::path::{Path, PathBuf};

#[derive(pest_derive::Parser)]
#[grammar = "clsc.pest"]
struct ClscParser;

/// Compiles every `.clsc` file under `root` as one program (`adr/0032`). Returns the bytecode
/// file's bytes, or every error rendered for the terminal.
pub fn compile(root: &Path) -> Result<Vec<u8>, String> {
    let mut errors = Vec::new();
    for path in source_files(root)? {
        let source = std::fs::read_to_string(&path).map_err(|error| format!("{}: {error}", path.display()))?;
        if let Err(error) = ClscParser::parse(Rule::file, &source) {
            errors.push(error.with_path(&path.display().to_string()).to_string());
        }
    }
    if errors.is_empty() {
        Ok(bytecode::encode())
    } else {
        Err(errors.join("\n\n"))
    }
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
    fn a_parse_error_in_a_nested_file_fails_the_compile_at_its_path_line_and_column() {
        let root = std::env::temp_dir().join(format!("clsc-test-{}", std::process::id()));
        std::fs::create_dir_all(root.join("story")).unwrap();
        std::fs::write(root.join("story/guard.clsc"), "// fine\nnot a script\n").unwrap();

        let error = compile(&root).unwrap_err();
        std::fs::remove_dir_all(&root).unwrap();
        assert!(error.contains("story/guard.clsc:2:1"), "{error}");
    }
}

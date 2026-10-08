use clsc::{HostData, StringTable};
use notify::{RecursiveMode, Watcher as _};
use std::path::Path;
use std::process::ExitCode;
use std::sync::mpsc;
use std::time::Duration;

const USAGE: &str = "clsc: the CodeLeagues Script compiler

Usage: clsc build <scripts-root> <out-file> [--strings <string-table>] [--watch]
       clsc disasm <bytecode-file>";

struct BuildOptions<'a> {
    watch: bool,
    strings: Option<&'a Path>,
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let args: Vec<&str> = args.iter().map(String::as_str).collect();

    match args.as_slice() {
        [] | ["--help" | "-h"] => {
            println!("{USAGE}");
            ExitCode::SUCCESS
        }
        ["build", root, out, options @ ..] => match read_build_options(options) {
            Some(options) if options.watch => exit_code(watch(Path::new(root), Path::new(out), &options)),
            Some(options) => exit_code(build(Path::new(root), Path::new(out), &options)),
            None => unexpected_arguments(&args),
        },
        ["disasm", file] => exit_code(disasm(Path::new(file))),
        _ => unexpected_arguments(&args),
    }
}

/// In any order, since `bun run clsc --watch` appends `--watch` after the script's own options.
fn read_build_options<'a>(options: &[&'a str]) -> Option<BuildOptions<'a>> {
    let mut build = BuildOptions { watch: false, strings: None };
    let mut options = options.iter();
    while let Some(option) = options.next() {
        match *option {
            "--watch" => build.watch = true,
            "--strings" => build.strings = Some(Path::new(*options.next()?)),
            _ => return None,
        }
    }
    Some(build)
}

fn unexpected_arguments(args: &[&str]) -> ExitCode {
    eprintln!("clsc: unexpected arguments `{}`\n\n{USAGE}", args.join(" "));
    ExitCode::from(2)
}

fn exit_code(result: Result<(), String>) -> ExitCode {
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("{error}");
            ExitCode::FAILURE
        }
    }
}

/// Writes `out` only when the compile succeeds, via a rename so a page reload never fetches a
/// half-written file.
fn build(root: &Path, out: &Path, options: &BuildOptions<'_>) -> Result<(), String> {
    let host = HostData { strings: options.strings.map(StringTable::read).transpose()? };
    let compiled = clsc::compile(root, &host)?;

    for diagnostic in &compiled.diagnostics {
        eprintln!("{}", diagnostic.rendered);
    }

    let Some(bytes) = compiled.bytecode else {
        return Err("clsc: compile failed".to_owned());
    };

    if let Some(dir) = out.parent() {
        std::fs::create_dir_all(dir).map_err(|error| format!("{}: {error}", dir.display()))?;
    }

    let temp = out.with_extension("tmp");

    std::fs::write(&temp, bytes).map_err(|error| format!("{}: {error}", temp.display()))?;
    std::fs::rename(&temp, out).map_err(|error| format!("{}: {error}", out.display()))?;

    println!("clsc: wrote {}", out.display());
    Ok(())
}

fn disasm(file: &Path) -> Result<(), String> {
    let bytes = std::fs::read(file).map_err(|error| format!("{}: {error}", file.display()))?;

    print!("{}", clsc::bytecode::disasm(&bytes)?);
    Ok(())
}

/// Rebuilds on every change under `root` or to the String Table. A failed compile is printed and
/// leaves the last good `out` in place, so the game keeps running the previous Scripts (`adr/0032`).
fn watch(root: &Path, out: &Path, options: &BuildOptions<'_>) -> Result<(), String> {
    let (sender, events) = mpsc::channel();
    let mut watcher = notify::recommended_watcher(sender).map_err(|error| format!("clsc: {error}"))?;
    watcher.watch(root, RecursiveMode::Recursive).map_err(|error| format!("clsc: {}: {error}", root.display()))?;

    // Its folder, not the file: an editor that saves by replacing a file would end a watch on it. A save to a
    // sibling only costs a rebuild.
    if let Some(folder) = options.strings.map(|file| file.parent().filter(|folder| !folder.as_os_str().is_empty()).unwrap_or_else(|| Path::new("."))) {
        watcher.watch(folder, RecursiveMode::NonRecursive).map_err(|error| format!("clsc: {}: {error}", folder.display()))?;
    }

    if let Err(error) = build(root, out, options) {
        eprintln!("{error}");
    }
    while let Ok(event) = events.recv() {
        // The compile reads every file, which some platforms report as an event of its own.
        if event.is_ok_and(|event| event.kind.is_access()) {
            continue;
        }

        // One save fires several events: let them settle, then rebuild once.
        while events.recv_timeout(Duration::from_millis(50)).is_ok() {}
        if let Err(error) = build(root, out, options) {
            eprintln!("{error}");
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::read_build_options;
    use std::path::Path;

    #[test]
    fn build_options_read_in_any_order() {
        for options in [["--strings", "strings.json", "--watch"], ["--watch", "--strings", "strings.json"]] {
            let options = read_build_options(&options).unwrap();
            assert!(options.watch);
            assert_eq!(options.strings, Some(Path::new("strings.json")));
        }
    }

    #[test]
    fn a_strings_option_without_a_path_is_refused() {
        assert!(read_build_options(&["--strings"]).is_none());
    }
}

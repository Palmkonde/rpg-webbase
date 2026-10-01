use notify::{RecursiveMode, Watcher as _};
use std::path::Path;
use std::process::ExitCode;
use std::sync::mpsc;
use std::time::Duration;

const USAGE: &str = "clsc: the CodeLeagues Script compiler

Usage: clsc build <scripts-root> <out-file> [--watch]";

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let args: Vec<&str> = args.iter().map(String::as_str).collect();

    match args.as_slice() {
        [] | ["--help" | "-h"] => {
            println!("{USAGE}");
            ExitCode::SUCCESS
        }
        ["build", root, out] => exit_code(build(Path::new(root), Path::new(out))),
        ["build", root, out, "--watch"] => exit_code(watch(Path::new(root), Path::new(out))),
        _ => {
            eprintln!("clsc: unexpected arguments `{}`\n\n{USAGE}", args.join(" "));
            ExitCode::from(2)
        }
    }
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
fn build(root: &Path, out: &Path) -> Result<(), String> {
    let compiled = clsc::compile(root)?;

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

/// Rebuilds on every change under `root`. A failed compile is printed and leaves the last good
/// `out` in place, so the game keeps running the previous Scripts (`adr/0032`).
fn watch(root: &Path, out: &Path) -> Result<(), String> {
    let (sender, events) = mpsc::channel();
    let mut watcher = notify::recommended_watcher(sender).map_err(|error| format!("clsc: {error}"))?;
    watcher.watch(root, RecursiveMode::Recursive).map_err(|error| format!("clsc: {}: {error}", root.display()))?;

    if let Err(error) = build(root, out) {
        eprintln!("{error}");
    }
    while let Ok(event) = events.recv() {
        // The compile reads every file, which some platforms report as an event of its own.
        if event.is_ok_and(|event| event.kind.is_access()) {
            continue;
        }

        // One save fires several events: let them settle, then rebuild once.
        while events.recv_timeout(Duration::from_millis(50)).is_ok() {}
        if let Err(error) = build(root, out) {
            eprintln!("{error}");
        }
    }
    Ok(())
}

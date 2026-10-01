use std::process::ExitCode;

const USAGE: &str = "clsc: the CodeLeagues Script compiler

Usage: clsc [--help]";

fn main() -> ExitCode {
    match std::env::args().nth(1).as_deref() {
        None | Some("--help" | "-h") => {
            println!("{USAGE}");
            ExitCode::SUCCESS
        }
        Some(arg) => {
            eprintln!("clsc: unknown argument `{arg}`\n\n{USAGE}");
            ExitCode::from(2)
        }
    }
}

//! The compiler's WASM entry for the Publish CLI (`adr/0041`): JSON in, one buffer out, no bindgen.
//!
//! The caller `alloc`s a buffer, writes the request JSON `{ "root", "sources": [[path, text]], "strings" }` into it,
//! calls `compile_world`, reads the result and gives both buffers back to `dealloc`. The result is
//! `u32 LE total length | u32 LE JSON length | JSON | bytecode`. The JSON is `{ "fatal" }` when the request itself is
//! unusable, else `{ "diagnostics", "parsed", "facts", "hasBytecode" }`, with the bytecode after it.

use crate::{compile_sources, HostData, Severity, StringTable};
use serde_json::{json, Value};
use std::path::Path;

/// The prelude ships inside the compiler, so Authors never write it.
const PRELUDE: &str = include_str!("../../prelude.clsc");
const PRELUDE_PATH: &str = "prelude.clsc";

#[no_mangle]
pub extern "C" fn alloc(len: usize) -> *mut u8 {
    let mut buffer = Vec::<u8>::with_capacity(len);
    let pointer = buffer.as_mut_ptr();
    std::mem::forget(buffer);
    pointer
}

/// # Safety
///
/// `pointer` and `len` must be exactly what `alloc` (or `compile_world`'s result) handed out.
#[no_mangle]
pub unsafe extern "C" fn dealloc(pointer: *mut u8, len: usize) {
    drop(Vec::from_raw_parts(pointer, 0, len));
}

/// # Safety
///
/// `pointer` must address `len` initialised bytes from `alloc`.
#[no_mangle]
pub unsafe extern "C" fn compile_world(pointer: *const u8, len: usize) -> *mut u8 {
    let request = std::slice::from_raw_parts(pointer, len);
    let (json, bytecode) = run(request);
    let json = json.to_string();
    let total = 8 + json.len() + bytecode.len();

    let mut out = Vec::with_capacity(total);
    out.extend_from_slice(&u32::try_from(total).unwrap_or(u32::MAX).to_le_bytes());
    out.extend_from_slice(&u32::try_from(json.len()).unwrap_or(u32::MAX).to_le_bytes());
    out.extend_from_slice(json.as_bytes());
    out.extend_from_slice(&bytecode);

    // Capacity equals length, so `dealloc(pointer, total)` frees exactly it.
    out.shrink_to_fit();
    let pointer = out.as_mut_ptr();
    std::mem::forget(out);
    pointer
}

fn run(request: &[u8]) -> (Value, Vec<u8>) {
    match compile_request(request) {
        Ok(result) => result,
        Err(fatal) => (json!({ "fatal": fatal }), Vec::new()),
    }
}

fn compile_request(request: &[u8]) -> Result<(Value, Vec<u8>), String> {
    let request: Value = serde_json::from_slice(request).map_err(|error| error.to_string())?;
    let root = request["root"].as_str().ok_or("no root")?;
    let mut sources: Vec<(String, String)> = request["sources"]
        .as_array()
        .ok_or("no sources")?
        .iter()
        .map(|pair| Some((pair[0].as_str()?.to_owned(), pair[1].as_str()?.to_owned())))
        .collect::<Option<_>>()
        .ok_or("a source is not a [path, text] pair")?;
    sources.push((PRELUDE_PATH.to_owned(), PRELUDE.to_owned()));

    let strings = match request["strings"].as_str() {
        Some(text) => Some(StringTable::parse(text).map_err(|error| format!("strings.json: {error}"))?),
        None => None,
    };

    let compiled = compile_sources(Path::new(root), &sources, &HostData { seed: None, strings });
    let diagnostics: Vec<Value> = compiled
        .diagnostics
        .iter()
        .map(|d| {
            json!({
                "severity": if d.severity == Severity::Error { "error" } else { "warning" },
                "path": d.path,
                "line": d.line,
                "message": d.message,
            })
        })
        .collect();
    let bytecode = compiled.bytecode.unwrap_or_default();
    let result = json!({ "diagnostics": diagnostics, "parsed": compiled.parsed, "facts": compiled.facts.to_json(), "hasBytecode": !bytecode.is_empty() });
    Ok((result, bytecode))
}

//! The bytecode file's byte layout. Every multi-byte number is little-endian. Bump
//! `FORMAT_VERSION` whenever this layout changes (`docs/spec/clsc.md` → Bytecode contract).
//!
//! | offset | size | field                                   |
//! |--------|------|-----------------------------------------|
//! | 0      | 4    | magic, the ASCII bytes `CLSC`           |
//! | 4      | 2    | format version, u16                     |
//! | 6      | 4    | handler index entry count, u32 (always 0) |

const MAGIC: &[u8; 4] = b"CLSC";
const FORMAT_VERSION: u16 = 1;

/// Encodes a program with no handlers, the only kind the language can express so far.
pub fn encode() -> Vec<u8> {
    let mut bytes = MAGIC.to_vec();
    bytes.extend_from_slice(&FORMAT_VERSION.to_le_bytes());
    bytes.extend_from_slice(&0u32.to_le_bytes());
    bytes
}

//! The bytecode file's byte layout. Every number is little-endian, and every `u32` that names a
//! string is an index into the string pool. Bump `FORMAT_VERSION` whenever this layout changes
//! (`docs/spec/clsc.md` → Bytecode contract).
//!
//! | field          | layout                                                                  |
//! |----------------|-------------------------------------------------------------------------|
//! | magic          | the ASCII bytes `CLSC`                                                  |
//! | format version | u16                                                                     |
//! | string pool    | u32 count, then each string as a u32 byte length and its UTF-8 bytes    |
//! | blocks         | u32 count, then each block as below                                     |
//! | handler index  | u32 count, then each handler as a u8 trigger, a u32 id string and a u32 block index |
//!
//! A block is a u8 kind, a u32 name string, a u32 instruction count, then its instructions. An
//! instruction is a u8 opcode followed by the u32 operands `OPCODES` gives it. A position in a
//! block's code is an instruction index, not a byte offset.

use crate::opcodes::OPCODES;
use crate::parse::{Block, BlockKind, Item, Statement, Trigger};
use crate::SourceFile;
use std::collections::HashMap;
use std::fmt::Write as _;

const MAGIC: &[u8; 4] = b"CLSC";
const FORMAT_VERSION: u16 = 2;

// The VM decodes these by position, so the order is part of the layout.
const TRIGGERS: [Trigger; 2] = [Trigger::Interact, Trigger::Enter];
const BLOCK_KINDS: [&str; 2] = ["handler", "cutscene"];

/// A line without an Expression shows the Speaker's Neutral Portrait.
pub(crate) const DEFAULT_EXPRESSION: &str = "Neutral";

/// Encodes a program that has passed `check`.
pub(crate) fn encode(files: &[SourceFile<'_>]) -> Vec<u8> {
    let blocks: Vec<&Block<'_>> = files
        .iter()
        .flat_map(|file| &file.items)
        .filter_map(|item| match item {
            Item::Block(block) => Some(block),
            _ => None,
        })
        .collect();
    let cutscenes: HashMap<&str, u32> = blocks
        .iter()
        .enumerate()
        .filter(|(_, block)| block.kind == BlockKind::Cutscene)
        .map(|(index, block)| (block.name.as_str(), to_u32(index)))
        .collect();

    let mut strings = StringPool::default();
    let mut encoded_blocks = Vec::new();
    let mut handlers = Vec::new();
    for (index, block) in blocks.iter().enumerate() {
        encoded_blocks.push(encode_block(block, &cutscenes, &mut strings));
        if let BlockKind::Handler(trigger) = block.kind {
            handlers.push((trigger, strings.intern(block.name.as_str()), to_u32(index)));
        }
    }

    let mut bytes = MAGIC.to_vec();
    bytes.extend_from_slice(&FORMAT_VERSION.to_le_bytes());
    write_u32(&mut bytes, to_u32(strings.strings.len()));
    for string in &strings.strings {
        write_u32(&mut bytes, to_u32(string.len()));
        bytes.extend_from_slice(string.as_bytes());
    }

    write_u32(&mut bytes, to_u32(encoded_blocks.len()));
    for block in encoded_blocks {
        bytes.extend(block);
    }

    write_u32(&mut bytes, to_u32(handlers.len()));
    for (trigger, id, block) in handlers {
        bytes.push(position(&TRIGGERS, &trigger));
        write_u32(&mut bytes, id);
        write_u32(&mut bytes, block);
    }
    bytes
}

fn encode_block(block: &Block<'_>, cutscenes: &HashMap<&str, u32>, strings: &mut StringPool) -> Vec<u8> {
    let (kind, name) = match block.kind {
        BlockKind::Handler(trigger) => ("handler", format!("on {}({})", trigger.keyword(), block.name.as_str())),
        BlockKind::Cutscene => ("cutscene", block.name.as_str().to_owned()),
    };

    let mut code: Vec<(&str, Vec<u32>)> = block
        .body
        .iter()
        .map(|statement| match statement {
            Statement::Line { speaker, expression, text } => {
                let expression = expression.map_or(DEFAULT_EXPRESSION, |expression| expression.as_str());
                ("Line", vec![strings.intern(speaker.as_str()), strings.intern(expression), strings.intern(text)])
            }
            Statement::Play(cutscene) => ("Play", vec![cutscenes[cutscene.as_str()]]),
        })
        .collect();
    code.push(("Return", Vec::new()));

    let mut bytes = vec![position(&BLOCK_KINDS, &kind)];
    write_u32(&mut bytes, strings.intern(&name));
    write_u32(&mut bytes, to_u32(code.len()));
    for (opcode, operands) in code {
        bytes.push(OPCODES.iter().position(|(name, _)| *name == opcode).and_then(|byte| u8::try_from(byte).ok()).expect("a known opcode"));
        for operand in operands {
            write_u32(&mut bytes, operand);
        }
    }
    bytes
}

/// Prints a bytecode file as text: the header, string pool, blocks and handler index. Operands
/// print as raw numbers, so a string operand is an index into the pool printed above.
pub fn disasm(bytes: &[u8]) -> Result<String, String> {
    let mut reader = Reader { bytes, offset: 0 };
    let mut out = String::new();

    if reader.take(MAGIC.len())? != MAGIC {
        return Err("not a clsc bytecode file: it doesn't start with `CLSC`".to_owned());
    }

    let version = u16::from_le_bytes([reader.u8()?, reader.u8()?]);
    writeln!(out, "format version {version}").unwrap();
    if version != FORMAT_VERSION {
        return Err(format!("the bytecode is format version {version}, but this disassembler reads version {FORMAT_VERSION}"));
    }

    writeln!(out, "\nstrings").unwrap();
    let mut strings = Vec::new();
    for index in 0..reader.u32()? {
        let length = reader.u32()? as usize;
        let string = std::str::from_utf8(reader.take(length)?).map_err(|error| error.to_string())?;
        writeln!(out, "  {index:>4}  {}", quote(string)).unwrap();
        strings.push(string);
    }
    let string = |index: u32| strings.get(index as usize).map(|string| quote(string)).ok_or("a string index past the pool");

    writeln!(out, "\nblocks").unwrap();
    for index in 0..reader.u32()? {
        let kind = BLOCK_KINDS.get(usize::from(reader.u8()?)).ok_or("unknown block kind")?;
        writeln!(out, "  {index:>4}  {kind} {}", string(reader.u32()?)?).unwrap();

        for pc in 0..reader.u32()? {
            let (name, operand_count) = OPCODES.get(usize::from(reader.u8()?)).ok_or("unknown opcode")?;
            let mut instruction = (*name).to_owned();
            for _ in 0..*operand_count {
                write!(instruction, " {}", reader.u32()?).unwrap();
            }
            writeln!(out, "        {pc:>4}  {instruction}").unwrap();
        }
    }

    writeln!(out, "\nhandlers").unwrap();
    for _ in 0..reader.u32()? {
        let trigger = TRIGGERS.get(usize::from(reader.u8()?)).ok_or("unknown trigger")?;
        writeln!(out, "  on {}({}) -> block {}", trigger.keyword(), strings.get(reader.u32()? as usize).ok_or("a string index past the pool")?, reader.u32()?).unwrap();
    }

    if reader.offset != bytes.len() {
        return Err(format!("{} unexpected bytes after the handler index", bytes.len() - reader.offset));
    }
    Ok(out)
}

/// Quotes with the language's own two escapes, so Thai and other text prints as written.
fn quote(string: &str) -> String {
    format!("\"{}\"", string.replace('\\', "\\\\").replace('"', "\\\""))
}

#[derive(Default)]
struct StringPool {
    strings: Vec<String>,
    indices: HashMap<String, u32>,
}

impl StringPool {
    fn intern(&mut self, string: &str) -> u32 {
        if let Some(index) = self.indices.get(string) {
            return *index;
        }
        let index = to_u32(self.strings.len());
        self.strings.push(string.to_owned());
        self.indices.insert(string.to_owned(), index);
        index
    }
}

struct Reader<'b> {
    bytes: &'b [u8],
    offset: usize,
}

impl<'b> Reader<'b> {
    fn take(&mut self, length: usize) -> Result<&'b [u8], String> {
        let slice = self.bytes.get(self.offset..self.offset + length).ok_or("the bytecode is truncated")?;
        self.offset += length;
        Ok(slice)
    }

    fn u8(&mut self) -> Result<u8, String> {
        Ok(self.take(1)?[0])
    }

    fn u32(&mut self) -> Result<u32, String> {
        Ok(u32::from_le_bytes(self.take(4)?.try_into().expect("take returned 4 bytes")))
    }
}

fn write_u32(bytes: &mut Vec<u8>, value: u32) {
    bytes.extend_from_slice(&value.to_le_bytes());
}

fn to_u32(value: usize) -> u32 {
    u32::try_from(value).expect("a program small enough for u32 counts")
}

fn position<T: PartialEq>(table: &[T], value: &T) -> u8 {
    table.iter().position(|entry| entry == value).and_then(|index| u8::try_from(index).ok()).expect("a value in its table")
}

#[cfg(test)]
mod tests {
    use super::disasm;
    use crate::compile_sources;

    #[test]
    fn disasm_prints_the_header_string_pool_blocks_and_handler_index() {
        let source = "enum Expression { Neutral }\nspeaker Narrator;\n\non enter(Camp) with Narrator {\n    play(cutscene::story);\n}\n\ncutscene story with Narrator {\n    Narrator: \"Hi\";\n}\n";
        let bytecode = compile_sources(&[("main.clsc".to_owned(), source.to_owned())]).bytecode.unwrap();

        assert_eq!(
            disasm(&bytecode).unwrap(),
            "format version 2

strings
     0  \"on enter(Camp)\"
     1  \"Camp\"
     2  \"Narrator\"
     3  \"Neutral\"
     4  \"Hi\"
     5  \"story\"

blocks
     0  handler \"on enter(Camp)\"
           0  Play 1
           1  Return
     1  cutscene \"story\"
           0  Line 2 3 4
           1  Return

handlers
  on enter(Camp) -> block 0
"
        );
    }
}

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

fn write_u32(bytes: &mut Vec<u8>, value: u32) {
    bytes.extend_from_slice(&value.to_le_bytes());
}

fn to_u32(value: usize) -> u32 {
    u32::try_from(value).expect("a program small enough for u32 counts")
}

fn position<T: PartialEq>(table: &[T], value: &T) -> u8 {
    table.iter().position(|entry| entry == value).and_then(|index| u8::try_from(index).ok()).expect("a value in its table")
}

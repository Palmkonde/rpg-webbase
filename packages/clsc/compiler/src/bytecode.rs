//! The bytecode file's byte layout. Every number is little-endian, and every `u32` that names a
//! string is an index into the string pool. Bump `FORMAT_VERSION` whenever this layout changes
//! (`docs/spec/clsc.md` → Bytecode contract).
//!
//! | field          | layout                                                                  |
//! |----------------|-------------------------------------------------------------------------|
//! | magic          | the ASCII bytes `CLSC`                                                  |
//! | format version | u16                                                                     |
//! | string pool    | u32 count, then each string as a u32 byte length and its UTF-8 bytes    |
//! | Flag table     | u32 count, then each Flag as a u32 name string, a u8 type and a u32 default (0 or 1) |
//! | blocks         | u32 count, then each block as below                                     |
//! | handler index  | u32 count, then each handler as a u8 trigger, a u32 id string and a u32 block index |
//!
//! A block is a u8 kind, a u32 name string, a u32 instruction count, then its instructions. An
//! instruction is a u8 opcode followed by the u32 operands `OPCODES` gives it. A position in a
//! block's code is an instruction index, not a byte offset.

use crate::opcodes::OPCODES;
use crate::parse::{BinaryOp, Block, BlockKind, Expr, Item, Statement, Trigger};
use crate::SourceFile;
use std::collections::HashMap;
use std::fmt::Write as _;

const MAGIC: &[u8; 4] = b"CLSC";
const FORMAT_VERSION: u16 = 3;

// The VM decodes these by position, so the order is part of the layout.
const TRIGGERS: [Trigger; 2] = [Trigger::Interact, Trigger::Enter];
const BLOCK_KINDS: [&str; 2] = ["handler", "cutscene"];
pub(crate) const FLAG_TYPES: [&str; 1] = ["bool"];

/// A line without an Expression shows the Speaker's Neutral Portrait.
pub(crate) const DEFAULT_EXPRESSION: &str = "Neutral";

/// What a block's code refers to by index.
struct Indices<'p> {
    cutscenes: HashMap<&'p str, u32>,
    flags: HashMap<&'p str, u32>,
}

/// Encodes a program that has passed `check`.
pub(crate) fn encode(files: &[SourceFile<'_>]) -> Vec<u8> {
    let items = || files.iter().flat_map(|file| &file.items);
    let blocks: Vec<&Block<'_>> = items()
        .filter_map(|item| match item {
            Item::Block(block) => Some(block),
            _ => None,
        })
        .collect();
    let flags: Vec<(&str, &str, bool)> = items()
        .filter_map(|item| match item {
            Item::Flag { name, ty, default } => Some((name.as_str(), ty.as_str(), *default)),
            _ => None,
        })
        .collect();
    let indices = Indices {
        cutscenes: blocks
            .iter()
            .enumerate()
            .filter(|(_, block)| block.kind == BlockKind::Cutscene)
            .map(|(index, block)| (block.name.as_str(), to_u32(index)))
            .collect(),
        flags: flags.iter().enumerate().map(|(index, (name, _, _))| (*name, to_u32(index))).collect(),
    };

    let mut strings = StringPool::default();
    let mut encoded_flags = Vec::new();
    for (name, ty, default) in &flags {
        write_u32(&mut encoded_flags, strings.intern(name));
        encoded_flags.push(position(&FLAG_TYPES, ty));
        write_u32(&mut encoded_flags, u32::from(*default));
    }

    let mut encoded_blocks = Vec::new();
    let mut handlers = Vec::new();
    for (index, block) in blocks.iter().enumerate() {
        encoded_blocks.push(encode_block(block, &indices, &mut strings));
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

    write_u32(&mut bytes, to_u32(flags.len()));
    bytes.extend(encoded_flags);

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

fn encode_block(block: &Block<'_>, indices: &Indices<'_>, strings: &mut StringPool) -> Vec<u8> {
    let (kind, name) = match block.kind {
        BlockKind::Handler(trigger) => ("handler", format!("on {}({})", trigger.keyword(), block.name.as_str())),
        BlockKind::Cutscene => ("cutscene", block.name.as_str().to_owned()),
    };

    let mut code = BlockCode { instructions: Vec::new(), indices, strings };
    code.statements(&block.body);
    code.emit("Return", Vec::new());

    let mut bytes = vec![position(&BLOCK_KINDS, &kind)];
    write_u32(&mut bytes, code.strings.intern(&name));
    write_u32(&mut bytes, to_u32(code.instructions.len()));
    for (opcode, operands) in code.instructions {
        bytes.push(OPCODES.iter().position(|(name, _)| *name == opcode).and_then(|byte| u8::try_from(byte).ok()).expect("a known opcode"));
        for operand in operands {
            write_u32(&mut bytes, operand);
        }
    }
    bytes
}

/// A block's instructions as they're emitted. A forward jump is emitted with a placeholder target
/// as its last operand, then `land`ed once the code it skips to has been emitted.
struct BlockCode<'b, 'p> {
    instructions: Vec<(&'static str, Vec<u32>)>,
    indices: &'b Indices<'p>,
    strings: &'b mut StringPool,
}

impl BlockCode<'_, '_> {
    fn emit(&mut self, opcode: &'static str, operands: Vec<u32>) -> usize {
        self.instructions.push((opcode, operands));
        self.instructions.len() - 1
    }

    /// Points the jump at `instruction` to the next instruction emitted.
    fn land(&mut self, instruction: usize) {
        let target = to_u32(self.instructions.len());
        *self.instructions[instruction].1.last_mut().expect("a jump's last operand is its target") = target;
    }

    fn statements(&mut self, statements: &[Statement<'_>]) {
        for statement in statements {
            self.statement(statement);
        }
    }

    fn statement(&mut self, statement: &Statement<'_>) {
        match statement {
            Statement::Line { speaker, expression, text } => {
                let expression = expression.map_or(DEFAULT_EXPRESSION, |expression| expression.as_str());
                let operands = vec![self.strings.intern(speaker.as_str()), self.strings.intern(expression), self.strings.intern(text)];
                self.emit("Line", operands);
            }
            Statement::Play(cutscene) => {
                self.emit("Play", vec![self.indices.cutscenes[cutscene.as_str()]]);
            }
            Statement::Set { flag, value } => {
                self.expr(value);
                self.emit("Set", vec![self.indices.flags[flag.as_str()]]);
            }
            Statement::If { condition, then, otherwise } => {
                self.expr(condition);
                let skip_then = self.emit("JumpIfFalse", vec![0]);
                self.statements(then);
                if otherwise.is_empty() {
                    self.land(skip_then);
                    return;
                }
                let skip_otherwise = self.emit("Jump", vec![0]);
                self.land(skip_then);
                self.statements(otherwise);
                self.land(skip_otherwise);
            }
            Statement::Choose(choices) => self.choose(choices),
        }
    }

    /// Offers every choice, then lays out each body ending in a jump below the choose. A choice
    /// with no body targets below the choose directly.
    fn choose(&mut self, choices: &[crate::parse::Choice<'_>]) {
        let mut offers = Vec::new();
        for choice in choices {
            match &choice.condition {
                Some(condition) => self.expr(condition),
                None => {
                    self.emit("PushBool", vec![1]);
                }
            }
            let text = self.strings.intern(&choice.text);
            offers.push(match &choice.locked {
                Some(reason) => {
                    let reason = self.strings.intern(reason);
                    self.emit("LockedChoice", vec![text, reason, 0])
                }
                None => self.emit("Choice", vec![text, 0]),
            });
        }

        let mut below = vec![self.emit("Choose", vec![0])];
        for (choice, offer) in choices.iter().zip(offers) {
            if choice.body.is_empty() {
                below.push(offer);
                continue;
            }
            self.land(offer);
            self.statements(&choice.body);
            below.push(self.emit("Jump", vec![0]));
        }
        for jump in below {
            self.land(jump);
        }
    }

    fn expr(&mut self, expr: &Expr<'_>) {
        match expr {
            Expr::Bool(value) => {
                self.emit("PushBool", vec![u32::from(*value)]);
            }
            Expr::Flag(name) => {
                self.emit("PushFlag", vec![self.indices.flags[name.as_str()]]);
            }
            Expr::Not(operand) => {
                self.expr(operand);
                self.emit("Not", Vec::new());
            }
            Expr::Binary(left, op, right) => {
                self.expr(left);
                self.expr(right);
                let opcode = match op {
                    BinaryOp::Or => "Or",
                    BinaryOp::And => "And",
                    BinaryOp::Equal => "Equal",
                    BinaryOp::NotEqual => "NotEqual",
                };
                self.emit(opcode, Vec::new());
            }
        }
    }
}

/// Prints a bytecode file as text: the header, string pool, Flag table, blocks and handler index. Operands
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
    let name = |index: u32| strings.get(index as usize).copied().ok_or("a string index past the pool");
    let string = |index: u32| name(index).map(quote);

    writeln!(out, "\nflags").unwrap();
    for index in 0..reader.u32()? {
        let flag = name(reader.u32()?)?;
        let ty = FLAG_TYPES.get(usize::from(reader.u8()?)).ok_or("unknown Flag type")?;
        let default = match reader.u32()? {
            0 => "false",
            1 => "true",
            _ => return Err(format!("Flag `{flag}` has a default that isn't 0 or 1")),
        };
        writeln!(out, "  {index:>4}  {flag}: {ty} = {default}").unwrap();
    }

    writeln!(out, "\nblocks").unwrap();
    for index in 0..reader.u32()? {
        let kind = BLOCK_KINDS.get(usize::from(reader.u8()?)).ok_or("unknown block kind")?;
        writeln!(out, "  {index:>4}  {kind} {}", string(reader.u32()?)?).unwrap();

        for pc in 0..reader.u32()? {
            let (opcode, operand_count) = OPCODES.get(usize::from(reader.u8()?)).ok_or("unknown opcode")?;
            let mut instruction = (*opcode).to_owned();
            for _ in 0..*operand_count {
                write!(instruction, " {}", reader.u32()?).unwrap();
            }
            writeln!(out, "        {pc:>4}  {instruction}").unwrap();
        }
    }

    writeln!(out, "\nhandlers").unwrap();
    for _ in 0..reader.u32()? {
        let trigger = TRIGGERS.get(usize::from(reader.u8()?)).ok_or("unknown trigger")?;
        writeln!(out, "  on {}({}) -> block {}", trigger.keyword(), name(reader.u32()?)?, reader.u32()?).unwrap();
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
    use std::path::Path;

    #[test]
    fn disasm_prints_the_header_string_pool_flag_table_blocks_and_handler_index() {
        let source = "enum Expression { Neutral }\nspeaker Narrator;\nflag lit: bool = true;\n\non enter(Camp) with Narrator {\n    play(cutscene::story);\n}\n\ncutscene story with Narrator {\n    if lit {\n        Narrator: \"Hi\";\n    }\n}\n";
        let bytecode = compile_sources(Path::new(""), &[("main.clsc".to_owned(), source.to_owned())], None).bytecode.unwrap();

        assert_eq!(
            disasm(&bytecode).unwrap(),
            "format version 3

strings
     0  \"lit\"
     1  \"on enter(Camp)\"
     2  \"Camp\"
     3  \"Narrator\"
     4  \"Neutral\"
     5  \"Hi\"
     6  \"story\"

flags
     0  lit: bool = true

blocks
     0  handler \"on enter(Camp)\"
           0  Play 1
           1  Return
     1  cutscene \"story\"
           0  PushFlag 0
           1  JumpIfFalse 3
           2  Line 3 4 5
           3  Return

handlers
  on enter(Camp) -> block 0
"
        );
    }

    #[test]
    fn disasm_refuses_a_flag_default_that_is_not_0_or_1() {
        let mut bytecode = compile_sources(Path::new(""), &[("main.clsc".to_owned(), "flag lit: bool = true;".to_owned())], None).bytecode.unwrap();

        // Magic, version, the pool holding "lit", the Flag count, its name and its type come first.
        bytecode[4 + 2 + 4 + 4 + 3 + 4 + 4 + 1] = 2;
        assert_eq!(disasm(&bytecode).unwrap_err(), "Flag `lit` has a default that isn't 0 or 1");
    }
}

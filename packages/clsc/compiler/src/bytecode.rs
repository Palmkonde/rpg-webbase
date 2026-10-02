//! The bytecode file's byte layout.
//!
//! Every number is little-endian, and every `u32` that names a string is an index into the string
//! pool. Bump `FORMAT_VERSION` whenever this layout changes (`docs/spec/clsc.md` → Bytecode
//! contract).
//!
//! | field          | layout                                                                  |
//! |----------------|-------------------------------------------------------------------------|
//! | magic          | the ASCII bytes `CLSC`                                                  |
//! | format version | u16                                                                     |
//! | string pool    | u32 count, then each string as a u32 byte length and its UTF-8 bytes    |
//! | Flag table     | u32 count, then each Flag as a u32 name string, a u8 type and a u32 default (0 or 1 for `bool`, 0 for a `Character?`'s `none`) |
//! | command table  | u32 count, then each command as below                                   |
//! | blocks         | u32 count, then each block as below                                     |
//! | handler index  | u32 count, then each handler as a u8 trigger, a u32 id string and a u32 block index |
//!
//! A command is a u32 name string, a u32 parameter count, then each parameter as a u32 name string
//! and a u8 type, then a u8 of the block kinds it's allowed in (bit n for `BLOCK_KINDS[n]`), then a
//! u8 that's 1 when it waits.
//!
//! A block is a u8 kind, a u32 name string, a u32 instruction count, then its instructions. An
//! instruction is a u8 opcode followed by the u32 operands `OPCODES` gives it. A position in a
//! block's code is an instruction index, not a byte offset.

use crate::opcodes::OPCODES;
use crate::parse::{Argument, BinaryOp, Block, BlockKind, CastKind, Command, Expr, ExprKind, Item, Playable, Statement, Trigger};
use crate::SourceFile;
use std::collections::HashMap;
use std::fmt::Write as _;

const MAGIC: &[u8; 4] = b"CLSC";
const FORMAT_VERSION: u16 = 5;

// The VM decodes these by position, so the order is part of the layout.
const TRIGGERS: [Trigger; 2] = [Trigger::Interact, Trigger::Enter];
const BLOCK_KINDS: [&str; 3] = ["handler", "cutscene", "cg"];
const FLAG_TYPES: [&str; 2] = ["bool", CHARACTER_FLAG_TYPE];
const CHARACTER_FLAG_TYPE: &str = "Character?";
pub(crate) const PARAM_TYPES: [&str; 2] = ["Mover", "Tile"];

/// A line without an Expression shows the Speaker's Neutral Portrait.
pub(crate) const DEFAULT_EXPRESSION: &str = "Neutral";

/// The Host stores a Companion as the Flag `companion:<entity id>` (`adr/0028`); its
/// `companionFlag()` must build the same name.
const COMPANION_FLAG_PREFIX: &str = "companion:";

pub(crate) fn companion_flag(entity: &str) -> String {
    format!("{COMPANION_FLAG_PREFIX}{entity}")
}

/// A block `play` can push, and the Flag that skips it once true when it's once-only.
#[derive(Clone, Copy)]
struct PlayTarget {
    block: u32,
    once: Option<u32>,
}

/// What a block's code refers to by index.
struct Indices<'p> {
    played: HashMap<(Playable, &'p str), PlayTarget>,
    flags: HashMap<&'p str, u32>,
    commands: HashMap<&'p str, u32>,
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

    // Every Character Entity has a Companion Flag, `none` until a Script recruits it.
    let flags: Vec<(String, &str, bool)> = items()
        .filter_map(|item| match item {
            Item::Flag { name, ty, default } => Some((name.as_str().to_owned(), ty.as_str(), *default)),
            Item::Block(Block { once: Some(once), .. }) => Some((once.flag.as_str().to_owned(), "bool", false)),
            Item::Cast { kind: CastKind::Mover, name } => Some((companion_flag(name.as_str()), CHARACTER_FLAG_TYPE, false)),
            _ => None,
        })
        .collect();
    let commands: Vec<&Command<'_>> = items()
        .filter_map(|item| match item {
            Item::Command(command) => Some(command),
            _ => None,
        })
        .collect();
    let flag_indices: HashMap<&str, u32> = flags.iter().enumerate().map(|(index, (name, _, _))| (name.as_str(), to_u32(index))).collect();
    let indices = Indices {
        played: blocks
            .iter()
            .enumerate()
            .filter_map(|(index, block)| {
                let BlockKind::Played(kind) = block.kind else { return None };
                let once = block.once.as_ref().map(|once| flag_indices[once.flag.as_str()]);
                Some(((kind, block.name.as_str()), PlayTarget { block: to_u32(index), once }))
            })
            .collect(),
        flags: flag_indices,
        commands: commands.iter().enumerate().map(|(index, command)| (command.name.as_str(), to_u32(index))).collect(),
    };

    let mut strings = StringPool::default();
    let mut encoded_flags = Vec::new();
    for (name, ty, default) in &flags {
        write_u32(&mut encoded_flags, strings.intern(name));
        encoded_flags.push(position(&FLAG_TYPES, ty));
        write_u32(&mut encoded_flags, u32::from(*default));
    }

    let mut encoded_commands = Vec::new();
    for command in &commands {
        encode_command(command, &mut strings, &mut encoded_commands);
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

    write_u32(&mut bytes, to_u32(commands.len()));
    bytes.extend(encoded_commands);

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

fn encode_command(command: &Command<'_>, strings: &mut StringPool, bytes: &mut Vec<u8>) {
    write_u32(bytes, strings.intern(command.name.as_str()));
    write_u32(bytes, to_u32(command.params.len()));
    for param in &command.params {
        write_u32(bytes, strings.intern(param.name.as_str()));
        bytes.push(position(&PARAM_TYPES, &param.ty.as_str()));
    }
    bytes.push(command.kinds.iter().map(|kind| 1 << position(&BLOCK_KINDS, kind)).fold(0, |mask, bit| mask | bit));
    bytes.push(u8::from(command.waits));
}

fn encode_block(block: &Block<'_>, indices: &Indices<'_>, strings: &mut StringPool) -> Vec<u8> {
    let name = match block.kind {
        BlockKind::Handler(trigger) => format!("on {}({})", trigger.keyword(), block.name.as_str()),
        BlockKind::Played(_) => block.name.as_str().to_owned(),
    };

    let mut code = BlockCode { instructions: Vec::new(), indices, strings };
    if block.kind == BlockKind::Played(Playable::Cg) {
        let id = code.strings.intern(block.name.as_str());
        code.emit("Cg", vec![id]);
    }
    code.statements(&block.body);

    // Only a block that runs to here sets its once-only Flag (`adr/0030`), so any later way out
    // of a block must jump here rather than emit its own `Return`.
    if let Some(once) = &block.once {
        code.emit("PushBool", vec![1]);
        code.emit("Set", vec![indices.flags[once.flag.as_str()]]);
    }
    code.emit("Return", Vec::new());

    let mut bytes = vec![position(&BLOCK_KINDS, &block.kind.word())];
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
            Statement::Play { kind, name } => {
                let PlayTarget { block, once } = self.indices.played[&(*kind, name.as_str())];
                let skip = once.map(|flag| {
                    self.emit("PushFlag", vec![flag]);
                    self.emit("Not", Vec::new());
                    self.emit("JumpIfFalse", vec![0])
                });
                self.emit("Play", vec![block]);
                if let Some(skip) = skip {
                    self.land(skip);
                }
            }
            Statement::Set { target, value } => {
                self.expr(value);
                self.emit("Set", vec![self.flag(target)]);
            }
            Statement::Command { name, args } => {
                for arg in args {
                    match arg {
                        Argument::Tile { x, y, .. } => self.emit("PushTile", vec![*x, *y]),

                        // `check` lets a Mover name be the only other argument.
                        Argument::Expr(Expr { span, .. }) => self.push_name(span.as_str()),
                    };
                }
                self.emit("Command", vec![self.indices.commands[name.as_str()]]);
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

    fn push_name(&mut self, name: &str) -> usize {
        let name = self.strings.intern(name);
        self.emit("PushName", vec![name])
    }

    /// The Flag table index of a `Name` that `check` resolved to a Flag, or of a `Companion`.
    fn flag(&self, expr: &Expr<'_>) -> u32 {
        match expr.kind {
            ExprKind::Companion(entity) => self.indices.flags[companion_flag(entity.as_str()).as_str()],
            _ => self.indices.flags[expr.span.as_str()],
        }
    }

    fn expr(&mut self, expr: &Expr<'_>) {
        match &expr.kind {
            ExprKind::Bool(value) => {
                self.emit("PushBool", vec![u32::from(*value)]);
            }
            ExprKind::None => {
                self.emit("PushNone", Vec::new());
            }

            // `check` resolved a name that isn't a Flag to a Character.
            ExprKind::Name if !self.indices.flags.contains_key(expr.span.as_str()) => {
                self.push_name(expr.span.as_str());
            }
            ExprKind::Name | ExprKind::Companion(_) => {
                self.emit("PushFlag", vec![self.flag(expr)]);
            }
            ExprKind::Not(operand) => {
                self.expr(operand);
                self.emit("Not", Vec::new());
            }
            ExprKind::Binary(left, op, right) => {
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

/// Prints a bytecode file as text.
///
/// That's the header, string pool, Flag table, command table, blocks and handler index. Operands
/// print as raw numbers, so a string operand is an index into the pool printed above.
///
/// # Errors
///
/// When the bytes aren't a bytecode file of this `FORMAT_VERSION`, or are truncated or malformed.
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
        let default = match (*ty, reader.u32()?) {
            ("bool", 0) => "false",
            ("bool", 1) => "true",
            (_, 0) => "none",
            ("bool", _) => return Err(format!("Flag `{flag}` has a default that isn't 0 or 1")),
            _ => return Err(format!("Flag `{flag}` has a default that isn't 0 (none)")),
        };
        writeln!(out, "  {index:>4}  {flag}: {ty} = {default}").unwrap();
    }

    writeln!(out, "\ncommands").unwrap();
    for index in 0..reader.u32()? {
        let command = name(reader.u32()?)?;
        let params = (0..reader.u32()?)
            .map(|_| Ok(format!("{}: {}", name(reader.u32()?)?, PARAM_TYPES.get(usize::from(reader.u8()?)).ok_or("unknown parameter type")?)))
            .collect::<Result<Vec<_>, String>>()?;
        let mask = reader.u8()?;
        let kinds: Vec<_> = BLOCK_KINDS.iter().enumerate().filter(|(bit, _)| mask & (1 << bit) != 0).map(|(_, kind)| *kind).collect();
        let waits = if reader.u8()? == 1 { " waits" } else { "" };
        writeln!(out, "  {index:>4}  {command}({}) in {}{waits}", params.join(", "), kinds.join(", ")).unwrap();
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
        let prelude = "command move(who: Mover, to: Tile) in cutscene waits;\n";
        let source = "enum Expression { Neutral }\nspeaker Narrator;\nmover Guard;\nflag lit: bool = true;\n\non enter(Camp) with Narrator {\n    play(cutscene::story);\n    play(cg::vision);\n}\n\ncutscene story with Narrator, Guard {\n    if lit {\n        Narrator: \"Hi\";\n    }\n    move(Guard, (9, 10));\n}\n\ncg vision set seen_vision = true;\n";
        let sources = [("prelude.clsc".to_owned(), prelude.to_owned()), ("main.clsc".to_owned(), source.to_owned())];
        let bytecode = compile_sources(Path::new(""), &sources, None).bytecode.unwrap();

        assert_eq!(
            disasm(&bytecode).unwrap(),
            "format version 5

strings
     0  \"companion:Guard\"
     1  \"lit\"
     2  \"seen_vision\"
     3  \"move\"
     4  \"who\"
     5  \"to\"
     6  \"on enter(Camp)\"
     7  \"Camp\"
     8  \"Narrator\"
     9  \"Neutral\"
    10  \"Hi\"
    11  \"Guard\"
    12  \"story\"
    13  \"vision\"

flags
     0  companion:Guard: Character? = none
     1  lit: bool = true
     2  seen_vision: bool = false

commands
     0  move(who: Mover, to: Tile) in cutscene waits

blocks
     0  handler \"on enter(Camp)\"
           0  Play 1
           1  PushFlag 2
           2  Not
           3  JumpIfFalse 5
           4  Play 2
           5  Return
     1  cutscene \"story\"
           0  PushFlag 1
           1  JumpIfFalse 3
           2  Line 8 9 10
           3  PushName 11
           4  PushTile 9 10
           5  Command 0
           6  Return
     2  cg \"vision\"
           0  Cg 13
           1  PushBool 1
           2  Set 2
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

    #[test]
    fn disasm_refuses_a_companion_flag_default_that_is_not_none() {
        let mut bytecode = compile_sources(Path::new(""), &[("main.clsc".to_owned(), "mover Guard;".to_owned())], None).bytecode.unwrap();

        // Magic, version, the pool holding "companion:Guard", the Flag count, its name and its type come first.
        bytecode[4 + 2 + 4 + 4 + 15 + 4 + 4 + 1] = 1;
        assert_eq!(disasm(&bytecode).unwrap_err(), "Flag `companion:Guard` has a default that isn't 0 (none)");
    }
}

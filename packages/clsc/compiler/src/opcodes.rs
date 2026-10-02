/// Indexed by opcode byte: each opcode's name and how many u32 operands follow it.
///
/// `build.rs` includes this file to generate the VM's `vm/src/opcodes.ts`, so the compiler and
/// the VM can't disagree (`adr/0031`). A Flag operand is a Flag table index, and a target is an
/// instruction index in the same block.
pub const OPCODES: &[(&str, usize)] = &[
    // Pops the current frame.
    ("Return", 0),
    // Speaker, Expression and text, each a string pool index.
    ("Line", 3),
    // The block to push, a block index.
    ("Play", 1),
    // Pushes a bool literal, 0 or 1.
    ("PushBool", 1),
    // Pushes a Flag's value.
    ("PushFlag", 1),
    // Pops a value into a Flag and hands it back as a `flag` output.
    ("Set", 1),
    // Pops one bool and pushes its negation.
    ("Not", 0),
    // Each pops the right operand, then the left, and pushes the result.
    ("Or", 0),
    ("And", 0),
    ("Equal", 0),
    ("NotEqual", 0),
    // A target.
    ("Jump", 1),
    // Pops a bool and jumps to the target when it's false.
    ("JumpIfFalse", 1),
    // Pops a bool and, when it's true, offers a choice: label text and the target its body starts at.
    ("Choice", 2),
    // Pops a bool and offers a choice, locked with the reason when it's false: label, reason, target.
    ("LockedChoice", 3),
    // Hands back the choices offered since the last Choose, or jumps to the target (below the
    // choose) when none were shown.
    ("Choose", 1),
    // Pushes a name, a string pool index: a Character, or a Mover as a command argument.
    ("PushName", 1),
    // Pushes `none`.
    ("PushNone", 0),
    // Pushes a tile: x, then y.
    ("PushTile", 2),
    // Pops as many arguments as the command takes, last first, and hands it back as a `command`
    // output: a command table index.
    ("Command", 1),
    // Hands back a `cg` output: the CG id, a string pool index.
    ("Cg", 1),
];

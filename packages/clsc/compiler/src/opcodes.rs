/// Indexed by opcode byte: each opcode's name and how many u32 operands follow it. `build.rs`
/// includes this file to generate the VM's `vm/src/opcodes.ts`, so the compiler and the VM can't
/// disagree (`adr/0031`).
pub const OPCODES: &[(&str, usize)] = &[
    // Pops the current frame.
    ("Return", 0),
    // Speaker, Expression and text, each a string pool index.
    ("Line", 3),
    // The block to push, a block index.
    ("Play", 1),
];

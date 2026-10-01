/// Indexed by opcode byte. `build.rs` includes this file to generate the VM's `vm/src/opcodes.ts`,
/// so the compiler and the VM can't disagree (`adr/0031`).
pub const OPCODES: &[&str] = &["Return"];

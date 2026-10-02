use crate::bytecode::{DEFAULT_EXPRESSION, FLAG_TYPES};
use crate::parse::{Block, BlockKind, Expr, Item, Statement};
use crate::seed::Stored;
use crate::{Diagnostic, FlagSeed, SourceFile};
use pest::Span;
use std::collections::{BTreeMap, HashMap, HashSet};

/// Every file sees these without a `use` (`adr/0032`).
const RESERVED_MODULES: [&str; 2] = ["cast", "prelude"];

/// Each top-level name, mapped to the module declaring it. A name is unique program-wide, a
/// `_private` one too: the bytecode and the Host's Flag storage both key on the bare name.
struct Declarations<'f> {
    speakers: HashMap<&'f str, &'f str>,
    enums: HashMap<&'f str, Vec<&'f str>>,
    flags: HashMap<&'f str, &'f str>,
    cutscenes: HashMap<&'f str, &'f str>,
}

/// One file, its module, and the modules it `use`s.
struct Scope<'f> {
    path: &'f str,
    module: &'f str,
    uses: Vec<&'f str>,
}

impl<'f> Scope<'f> {
    fn of(file: &'f SourceFile<'_>) -> Self {
        let uses = file.items.iter().filter_map(|item| if let Item::Use(path) = item { Some(path.as_str()) } else { None }).collect();
        Self { path: &file.path, module: &file.module, uses }
    }
}

pub fn check(files: &[SourceFile<'_>], seed: Option<&FlagSeed>) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();
    let declarations = collect_declarations_and_duplicates(files, &mut diagnostics);
    let modules: HashSet<&str> = files.iter().map(|file| file.module.as_str()).collect();
    check_handlers_are_unique(files, &mut diagnostics);
    for file in files {
        let scope = Scope::of(file);
        for item in &file.items {
            match item {
                Item::Use(path) => check_use(&file.path, *path, &modules, &mut diagnostics),
                Item::Flag { ty, .. } => check_flag_type(&file.path, *ty, &mut diagnostics),
                Item::Block(block) => check_block(&scope, block, &declarations, &mut diagnostics),
                _ => {}
            }
        }
    }
    if let Some(seed) = seed {
        check_seed(files, seed, &mut diagnostics);
    }
    diagnostics
}

fn collect_declarations_and_duplicates<'f>(files: &'f [SourceFile<'_>], diagnostics: &mut Vec<Diagnostic>) -> Declarations<'f> {
    let mut declarations = Declarations { speakers: HashMap::new(), enums: HashMap::new(), flags: HashMap::new(), cutscenes: HashMap::new() };
    for file in files {
        let module = file.module.as_str();
        for item in &file.items {
            let (name, is_new) = match item {
                Item::Speaker(name) => (name, declarations.speakers.insert(name.as_str(), module).is_none()),
                Item::Enum { name, variants } => {
                    (name, declarations.enums.insert(name.as_str(), variants.iter().map(Span::as_str).collect()).is_none())
                }
                Item::Flag { name, .. } => (name, declarations.flags.insert(name.as_str(), module).is_none()),
                Item::Block(block) if block.kind == BlockKind::Cutscene => {
                    (&block.name, declarations.cutscenes.insert(block.name.as_str(), module).is_none())
                }
                Item::Use(_) | Item::Block(_) => continue,
            };
            if !is_new {
                diagnostics.push(Diagnostic::error(&file.path, *name, format!("`{}` is already declared", name.as_str())));
            }
        }
    }
    declarations
}

/// A duplicate prints at every definition, so neither one silently shadows the other.
fn check_handlers_are_unique(files: &[SourceFile<'_>], diagnostics: &mut Vec<Diagnostic>) {
    let mut handlers = BTreeMap::<_, Vec<_>>::new();
    for file in files {
        for item in &file.items {
            if let Item::Block(block) = item {
                if let BlockKind::Handler(trigger) = block.kind {
                    handlers.entry((trigger, block.name.as_str())).or_default().push((&file.path, block.name));
                }
            }
        }
    }

    for ((trigger, id), definitions) in handlers {
        if definitions.len() > 1 {
            for (path, span) in definitions {
                diagnostics.push(Diagnostic::error(path, span, format!("two handlers for `on {}({id})`", trigger.keyword())));
            }
        }
    }
}

fn check_use(path: &str, module: Span<'_>, modules: &HashSet<&str>, diagnostics: &mut Vec<Diagnostic>) {
    if !modules.contains(module.as_str()) {
        let message = format!("`use {};` found no `{}.clsc` under the scripts root", module.as_str(), module.as_str().replace('.', "/"));
        diagnostics.push(Diagnostic::error(path, module, message));
    }
}

fn check_flag_type(path: &str, ty: Span<'_>, diagnostics: &mut Vec<Diagnostic>) {
    if !FLAG_TYPES.contains(&ty.as_str()) {
        diagnostics.push(Diagnostic::error(path, ty, format!("unknown Flag type `{}` (expected {})", ty.as_str(), FLAG_TYPES.join(" | "))));
    }
}

/// The seed is the Flags a Student starts with, so a wrong type there would abort every run at `start()`.
fn check_seed(files: &[SourceFile<'_>], seed: &FlagSeed, diagnostics: &mut Vec<Diagnostic>) {
    for file in files {
        for item in &file.items {
            let Item::Flag { name, .. } = item else { continue };
            let Some(Stored::Other(stored)) = seed.get(name.as_str()) else { continue };
            let message = format!("the Flag seed stores `{}` as {stored}, but it's declared `bool`", name.as_str());
            diagnostics.push(Diagnostic::error(&file.path, *name, message));
        }
    }
}

struct BlockChecker<'c, 's> {
    scope: &'c Scope<'c>,
    cast: &'c [Span<'s>],
    declarations: &'c Declarations<'c>,
    diagnostics: &'c mut Vec<Diagnostic>,
    used: Vec<&'s str>,
}

fn check_block(scope: &Scope<'_>, block: &Block<'_>, declarations: &Declarations<'_>, diagnostics: &mut Vec<Diagnostic>) {
    let mut checker = BlockChecker { scope, cast: &block.cast, declarations, diagnostics, used: Vec::new() };
    let listed: Vec<_> = block.cast.iter().filter(|name| checker.resolve_or_report_speaker(**name)).collect();
    checker.statements(&block.body);
    let used = checker.used;

    for name in listed {
        if !used.contains(&name.as_str()) {
            diagnostics.push(Diagnostic::warning(scope.path, *name, format!("`{}` is listed in `with` but never used", name.as_str())));
        }
    }
}

impl<'s> BlockChecker<'_, 's> {
    fn statements(&mut self, statements: &[Statement<'s>]) {
        for statement in statements {
            match statement {
                Statement::Line { speaker, expression, .. } => {
                    self.speaker(*speaker);
                    self.used.push(speaker.as_str());
                    self.expression(*speaker, *expression);
                }
                Statement::Play(cutscene) => {
                    self.resolve_or_report(*cutscene, &self.declarations.cutscenes, "no cutscene named");
                }
                Statement::Set { flag, value } => {
                    self.flag(*flag);
                    self.expr(value);
                }
                Statement::If { condition, then, otherwise } => {
                    self.expr(condition);
                    self.statements(then);
                    self.statements(otherwise);
                }
                Statement::Choose(choices) => {
                    for choice in choices {
                        if let Some(condition) = &choice.condition {
                            self.expr(condition);
                        }
                        self.statements(&choice.body);
                    }
                }
            }
        }
    }

    /// Every value is a `bool` Flag or literal today, so resolving each name is the whole type check.
    fn expr(&mut self, expr: &Expr<'_>) {
        match expr {
            Expr::Bool(_) => {}
            Expr::Flag(name) => self.flag(*name),
            Expr::Not(operand) => self.expr(operand),
            Expr::Binary(left, _, right) => {
                self.expr(left);
                self.expr(right);
            }
        }
    }

    fn flag(&mut self, name: Span<'_>) {
        self.resolve_or_report(name, &self.declarations.flags, "no Flag named");
    }

    fn speaker(&mut self, speaker: Span<'_>) {
        let name = speaker.as_str();
        if self.resolve_or_report_speaker(speaker) && !self.cast.iter().any(|listed| listed.as_str() == name) {
            self.error(speaker, format!("`{name}` is not in this block's `with` list"));
        }
    }

    fn resolve_or_report_speaker(&mut self, speaker: Span<'_>) -> bool {
        self.resolve_or_report(speaker, &self.declarations.speakers, "unknown Speaker")
    }

    /// Whether `name` is in `declared` and in this file's scope: declared in this file, a reserved
    /// module or a module it `use`s, and not `_private` to another. Reports why not, as
    /// `<unknown> \`name\`` when it's declared nowhere.
    fn resolve_or_report(&mut self, name: Span<'_>, declared: &HashMap<&str, &str>, unknown: &str) -> bool {
        let message = match declared.get(name.as_str()).copied() {
            None => format!("{unknown} `{}`", name.as_str()),
            Some(module) if module == self.scope.module => return true,
            Some(module) if name.as_str().starts_with('_') => format!("`{}` is private to `{module}`", name.as_str()),
            Some(module) if RESERVED_MODULES.contains(&module) || self.scope.uses.contains(&module) => return true,
            Some(module) => format!("`{}` is declared in `{module}`, which this file doesn't `use`", name.as_str()),
        };
        self.error(name, message);
        false
    }

    /// A line without an Expression shows `DEFAULT_EXPRESSION`, so that variant must be declared too.
    fn expression(&mut self, speaker: Span<'_>, expression: Option<Span<'_>>) {
        let Some(variants) = self.declarations.enums.get("Expression") else {
            self.error(expression.unwrap_or(speaker), "no `enum Expression` is declared (it belongs in prelude.clsc)".to_owned());
            return;
        };

        let message = match expression {
            Some(expression) if !variants.contains(&expression.as_str()) => {
                format!("unknown Expression `{}` (expected {})", expression.as_str(), variants.join(" | "))
            }
            None if !variants.contains(&DEFAULT_EXPRESSION) => {
                format!("a line without an Expression shows `{DEFAULT_EXPRESSION}`, but `enum Expression` has no `{DEFAULT_EXPRESSION}`")
            }
            _ => return,
        };
        self.error(expression.unwrap_or(speaker), message);
    }

    fn error(&mut self, span: Span<'_>, message: String) {
        self.diagnostics.push(Diagnostic::error(self.scope.path, span, message));
    }
}

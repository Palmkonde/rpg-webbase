use crate::bytecode::{DEFAULT_EXPRESSION, FLAG_TYPES};
use crate::parse::{Block, BlockKind, Expr, Item, Statement};
use crate::seed::Stored;
use crate::{Diagnostic, FlagSeed, SourceFile};
use pest::Span;
use std::collections::{BTreeMap, HashMap, HashSet};

/// Every top-level name is program-wide, so `cast.clsc` and `prelude.clsc` need no `use` (`adr/0032`).
struct Declarations<'s> {
    speakers: HashSet<&'s str>,
    enums: HashMap<&'s str, Vec<&'s str>>,
    flags: HashSet<&'s str>,
    cutscenes: HashSet<&'s str>,
}

pub fn check(files: &[SourceFile<'_>], seed: Option<&FlagSeed>) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();
    let declarations = collect_declarations_and_duplicates(files, &mut diagnostics);
    check_handlers_are_unique(files, &mut diagnostics);
    for file in files {
        for item in &file.items {
            match item {
                Item::Flag { ty, .. } => check_flag_type(&file.path, *ty, &mut diagnostics),
                Item::Block(block) => check_block(&file.path, block, &declarations, &mut diagnostics),
                _ => {}
            }
        }
    }
    if let Some(seed) = seed {
        check_seed(files, seed, &mut diagnostics);
    }
    diagnostics
}

fn collect_declarations_and_duplicates<'s>(files: &[SourceFile<'s>], diagnostics: &mut Vec<Diagnostic>) -> Declarations<'s> {
    let mut declarations = Declarations { speakers: HashSet::new(), enums: HashMap::new(), flags: HashSet::new(), cutscenes: HashSet::new() };
    for file in files {
        for item in &file.items {
            let (name, is_new) = match item {
                Item::Speaker(name) => (name, declarations.speakers.insert(name.as_str())),
                Item::Enum { name, variants } => {
                    (name, declarations.enums.insert(name.as_str(), variants.iter().map(Span::as_str).collect()).is_none())
                }
                Item::Flag { name, .. } => (name, declarations.flags.insert(name.as_str())),
                Item::Block(block) if block.kind == BlockKind::Cutscene => {
                    (&block.name, declarations.cutscenes.insert(block.name.as_str()))
                }
                Item::Block(_) => continue,
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
    path: &'c str,
    cast: &'c [Span<'s>],
    declarations: &'c Declarations<'c>,
    diagnostics: &'c mut Vec<Diagnostic>,
    used: Vec<&'s str>,
}

fn check_block(path: &str, block: &Block<'_>, declarations: &Declarations<'_>, diagnostics: &mut Vec<Diagnostic>) {
    for name in &block.cast {
        if !declarations.speakers.contains(name.as_str()) {
            diagnostics.push(Diagnostic::error(path, *name, format!("unknown Speaker `{}`", name.as_str())));
        }
    }

    let mut checker = BlockChecker { path, cast: &block.cast, declarations, diagnostics, used: Vec::new() };
    checker.statements(&block.body);
    let used = checker.used;

    for name in &block.cast {
        if declarations.speakers.contains(name.as_str()) && !used.contains(&name.as_str()) {
            diagnostics.push(Diagnostic::warning(path, *name, format!("`{}` is listed in `with` but never used", name.as_str())));
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
                    if !self.declarations.cutscenes.contains(cutscene.as_str()) {
                        self.error(*cutscene, format!("no cutscene named `{}`", cutscene.as_str()));
                    }
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
        if !self.declarations.flags.contains(name.as_str()) {
            self.error(name, format!("no Flag named `{}`", name.as_str()));
        }
    }

    fn speaker(&mut self, speaker: Span<'_>) {
        let name = speaker.as_str();
        if !self.declarations.speakers.contains(name) {
            self.error(speaker, format!("unknown Speaker `{name}`"));
        } else if !self.cast.iter().any(|listed| listed.as_str() == name) {
            self.error(speaker, format!("`{name}` is not in this block's `with` list"));
        }
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
        self.diagnostics.push(Diagnostic::error(self.path, span, message));
    }
}

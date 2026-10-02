use crate::bytecode::{companion_flag, DEFAULT_EXPRESSION, PARAM_TYPES};
use crate::parse::{Argument, BinaryOp, Block, BlockKind, CastKind, Command, Expr, ExprKind, Item, Once, Playable, Statement, Text};
use crate::seed::Stored;
use crate::{Diagnostic, FlagSeed, HostData, SourceFile, StringTable};
use pest::Span;
use std::collections::{BTreeMap, HashMap, HashSet};

const PRELUDE: &str = "prelude";

/// Every file sees these without a `use` (`adr/0032`).
const RESERVED_MODULES: [&str; 2] = ["cast", PRELUDE];

/// The built-in Mover that never speaks.
const PLAYER: &str = "Player";

#[derive(Clone, Copy, PartialEq, Eq)]
enum Type {
    Bool,

    // `Character?`: a Character, or `none`.
    Character,
}

impl Type {
    const fn name(self) -> &'static str {
        match self {
            Self::Bool => "bool",
            Self::Character => "Character?",
        }
    }
}

/// What a block asks of a cast name where it uses one.
#[derive(Clone, Copy)]
enum Role {
    Speaker,
    Mover,
}

impl Role {
    const fn name(self) -> &'static str {
        match self {
            Self::Speaker => "Speaker",
            Self::Mover => "Mover",
        }
    }
}

#[derive(Clone, Copy)]
struct Declared<'f, T> {
    module: &'f str,
    what: T,
}

/// Each top-level name, with the module declaring it. A name is unique program-wide, a `_private`
/// one too: the bytecode and the Host's Flag storage both key on the bare name.
struct Declarations<'f> {
    cast: HashMap<&'f str, Declared<'f, CastKind>>,
    enums: HashMap<&'f str, Vec<&'f str>>,
    flags: HashMap<&'f str, Declared<'f, Type>>,
    played: HashMap<Playable, HashMap<&'f str, Declared<'f, ()>>>,
    commands: HashMap<&'f str, Declared<'f, &'f Command<'f>>>,
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

pub fn check(files: &[SourceFile<'_>], host: &HostData) -> Vec<Diagnostic> {
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
                Item::Command(command) => check_command_declaration(&scope, command, &mut diagnostics),
                Item::Block(block) => check_block(&scope, block, &declarations, host.strings.as_ref(), &mut diagnostics),
                Item::Cast { .. } | Item::Enum { .. } => {}
            }
        }
    }
    if let Some(seed) = &host.seed {
        check_seed(files, seed, &mut diagnostics);
    }
    diagnostics
}

fn collect_declarations_and_duplicates<'f>(files: &'f [SourceFile<'_>], diagnostics: &mut Vec<Diagnostic>) -> Declarations<'f> {
    let mut declarations = Declarations {
        // Declared like the prelude's names, so every file sees it and a `mover Player;` is a duplicate.
        cast: HashMap::from([(PLAYER, Declared { module: PRELUDE, what: CastKind::Mover })]),
        enums: HashMap::new(),
        flags: HashMap::new(),
        played: HashMap::from([(Playable::Cutscene, HashMap::new()), (Playable::Cg, HashMap::new())]),
        commands: HashMap::new(),
    };
    for file in files {
        let module = file.module.as_str();
        let mut report_duplicate = |name: Span<'_>| {
            diagnostics.push(Diagnostic::error(&file.path, name, format!("`{}` is already declared", name.as_str())));
        };
        for item in &file.items {
            let (name, is_new) = match item {
                // A bare name reads as a Flag or a Character, so Flags and cast names share one namespace.
                Item::Cast { kind, name } => {
                    let is_new = declarations.cast.insert(name.as_str(), Declared { module, what: *kind }).is_none();
                    (name, is_new && !declarations.flags.contains_key(name.as_str()))
                }
                Item::Enum { name, variants } => {
                    (name, declarations.enums.insert(name.as_str(), variants.iter().map(Span::as_str).collect()).is_none())
                }
                Item::Flag { name, .. } => (name, declarations.declare_flag(*name, module)),
                Item::Command(command) => {
                    (&command.name, declarations.commands.insert(command.name.as_str(), Declared { module, what: command }).is_none())
                }
                Item::Block(block) => {
                    if let Some(once) = block.once.as_ref().filter(|once| !declarations.declare_flag(once.flag, module)) {
                        report_duplicate(once.flag);
                    }
                    let BlockKind::Played(kind) = block.kind else { continue };
                    let played = declarations.played.get_mut(&kind).expect("every Playable has a map");
                    (&block.name, played.insert(block.name.as_str(), Declared { module, what: () }).is_none())
                }
                Item::Use(_) => continue,
            };
            if !is_new {
                report_duplicate(*name);
            }
        }
    }
    declarations
}

impl<'f> Declarations<'f> {
    /// Like `HashSet::insert`, answers whether `name` was new among the Flags and cast names.
    fn declare_flag(&mut self, name: Span<'f>, module: &'f str) -> bool {
        let is_new = self.flags.insert(name.as_str(), Declared { module, what: Type::Bool }).is_none();
        is_new && !self.cast.contains_key(name.as_str())
    }
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

/// A Script declares only `bool` Flags; `Character?` is the Companion Flags' own.
fn check_flag_type(path: &str, ty: Span<'_>, diagnostics: &mut Vec<Diagnostic>) {
    if ty.as_str() != Type::Bool.name() {
        diagnostics.push(Diagnostic::error(path, ty, format!("unknown Flag type `{}` (expected {})", ty.as_str(), Type::Bool.name())));
    }
}

/// A command is part of the Host's contract: the Host must handle every one, so only its prelude declares them.
fn check_command_declaration(scope: &Scope<'_>, command: &Command<'_>, diagnostics: &mut Vec<Diagnostic>) {
    if scope.module != PRELUDE {
        diagnostics.push(Diagnostic::error(scope.path, command.name, format!("`{}` is a command, which only {PRELUDE}.clsc declares", command.name.as_str())));
    }
    for param in &command.params {
        if !PARAM_TYPES.contains(&param.ty.as_str()) {
            let message = format!("unknown parameter type `{}` (expected {})", param.ty.as_str(), PARAM_TYPES.join(" | "));
            diagnostics.push(Diagnostic::error(scope.path, param.ty, message));
        }
    }
}

/// The seed is the Flags a Student starts with, so a wrong type there would abort every run at `start()`.
/// A Companion Flag holds a Character, or the Host's `false` for `none` (`adr/0028`).
fn check_seed(files: &[SourceFile<'_>], seed: &FlagSeed, diagnostics: &mut Vec<Diagnostic>) {
    for file in files {
        for item in &file.items {
            let (flag, ty, span) = match item {
                Item::Flag { name, .. } | Item::Block(Block { once: Some(Once { flag: name, .. }), .. }) => (name.as_str().to_owned(), Type::Bool, *name),
                Item::Cast { kind: CastKind::Mover, name } => (companion_flag(name.as_str()), Type::Character, *name),
                _ => continue,
            };
            let Some(stored) = seed.get(&flag) else { continue };
            if !matches!((ty, stored), (Type::Bool, Stored::Bool(_)) | (Type::Character, Stored::String | Stored::Bool(false))) {
                let message = format!("the Flag seed stores `{flag}` as {}, but it's declared `{}`", stored.describe(), ty.name());
                diagnostics.push(Diagnostic::error(&file.path, span, message));
            }
        }
    }
}

struct BlockChecker<'c, 's> {
    scope: &'c Scope<'c>,
    kind: BlockKind,
    cast: &'c [Span<'s>],
    declarations: &'c Declarations<'c>,
    strings: Option<&'c StringTable>,
    diagnostics: &'c mut Vec<Diagnostic>,
    used: Vec<&'s str>,
}

fn check_block(scope: &Scope<'_>, block: &Block<'_>, declarations: &Declarations<'_>, strings: Option<&StringTable>, diagnostics: &mut Vec<Diagnostic>) {
    if let Some(Once { value, .. }) = &block.once {
        if value.as_str() != "true" {
            diagnostics.push(Diagnostic::error(scope.path, *value, "a once-only Flag can only be set to `true`".to_owned()));
        }
    }

    let mut checker = BlockChecker { scope, kind: block.kind, cast: &block.cast, declarations, strings, diagnostics, used: Vec::new() };
    let listed: Vec<_> = block.cast.iter().filter(|name| checker.resolve_or_report(**name, &declarations.cast, "unknown cast name").is_some()).collect();
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
                Statement::Line { speaker, expression, text } => {
                    self.cast_member(*speaker, Role::Speaker);
                    self.expression(*speaker, *expression);
                    self.text(text);
                }
                Statement::Play { kind, name } => {
                    self.resolve_or_report(*name, &self.declarations.played[kind], &format!("no {} named", kind.noun()));
                }
                Statement::Set { target, value } => self.set(target, value),
                Statement::Command { name, args } => self.command(*name, args),
                Statement::If { condition, then, otherwise } => {
                    self.condition(condition);
                    self.statements(then);
                    self.statements(otherwise);
                }
                Statement::Choose(choices) => {
                    for choice in choices {
                        self.text(&choice.text);
                        if let Some(reason) = &choice.locked {
                            self.text(reason);
                        }
                        if let Some(condition) = &choice.condition {
                            self.condition(condition);
                        }
                        self.statements(&choice.body);
                    }
                }
            }
        }
    }

    fn set(&mut self, target: &Expr<'s>, value: &Expr<'s>) {
        let target_type = match target.kind {
            ExprKind::Companion(entity) => self.companion(entity),
            _ => self.resolve_or_report(target.span, &self.declarations.flags, "no Flag named"),
        };
        if let (Some(target_type), Some(value_type)) = (target_type, self.expr(value)) {
            if target_type != value_type {
                self.error(target.span, format!("`{}` is {}, got {}", target.span.as_str(), target_type.name(), value_type.name()));
            }
        }
    }

    fn command(&mut self, name: Span<'s>, args: &[Argument<'s>]) {
        let Some(command) = self.resolve_or_report(name, &self.declarations.commands, "no command named") else { return };
        if !command.kinds.contains(&self.kind.word()) {
            self.error(name, format!("`{}` is only allowed in a {}", name.as_str(), command.kinds.join(" or ")));
        }
        if args.len() != command.params.len() {
            let noun = if command.params.len() == 1 { "argument" } else { "arguments" };
            self.error(name, format!("`{}` takes {} {noun}, got {}", name.as_str(), command.params.len(), args.len()));
            return;
        }

        for (param, arg) in command.params.iter().zip(args) {
            let fits = match (param.ty.as_str(), arg) {
                ("Mover", Argument::Expr(Expr { span, kind: ExprKind::Name })) => {
                    self.cast_member(*span, Role::Mover);
                    true
                }
                ("Tile", Argument::Tile { .. }) => true,
                ("Mover" | "Tile", _) => false,

                // Reported at the prelude's declaration.
                _ => true,
            };
            if !fits {
                self.error(arg.span(), format!("`{}` takes a {} as `{}`", name.as_str(), param.ty.as_str(), param.name.as_str()));
            }
        }
    }

    fn condition(&mut self, condition: &Expr<'s>) {
        if let Some(ty @ Type::Character) = self.expr(condition) {
            self.error(condition.span, format!("a condition is bool, got {}", ty.name()));
        }
    }

    /// `None` once the expression has reported an error, so one mistake doesn't cascade.
    fn expr(&mut self, expr: &Expr<'s>) -> Option<Type> {
        match &expr.kind {
            ExprKind::Bool(_) => Some(Type::Bool),
            ExprKind::None => Some(Type::Character),
            ExprKind::Name => self.value(expr.span),
            ExprKind::Companion(entity) => self.companion(*entity),
            ExprKind::Not(operand) => {
                self.bool_operand("!", operand);
                Some(Type::Bool)
            }
            ExprKind::Binary(left, op, right) => {
                let symbol = match op {
                    BinaryOp::Or => "||",
                    BinaryOp::And => "&&",
                    BinaryOp::Equal => "==",
                    BinaryOp::NotEqual => "!=",
                };
                if matches!(op, BinaryOp::Or | BinaryOp::And) {
                    self.bool_operand(symbol, left);
                    self.bool_operand(symbol, right);
                } else if let (Some(left), Some(right)) = (self.expr(left), self.expr(right)) {
                    if left != right {
                        self.error(expr.span, format!("`{symbol}` compares {} with {}", left.name(), right.name()));
                    }
                }
                Some(Type::Bool)
            }
        }
    }

    fn bool_operand(&mut self, symbol: &str, operand: &Expr<'s>) {
        if let Some(ty @ Type::Character) = self.expr(operand) {
            self.error(operand.span, format!("`{symbol}` takes bool, got {}", ty.name()));
        }
    }

    /// A bare name as a value is a Flag, or a Character that joins the cast.
    fn value(&mut self, name: Span<'s>) -> Option<Type> {
        let is_character = |declared: &Declared<'_, CastKind>| declared.what == CastKind::Character;
        if !self.declarations.flags.contains_key(name.as_str()) && self.declarations.cast.get(name.as_str()).is_some_and(is_character) {
            self.resolve_or_report(name, &self.declarations.cast, "unknown Character")?;
            return self.use_or_report(name).then_some(Type::Character);
        }
        self.resolve_or_report(name, &self.declarations.flags, "no Flag named")
    }

    /// `companion[X]` is a Flag (`adr/0028`), so X needn't be in the `with` list.
    fn companion(&mut self, entity: Span<'s>) -> Option<Type> {
        let kind = self.resolve_or_report(entity, &self.declarations.cast, "unknown Mover")?;
        let message = match kind {
            _ if entity.as_str() == PLAYER => "the Player can't be a Companion".to_owned(),
            CastKind::Mover => return Some(Type::Character),
            other => format!("`{}` is a {}, not a Mover", entity.as_str(), other.name()),
        };
        self.error(entity, message);
        None
    }

    fn cast_member(&mut self, name: Span<'s>, role: Role) {
        let Some(kind) = self.resolve_or_report(name, &self.declarations.cast, &format!("unknown {}", role.name())) else { return };
        let message = match (role, kind) {
            (Role::Speaker, CastKind::Mover) if name.as_str() == PLAYER => format!("`{PLAYER}` never speaks"),
            (Role::Speaker, CastKind::Character) | (Role::Mover, CastKind::Speaker | CastKind::Character) => {
                format!("`{}` is a {}, not a {}", name.as_str(), kind.name(), role.name())
            }
            _ => {
                self.use_or_report(name);
                return;
            }
        };
        self.used.push(name.as_str());
        self.error(name, message);
    }

    /// Counts `name` as used, and whether this block's `with` list holds it, reporting when it doesn't.
    fn use_or_report(&mut self, name: Span<'s>) -> bool {
        self.used.push(name.as_str());
        let listed = self.cast.iter().any(|listed| listed.as_str() == name.as_str());
        if !listed {
            self.error(name, format!("`{}` is not in this block's `with` list", name.as_str()));
        }
        listed
    }

    /// `name`'s declaration, if it's in `declared` and in this file's scope: declared in this file,
    /// a reserved module or a module it `use`s, and not `_private` to another. Otherwise reports
    /// why not, prefixing the name with `unknown` when it's declared nowhere.
    fn resolve_or_report<T: Copy>(&mut self, name: Span<'_>, declared: &HashMap<&str, Declared<'_, T>>, unknown: &str) -> Option<T> {
        let message = match declared.get(name.as_str()).copied() {
            None => format!("{unknown} `{}`", name.as_str()),
            Some(Declared { module, what }) if module == self.scope.module => return Some(what),
            Some(Declared { module, .. }) if name.as_str().starts_with('_') => format!("`{}` is private to `{module}`", name.as_str()),
            Some(Declared { module, what }) if RESERVED_MODULES.contains(&module) || self.scope.uses.contains(&module) => return Some(what),
            Some(Declared { module, .. }) => format!("`{}` is declared in `{module}`, which this file doesn't `use`", name.as_str()),
        };
        self.error(name, message);
        None
    }

    /// A key must be in every Locale, so no keyed text ships untranslated.
    fn text(&mut self, text: &Text<'_>) {
        let Text::Key(key) = text else { return };
        let message = match self.strings.map(|strings| strings.locales_missing(key.as_str())) {
            None => format!("`@{}` is a String Table key, but the compile was given no String Table", key.as_str()),
            Some(locales) => match locales[..] {
                [] => return,
                [locale] => format!("`@{}` is missing from the String Table in Locale {locale}", key.as_str()),
                _ => format!("`@{}` is missing from the String Table in Locales {}", key.as_str(), locales.join(", ")),
            },
        };
        self.error(*key, message);
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

use crate::bytecode::DEFAULT_EXPRESSION;
use crate::parse::{BlockKind, Item, Statement};
use crate::{Diagnostic, SourceFile};
use pest::Span;
use std::collections::{BTreeMap, HashMap, HashSet};

/// Every top-level name is program-wide, so `cast.clsc` and `prelude.clsc` need no `use` (`adr/0032`).
struct Declarations<'s> {
    speakers: HashSet<&'s str>,
    enums: HashMap<&'s str, Vec<&'s str>>,
    cutscenes: HashSet<&'s str>,
}

pub fn check(files: &[SourceFile<'_>]) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();
    let declarations = collect_declarations_and_duplicates(files, &mut diagnostics);
    check_handlers_are_unique(files, &mut diagnostics);
    for file in files {
        for item in &file.items {
            if let Item::Block(block) = item {
                check_block(&file.path, block, &declarations, &mut diagnostics);
            }
        }
    }
    diagnostics
}

fn collect_declarations_and_duplicates<'s>(files: &[SourceFile<'s>], diagnostics: &mut Vec<Diagnostic>) -> Declarations<'s> {
    let mut declarations = Declarations { speakers: HashSet::new(), enums: HashMap::new(), cutscenes: HashSet::new() };
    for file in files {
        for item in &file.items {
            let (name, is_new) = match item {
                Item::Speaker(name) => (name, declarations.speakers.insert(name.as_str())),
                Item::Enum { name, variants } => {
                    (name, declarations.enums.insert(name.as_str(), variants.iter().map(Span::as_str).collect()).is_none())
                }
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

fn check_block(path: &str, block: &crate::parse::Block<'_>, declarations: &Declarations<'_>, diagnostics: &mut Vec<Diagnostic>) {
    for name in &block.cast {
        if !declarations.speakers.contains(name.as_str()) {
            diagnostics.push(Diagnostic::error(path, *name, format!("unknown Speaker `{}`", name.as_str())));
        }
    }

    let mut used = Vec::new();
    for statement in &block.body {
        match statement {
            Statement::Line { speaker, expression, .. } => {
                check_speaker(path, *speaker, &block.cast, declarations, diagnostics);
                used.push(speaker.as_str());
                check_expression(path, *speaker, *expression, declarations, diagnostics);
            }
            Statement::Play(cutscene) => {
                if !declarations.cutscenes.contains(cutscene.as_str()) {
                    diagnostics.push(Diagnostic::error(path, *cutscene, format!("no cutscene named `{}`", cutscene.as_str())));
                }
            }
        }
    }

    for name in &block.cast {
        if declarations.speakers.contains(name.as_str()) && !used.contains(&name.as_str()) {
            diagnostics.push(Diagnostic::warning(path, *name, format!("`{}` is listed in `with` but never used", name.as_str())));
        }
    }
}

fn check_speaker(path: &str, speaker: Span<'_>, cast: &[Span<'_>], declarations: &Declarations<'_>, diagnostics: &mut Vec<Diagnostic>) {
    let name = speaker.as_str();
    if !declarations.speakers.contains(name) {
        diagnostics.push(Diagnostic::error(path, speaker, format!("unknown Speaker `{name}`")));
    } else if !cast.iter().any(|listed| listed.as_str() == name) {
        diagnostics.push(Diagnostic::error(path, speaker, format!("`{name}` is not in this block's `with` list")));
    }
}

/// A line without an Expression shows `DEFAULT_EXPRESSION`, so that variant must be declared too.
fn check_expression(path: &str, speaker: Span<'_>, expression: Option<Span<'_>>, declarations: &Declarations<'_>, diagnostics: &mut Vec<Diagnostic>) {
    let Some(variants) = declarations.enums.get("Expression") else {
        let message = "no `enum Expression` is declared (it belongs in prelude.clsc)".to_owned();
        diagnostics.push(Diagnostic::error(path, expression.unwrap_or(speaker), message));
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
    diagnostics.push(Diagnostic::error(path, expression.unwrap_or(speaker), message));
}

use crate::parse::{BlockKind, CastKind, Item, Playable, Statement, Trigger};
use crate::SourceFile;
use pest::Span;
use serde_json::{json, Value};

/// What the Scripts name that the Host's content must back (`adr/0041`), for the Publish CLI's checks.
#[derive(Default)]
pub struct Facts {
    // Every Speaker and every Mover, since a Mover can speak.
    speakers: Vec<String>,
    movers: Vec<String>,
    flags: Vec<String>,
    once_flags: Vec<String>,
    characters: Vec<Mention>,
    cgs: Vec<Mention>,
    portraits: Vec<PortraitUse>,
    handlers: Vec<Handler>,
}

struct Mention {
    name: String,
    path: String,
    line: usize,
}

// A line that names its Expression; a line without one falls back to no Portrait and needs no file.
struct PortraitUse {
    speaker: String,
    expression: String,
    path: String,
    line: usize,
}

struct Handler {
    trigger: Trigger,
    id: String,
    path: String,
    line: usize,
}

fn line_of(span: Span<'_>) -> usize {
    span.start_pos().line_col().0
}

fn mention(name: Span<'_>, path: &str) -> Mention {
    Mention { name: name.as_str().to_owned(), path: path.to_owned(), line: line_of(name) }
}

impl Facts {
    pub(crate) fn collect(files: &[SourceFile<'_>]) -> Self {
        let mut facts = Self::default();
        for file in files {
            for item in &file.items {
                match item {
                    Item::Cast { kind: CastKind::Speaker, name } => facts.speakers.push(name.as_str().to_owned()),
                    Item::Cast { kind: CastKind::Mover, name } => {
                        facts.speakers.push(name.as_str().to_owned());
                        facts.movers.push(name.as_str().to_owned());
                    }
                    Item::Flag { name, .. } => facts.flags.push(name.as_str().to_owned()),
                    Item::Cast { kind: CastKind::Character, name } => facts.characters.push(mention(*name, &file.path)),
                    Item::Block(block) => {
                        if let Some(once) = &block.once {
                            facts.once_flags.push(once.flag.as_str().to_owned());
                        }
                        match block.kind {
                            BlockKind::Played(Playable::Cg) => facts.cgs.push(mention(block.name, &file.path)),
                            BlockKind::Played(Playable::Cutscene) => {}
                            BlockKind::Handler(trigger) => {
                                facts.handlers.push(Handler { trigger, id: block.name.as_str().to_owned(), path: file.path.clone(), line: line_of(block.name) });
                            }
                        }
                        facts.portraits_in(&block.body, &file.path);
                        for section in &block.sections {
                            facts.portraits_in(&section.body, &file.path);
                        }
                    }
                    _ => {}
                }
            }
        }
        facts
    }

    fn portraits_in(&mut self, statements: &[Statement<'_>], path: &str) {
        for statement in statements {
            match statement {
                Statement::Line { speaker, expression: Some(expression), .. } => self.portraits.push(PortraitUse {
                    speaker: speaker.as_str().to_owned(),
                    expression: expression.as_str().to_owned(),
                    path: path.to_owned(),
                    line: line_of(*speaker),
                }),
                Statement::If { then, otherwise, .. } => {
                    self.portraits_in(then, path);
                    self.portraits_in(otherwise, path);
                }
                Statement::Choose(choices) => {
                    for choice in choices {
                        self.portraits_in(&choice.body, path);
                    }
                }
                Statement::Loop(body) => self.portraits_in(body, path),
                _ => {}
            }
        }
    }

    #[must_use]
    pub fn to_json(&self) -> Value {
        let mentions = |mentions: &[Mention]| -> Vec<Value> { mentions.iter().map(|m| json!({ "name": m.name, "path": m.path, "line": m.line })).collect() };
        json!({
            "speakers": self.speakers,
            "movers": self.movers,
            "flags": self.flags,
            "onceFlags": self.once_flags,
            "characters": mentions(&self.characters),
            "cgs": mentions(&self.cgs),
            "portraits": self.portraits.iter().map(|p| json!({ "speaker": p.speaker, "expression": p.expression, "path": p.path, "line": p.line })).collect::<Vec<_>>(),
            "handlers": self.handlers.iter().map(|h| json!({ "trigger": h.trigger.keyword(), "id": h.id, "path": h.path, "line": h.line })).collect::<Vec<_>>(),
        })
    }
}

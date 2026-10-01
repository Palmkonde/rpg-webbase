use pest::iterators::Pair;
use pest::error::ErrorVariant;
use pest::{Parser as _, Span};

#[derive(pest_derive::Parser)]
#[grammar = "clsc.pest"]
struct ClscParser;

pub type ParseError = pest::error::Error<Rule>;

pub enum Item<'s> {
    Speaker(Span<'s>),
    Enum { name: Span<'s>, variants: Vec<Span<'s>> },
    Block(Block<'s>),
}

pub struct Block<'s> {
    pub kind: BlockKind,

    // A cutscene's name, or a handler's Entity or Zone id.
    pub name: Span<'s>,
    pub cast: Vec<Span<'s>>,
    pub body: Vec<Statement<'s>>,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum BlockKind {
    Handler(Trigger),
    Cutscene,
}

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Trigger {
    Interact,
    Enter,
}

impl Trigger {
    pub fn keyword(self) -> &'static str {
        match self {
            Self::Interact => "interact",
            Self::Enter => "enter",
        }
    }
}

pub enum Statement<'s> {
    Line { speaker: Span<'s>, expression: Option<Span<'s>>, text: String },
    Play(Span<'s>),
}

pub fn parse(source: &str) -> Result<Vec<Item<'_>>, ParseError> {
    let file = ClscParser::parse(Rule::file, source)?.next().expect("the file rule always matches once");
    file.into_inner().filter(|pair| pair.as_rule() != Rule::EOI).map(item).collect()
}

fn item(pair: Pair<'_, Rule>) -> Result<Item<'_>, ParseError> {
    Ok(match pair.as_rule() {
        Rule::speaker => Item::Speaker(names(pair)[0]),
        Rule::enum_decl => {
            let names = names(pair);
            Item::Enum { name: names[0], variants: names[1..].to_vec() }
        }
        _ => Item::Block(block(pair)?),
    })
}

fn block(pair: Pair<'_, Rule>) -> Result<Block<'_>, ParseError> {
    let mut block = Block { kind: BlockKind::Cutscene, name: pair.as_span(), cast: Vec::new(), body: Vec::new() };
    for part in pair.into_inner() {
        match part.as_rule() {
            Rule::trigger if part.as_str() == "interact" => block.kind = BlockKind::Handler(Trigger::Interact),
            Rule::trigger => block.kind = BlockKind::Handler(Trigger::Enter),
            Rule::name => block.name = part.as_span(),
            Rule::cast => block.cast = names(part),
            Rule::body => block.body = part.into_inner().map(statement).collect::<Result<_, _>>()?,
            _ => {}
        }
    }
    Ok(block)
}

fn statement(pair: Pair<'_, Rule>) -> Result<Statement<'_>, ParseError> {
    let rule = pair.as_rule();
    let mut names = Vec::new();
    let mut text = String::new();
    for part in pair.into_inner() {
        match part.as_rule() {
            Rule::name => names.push(part.as_span()),
            Rule::text => text = unescape(part.as_span())?,
            _ => {}
        }
    }

    Ok(if rule == Rule::play {
        Statement::Play(names[0])
    } else {
        Statement::Line { speaker: names[0], expression: names.get(1).copied(), text }
    })
}

fn names(pair: Pair<'_, Rule>) -> Vec<Span<'_>> {
    pair.into_inner().filter(|part| part.as_rule() == Rule::name).map(|part| part.as_span()).collect()
}

/// `quoted` still has its quotes. Only `\"` and `\\` escape.
fn unescape(quoted: Span<'_>) -> Result<String, ParseError> {
    let mut text = String::new();
    let inner = &quoted.as_str()[1..quoted.as_str().len() - 1];
    let mut chars = inner.char_indices().map(|(index, char)| (index + 1, char));

    while let Some((index, char)) = chars.next() {
        if char != '\\' {
            text.push(char);
            continue;
        }

        let (escaped_index, escaped) = chars.next().expect("the grammar puts a character after every backslash");
        if escaped != '"' && escaped != '\\' {
            let escape = quoted.get(index..escaped_index + escaped.len_utf8()).expect("an escape inside the text");
            let message = format!("unknown escape `{}`: only `\\\"` and `\\\\` escape", escape.as_str());
            return Err(ParseError::new_from_span(ErrorVariant::CustomError { message }, escape));
        }
        text.push(escaped);
    }

    Ok(text)
}

#[cfg(test)]
mod tests {
    use super::{parse, Item};

    #[test]
    fn a_keyword_ends_at_a_word_boundary() {
        assert!(parse("speakerNarrator;").is_err());
        assert!(matches!(parse("speaker speakers;").unwrap()[..], [Item::Speaker(name)] if name.as_str() == "speakers"));
    }
}

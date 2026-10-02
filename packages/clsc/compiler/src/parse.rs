use pest::iterators::Pair;
use pest::error::ErrorVariant;
use pest::{Parser as _, Span};

#[derive(pest_derive::Parser)]
#[grammar = "clsc.pest"]
struct ClscParser;

pub type ParseError = pest::error::Error<Rule>;

pub enum Item<'s> {
    // The module path, `a.b` for `use a.b;`.
    Use(Span<'s>),
    Speaker(Span<'s>),
    Enum { name: Span<'s>, variants: Vec<Span<'s>> },
    Flag { name: Span<'s>, ty: Span<'s>, default: bool },
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
    Set { flag: Span<'s>, value: Expr<'s> },

    // An `else if` is an `otherwise` holding one `If`.
    If { condition: Expr<'s>, then: Vec<Statement<'s>>, otherwise: Vec<Statement<'s>> },
    Choose(Vec<Choice<'s>>),
}

pub struct Choice<'s> {
    pub text: String,

    // Hides the choice when false, or shows it locked with `locked` as the reason.
    pub condition: Option<Expr<'s>>,
    pub locked: Option<String>,
    pub body: Vec<Statement<'s>>,
}

pub enum Expr<'s> {
    Bool(bool),
    Flag(Span<'s>),
    Not(Box<Expr<'s>>),
    Binary(Box<Expr<'s>>, BinaryOp, Box<Expr<'s>>),
}

#[derive(Clone, Copy)]
pub enum BinaryOp {
    Or,
    And,
    Equal,
    NotEqual,
}

pub fn parse(source: &str) -> Result<Vec<Item<'_>>, ParseError> {
    let file = ClscParser::parse(Rule::file, source)?.next().expect("the file rule always matches once");
    file.into_inner().filter(|pair| pair.as_rule() != Rule::EOI).map(item).collect()
}

fn item(pair: Pair<'_, Rule>) -> Result<Item<'_>, ParseError> {
    Ok(match pair.as_rule() {
        Rule::use_decl => {
            let path = pair.into_inner().find(|part| part.as_rule() == Rule::module_path).expect("a `use` names a module");
            Item::Use(path.as_span())
        }
        Rule::speaker => Item::Speaker(names(pair)[0]),
        Rule::enum_decl => {
            let names = names(pair);
            Item::Enum { name: names[0], variants: names[1..].to_vec() }
        }
        Rule::flag_decl => {
            let default = pair.clone().into_inner().any(|part| part.as_rule() == Rule::bool_literal && part.as_str() == "true");
            let names = names(pair);
            Item::Flag { name: names[0], ty: names[1], default }
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
            Rule::body => block.body = body(part)?,
            _ => {}
        }
    }
    Ok(block)
}

fn body(pair: Pair<'_, Rule>) -> Result<Vec<Statement<'_>>, ParseError> {
    pair.into_inner().map(statement).collect()
}

fn statement(pair: Pair<'_, Rule>) -> Result<Statement<'_>, ParseError> {
    let rule = pair.as_rule();
    let mut parts = pair.into_inner().filter(|part| !is_keyword(part.as_rule()));
    let mut next = || parts.next().expect("the grammar gives every statement its parts");

    Ok(match rule {
        Rule::play => Statement::Play(next().as_span()),
        Rule::set => Statement::Set { flag: next().as_span(), value: expr(next()) },
        Rule::if_statement => {
            let condition = expr(next());
            let then = body(next())?;
            let otherwise = match parts.next() {
                Some(part) if part.as_rule() == Rule::if_statement => vec![statement(part)?],
                Some(part) => body(part)?,
                None => Vec::new(),
            };
            Statement::If { condition, then, otherwise }
        }
        Rule::choose => Statement::Choose(parts.map(choice).collect::<Result<_, _>>()?),
        _ => {
            let speaker = next().as_span();
            let mut rest: Vec<_> = parts.collect();
            let text = unescape(rest.pop().expect("a line ends with its text").as_span())?;
            Statement::Line { speaker, expression: rest.first().map(Pair::as_span), text }
        }
    })
}

fn choice(pair: Pair<'_, Rule>) -> Result<Choice<'_>, ParseError> {
    let mut choice = Choice { text: String::new(), condition: None, locked: None, body: Vec::new() };
    for part in pair.into_inner() {
        match part.as_rule() {
            Rule::text => choice.text = unescape(part.as_span())?,
            Rule::expr => choice.condition = Some(expr(part)),
            Rule::locked => {
                let reason = part.into_inner().find(|part| part.as_rule() == Rule::text).expect("locked(...) holds its reason");
                choice.locked = Some(unescape(reason.as_span())?);
            }
            Rule::body => choice.body = body(part)?,
            _ => {}
        }
    }
    Ok(choice)
}

fn expr(pair: Pair<'_, Rule>) -> Expr<'_> {
    match pair.as_rule() {
        Rule::bool_literal => Expr::Bool(pair.as_str() == "true"),
        Rule::name => Expr::Flag(pair.as_span()),
        Rule::not => Expr::Not(Box::new(expr(pair.into_inner().next().expect("`!` has an operand")))),

        // `expr`, `and_expr` and `equality` alternate operands and operators, folded to the left.
        _ => {
            let mut parts = pair.into_inner();
            let mut left = expr(parts.next().expect("an operand"));
            while let (Some(op), Some(right)) = (parts.next(), parts.next()) {
                let op = match op.as_str() {
                    "||" => BinaryOp::Or,
                    "&&" => BinaryOp::And,
                    "==" => BinaryOp::Equal,
                    _ => BinaryOp::NotEqual,
                };
                left = Expr::Binary(Box::new(left), op, Box::new(expr(right)));
            }
            left
        }
    }
}

fn is_keyword(rule: Rule) -> bool {
    matches!(rule, Rule::set_keyword | Rule::if_keyword | Rule::else_keyword | Rule::choose_keyword)
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

use serde_json::Value;
use std::collections::HashMap;

/// A Flag seed, the Host's Student state fixture: `{ "studentId": …, "flags": { name: value } }`.
pub struct FlagSeed {
    stored: HashMap<String, Stored>,
}

#[derive(Clone, Copy)]
pub enum Stored {
    Bool(bool),
    String,

    // Anything else, described for an error message: "null", "a number", …
    Other(&'static str),
}

impl Stored {
    pub const fn describe(self) -> &'static str {
        match self {
            Self::Bool(true) => "true",
            Self::Bool(false) => "false",
            Self::String => "a string",
            Self::Other(description) => description,
        }
    }
}

impl FlagSeed {
    /// # Errors
    ///
    /// When `json` isn't JSON, or isn't an object holding a `flags` object.
    pub fn parse(json: &str) -> Result<Self, String> {
        let Value::Object(mut seed) = serde_json::from_str(json).map_err(|error| error.to_string())? else {
            return Err("a Flag seed is a JSON object".to_owned());
        };
        let Some(Value::Object(flags)) = seed.remove("flags") else {
            return Err("a Flag seed needs a `flags` object".to_owned());
        };
        Ok(Self { stored: flags.into_iter().map(|(name, value)| (name, stored(&value))).collect() })
    }

    pub(crate) fn get(&self, name: &str) -> Option<Stored> {
        self.stored.get(name).copied()
    }
}

const fn stored(value: &Value) -> Stored {
    match value {
        Value::Bool(value) => Stored::Bool(*value),
        Value::Null => Stored::Other("null"),
        Value::Number(_) => Stored::Other("a number"),
        Value::String(_) => Stored::String,
        Value::Array(_) => Stored::Other("an array"),
        Value::Object(_) => Stored::Other("an object"),
    }
}

#[cfg(test)]
mod tests {
    use super::FlagSeed;

    #[test]
    fn a_seed_that_is_not_an_object_is_refused() {
        assert_eq!(FlagSeed::parse("[]").err().unwrap(), "a Flag seed is a JSON object");
    }

    #[test]
    fn a_seed_without_a_flags_object_is_refused() {
        assert_eq!(FlagSeed::parse(r#"{ "flags": [] }"#).err().unwrap(), "a Flag seed needs a `flags` object");
    }
}

use serde_json::Value;
use std::collections::{BTreeMap, HashSet};
use std::path::Path;

/// The Host's String Table fixture: `{ "locale": …, "table": { <Locale>: { <key>: <text> } } }`.
pub struct StringTable {
    // Sorted by Locale, so an error lists them in a stable order.
    keys: BTreeMap<String, HashSet<String>>,
}

impl StringTable {
    /// # Errors
    ///
    /// When `json` isn't JSON, or isn't an object holding a `table` of at least one Locale, each an
    /// object of strings.
    pub fn parse(json: &str) -> Result<Self, String> {
        let Value::Object(mut root) = serde_json::from_str(json).map_err(|error| error.to_string())? else {
            return Err("a String Table is a JSON object".to_owned());
        };
        let Some(Value::Object(table)) = root.remove("table") else {
            return Err("a String Table needs a `table` object".to_owned());
        };

        let mut keys = BTreeMap::new();
        for (locale, entries) in table {
            let Value::Object(entries) = entries else {
                return Err(format!("the String Table's Locale `{locale}` isn't an object"));
            };
            if let Some((key, _)) = entries.iter().find(|(_, text)| !text.is_string()) {
                return Err(format!("the String Table's `{locale}` Locale holds `{key}`, which isn't a string"));
            }
            keys.insert(locale, entries.into_iter().map(|(key, _)| key).collect());
        }
        if keys.is_empty() {
            return Err("a String Table needs at least one Locale".to_owned());
        }
        Ok(Self { keys })
    }

    /// # Errors
    ///
    /// When the file at `path` can't be read, or isn't a String Table.
    pub fn read(path: &Path) -> Result<Self, String> {
        crate::read_json(path, Self::parse)
    }

    pub(crate) fn locales_missing(&self, key: &str) -> Vec<&str> {
        self.keys.iter().filter(|(_, keys)| !keys.contains(key)).map(|(locale, _)| locale.as_str()).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::StringTable;

    #[test]
    fn a_string_table_that_is_not_an_object_is_refused() {
        assert_eq!(StringTable::parse("[]").err().unwrap(), "a String Table is a JSON object");
    }

    #[test]
    fn a_string_table_without_a_table_object_is_refused() {
        assert_eq!(StringTable::parse(r#"{ "table": [] }"#).err().unwrap(), "a String Table needs a `table` object");
    }

    #[test]
    fn a_string_table_without_a_locale_is_refused() {
        assert_eq!(StringTable::parse(r#"{ "table": {} }"#).err().unwrap(), "a String Table needs at least one Locale");
    }

    #[test]
    fn a_string_table_entry_that_is_not_a_string_is_refused() {
        assert_eq!(StringTable::parse(r#"{ "table": { "en": { "a.b": 1 } } }"#).err().unwrap(), "the String Table's `en` Locale holds `a.b`, which isn't a string");
    }

    #[test]
    fn a_string_table_locale_that_is_not_an_object_is_refused() {
        assert_eq!(StringTable::parse(r#"{ "table": { "en": [] } }"#).err().unwrap(), "the String Table's Locale `en` isn't an object");
    }
}

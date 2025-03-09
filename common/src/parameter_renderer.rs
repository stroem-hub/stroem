use serde_json::{Value, Map};
use upon::Engine;
use anyhow::{Result, anyhow};

pub struct ParameterRenderer {
    context: Value,
    engine: Engine<'static>,
}

fn merge(a: &mut Value, b: &Value) {
    match (a, b) {
        (&mut Value::Object(ref mut a), &Value::Object(ref b)) => {
            for (k, v) in b {
                merge(a.entry(k.clone()).or_insert(Value::Null), v);
            }
        }
        (a, b) => {
            *a = b.clone();
        }
    }
}


impl ParameterRenderer {
    /// Creates a new ParameterRenderer with an empty context.
    pub fn new() -> Self {
        let mut engine = Engine::new();
        // No need to configure strict mode; upon defaults to "" for missing values
        ParameterRenderer {
            context: Value::Object(Map::new()),
            engine,
        }
    }

    /// Merges a new value into the internal context.
    pub fn add_to_context(&mut self, value: Value) -> Result<()> {
        Ok(merge(&mut self.context, &value))
        /*
        if let Value::Object(existing_map) = &mut self.context {
            if let Value::Object(new_map) = value {
                for (key, val) in new_map {
                    existing_map.insert(key, val);
                }
                Ok(())
            } else {
                Err(anyhow!("Value to add to context must be an object"))
            }
        } else {
            Err(anyhow!("Context must be an object"))
        }

         */
    }

    /// Renders a Value, processing any string values as templates using the context.
    /// Renders a Value, processing any string values as templates using the context.
    pub fn render(&self, input: Value) -> Result<Value> {
        match input {
            Value::String(template) => {
                let compiled = self.engine.compile(&template)
                    .map_err(|e| anyhow!("Failed to compile template: {}", e))?;
                let rendered = compiled.render(&self.engine, &self.context)
                    .to_string()  // Returns Result<String, upon::Error>
                    .map_err(|e| anyhow!("Failed to render template: {}", e))?;
                Ok(Value::String(rendered))
            }
            Value::Object(map) => {
                let mut rendered_map = Map::new();
                for (key, value) in map.into_iter() {
                    rendered_map.insert(key, self.render(value)?);
                }
                Ok(Value::Object(rendered_map))
            }
            Value::Array(vec) => {
                let rendered_vec: Vec<Value> = vec.into_iter()
                    .map(|v| self.render(v))
                    .collect::<Result<Vec<_>>>()?;
                Ok(Value::Array(rendered_vec))
            }
            // Pass through other types unchanged
            v => Ok(v),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_add_to_context() {
        let mut renderer = ParameterRenderer::new();
        let value = json!({"key": "value"});
        renderer.add_to_context(value).unwrap();
        assert_eq!(renderer.context, json!({"key": "value"}));

        let more_value = json!({"another": 42});
        renderer.add_to_context(more_value).unwrap();
        assert_eq!(renderer.context, json!({"key": "value", "another": 42}));

        let invalid = json!("not an object");
        assert!(renderer.add_to_context(invalid).is_err());
    }

    #[test]
    fn test_render() {
        let mut renderer = ParameterRenderer::new();
        renderer.add_to_context(json!({"name": "Alice", "age": 30})).unwrap();

        // Test string rendering with existing value
        let input = json!("Hello, {{ name }}! You are {{ age }} years old.");
        let rendered = renderer.render(input).unwrap();
        assert_eq!(rendered, json!("Hello, Alice! You are 30 years old."));

        // Test missing value (should render as empty string)
        let input = json!("Hi, {{ missing }}!");
        let rendered = renderer.render(input).unwrap();
        assert_eq!(rendered, json!("Hi, !"));

        // Test nested object
        let input = json!({
            "greeting": "Hi, {{ name }}",
            "details": {
                "age": "{{ age }}",
                "unknown": "{{ unknown }}"
            }
        });
        let rendered = renderer.render(input).unwrap();
        assert_eq!(rendered, json!({
            "greeting": "Hi, Alice",
            "details": {
                "age": "30",
                "unknown": ""
            }
        }));

        // Test array
        let input = json!(["{{ name }}", "{{ age }}", "{{ missing }}"]);
        let rendered = renderer.render(input).unwrap();
        assert_eq!(rendered, json!(["Alice", "30", ""]));

        // Test non-string pass-through
        let input = json!(42);
        let rendered = renderer.render(input).unwrap();
        assert_eq!(rendered, json!(42));
    }
}
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Clone)]
pub struct InteractionRule {
    pub drug1: String,
    pub drug2: String,
    pub severity: String,
    pub description: String,
}

pub struct InteractionEngine {
    rules: HashMap<String, Vec<InteractionRule>>,
}

impl InteractionEngine {
    pub fn new() -> Self {
        // In a real app, this would be loaded from a binary-encoded file or a database.
        // For the demo, we initialize an empty or mock engine.
        InteractionEngine {
            rules: HashMap::new(),
        }
    }

    pub fn check_interactions(&self, rxcuis: &[String]) -> Vec<InteractionRule> {
        let mut found = Vec::new();
        for i in 0..rxcuis.len() {
            for j in i + 1..rxcuis.len() {
                if let Some(rules) = self.rules.get(&rxcuis[i]) {
                    for rule in rules {
                        if rule.drug2 == rxcuis[j] {
                            found.push(rule.clone());
                        }
                    }
                }
            }
        }
        found
    }
}

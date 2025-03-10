use std::collections::{HashMap, HashSet};
use anyhow::{Result, anyhow};
use crate::workspace::FlowStep;

pub struct DagWalker {
    graph: HashMap<String, Vec<String>>, // Step -> Next steps (on_success/on_fail)
    incoming: HashMap<String, usize>,    // Step -> Number of incoming edges
    flow: HashMap<String, FlowStep>,     // Step -> FlowStep definition
    visited: HashSet<String>,            // Tracks visited steps
}

impl DagWalker {
    /// Creates a new DagWalker from a flow definition.
    pub fn new(flow: &HashMap<String, FlowStep>) -> Result<Self> {
        let mut graph: HashMap<String, Vec<String>> = HashMap::new();
        let mut incoming: HashMap<String, usize> = HashMap::new();

        // Build the graph and incoming edge counts
        for (step_name, step) in flow {
            let mut next_steps = Vec::new();
            if let Some(next) = &step.on_success {
                next_steps.push(next.clone());
            }
            if let Some(next) = &step.on_fail {
                next_steps.push(next.clone());
            }
            graph.insert(step_name.clone(), next_steps);
            incoming.entry(step_name.clone()).or_insert(0);
        }

        for (step, next_steps) in &graph {
            for next in next_steps {
                *incoming.entry(next.clone()).or_insert(0) += 1;
            }
        }

        // Check for cycles
        if Self::has_cycle(&graph) {
            return Err(anyhow!("Cycle detected in flow"));
        }

        Ok(DagWalker {
            graph,
            incoming,
            flow: flow.clone(),
            visited: HashSet::new(),
        })
    }

    /// Detects cycles in the graph using DFS.
    fn has_cycle(graph: &HashMap<String, Vec<String>>) -> bool {
        let mut visited = HashSet::new();
        let mut rec_stack = HashSet::new();

        for start in graph.keys() {
            if Self::dfs_cycle_check(start, graph, &mut visited, &mut rec_stack) {
                return true;
            }
        }
        false
    }

    fn dfs_cycle_check(
        node: &str,
        graph: &HashMap<String, Vec<String>>,
        visited: &mut HashSet<String>,
        rec_stack: &mut HashSet<String>,
    ) -> bool {
        if rec_stack.contains(node) {
            return true; // Cycle detected
        }
        if visited.contains(node) {
            return false; // Already fully explored
        }

        visited.insert(node.to_string());
        rec_stack.insert(node.to_string());

        if let Some(next_steps) = graph.get(node) {
            for next in next_steps {
                if Self::dfs_cycle_check(next, graph, visited, rec_stack) {
                    return true;
                }
            }
        }

        rec_stack.remove(node);
        false
    }

    /// Returns the next step to execute based on the last completed step and its success status.
    /// If step_name is None, returns an initial step with no incoming edges that hasn’t been visited.
    pub fn get_next_step(&mut self, step_name: Option<String>, success: bool) -> Option<String> {
        let next = match step_name {
            None => {
                // Return the first unvisited step with no incoming edges
                self.incoming.iter()
                    .filter(|&(ref step, &count)| count == 0 && !self.visited.contains(*step))
                    .map(|(step, _)| step.clone())
                    .next()
            }
            Some(step) => {
                if let Some(flow_step) = self.flow.get(&step) {
                    self.visited.insert(step.clone());
                    if success {
                        flow_step.on_success.clone()
                    } else {
                        flow_step.on_fail.clone()
                    }
                } else {
                    None // Step not found
                }
            }
        };
        next
    }

    /// Returns the FlowStep definition for a given step name.
    pub fn get_step(&self, step_name: &str) -> Option<&FlowStep> {
        self.flow.get(step_name)
    }
}
use std::collections::{HashMap, HashSet};
use anyhow::{Result, anyhow};
use crate::workspace_configuration::FlowStep;

pub struct DagWalker {
    graph: HashMap<String, Vec<String>>, // Step -> Steps that depend on it (outgoing edges)
    incoming: HashMap<String, usize>,    // Step -> Number of unmet dependencies (incoming edges)
    flow: HashMap<String, FlowStep>,     // Step -> FlowStep definition
    visited: HashSet<String>,            // Tracks visited steps
}

impl DagWalker {
    /// Creates a new DagWalker from a flow definition.
    pub fn new(flow: &HashMap<String, FlowStep>) -> Result<Self> {
        let mut graph: HashMap<String, Vec<String>> = HashMap::new();
        let mut incoming: HashMap<String, usize> = HashMap::new();

        // Initialize all steps in incoming and graph
        for step_name in flow.keys() {
            incoming.entry(step_name.clone()).or_insert(0);
            graph.entry(step_name.clone()).or_insert_with(Vec::new);
        }

        // Build the graph and incoming edge counts based on depends_on
        for (step_name, step) in flow {
            for dep in step.depends_on.as_ref().unwrap_or(&vec![]) {
                // Add step_name as a dependent of dep (outgoing edge)
                graph.entry(dep.clone())
                    .or_insert_with(Vec::new)
                    .push(step_name.clone());
                // Increment incoming edges for step_name
                *incoming.entry(step_name.clone()).or_insert(0) += 1;
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

    /// Returns the next step to execute based on the last completed step.
    /// If step_name is None, returns an initial step with no unmet dependencies that hasn’t been visited.
    /// Marks the completed step as visited and updates dependency counts.
    fn next_steps(&mut self, step_name: Option<String>)-> impl Iterator<Item = String> {
        if let Some(step) = step_name {
            // Mark the step as visited
            self.visited.insert(step.clone());
            // Reduce incoming edge count for dependents
            if let Some(dependents) = self.graph.get(&step) {
                for dep in dependents {
                    if let Some(count) = self.incoming.get_mut(dep) {
                        *count -= 1;
                    }
                }
            }
        }

        // Return the first unvisited step with no unmet dependencies
        self.incoming.iter()
            .filter(|&(ref step, &count)| count == 0 && !self.visited.contains(*step))
            .map(|(step, _)| step.clone())
    }

    pub fn get_next_step(&mut self, step_name: Option<String>) -> Option<String> {
        self.next_steps(step_name).next()
    }

    /// Returns all steps ready to execute based on the last completed step.
    /// If step_name is None, returns initial steps with no unmet dependencies that haven’t been visited.
    pub fn get_next_steps(&mut self, step_name: Option<String>) -> Vec<String> {
        self.next_steps(step_name).collect()
    }

    /// Returns the FlowStep definition for a given step name.
    pub fn get_step(&self, step_name: &str) -> Option<&FlowStep> {
        self.flow.get(step_name)
    }

}
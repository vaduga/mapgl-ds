use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
#[allow(clippy::struct_field_names)]
struct Span {
    trace_id: String,
    span_id: String,
    parent_id: Option<String>,
    service_name: String,
    operation_name: String,
    start_time: f64,
    duration: f64,
    #[serde(default)]
    attributes: HashMap<String, String>,
    #[serde(default = "default_status")]
    status: String,
}

fn default_status() -> String {
    "OK".to_string()
}

#[derive(Deserialize, Serialize)]
struct Trace {
    id: String,
    spans: Vec<Span>,
}

/// Nested span tree node for JSON output — matches TypeScript `SpanNode`.
#[derive(Serialize, Deserialize)]
struct SpanTreeNode {
    span: Span,
    children: Vec<SpanTreeNode>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ParsedTrace {
    trace_id: String,
    /// Full span tree built from parent-child relationships. Orphan spans are attached to root.
    span_tree: Option<SpanTreeNode>,
    /// Longest cumulative-duration path from root to leaf, with full span data.
    critical_path: Vec<Span>,
    service_graph: ServiceGraphOutput,
    total_duration: f64,
    slowest_service: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ServiceGraphOutput {
    services: Vec<String>,
    edges: Vec<Edge>,
}

#[derive(Serialize, Deserialize, Clone, PartialEq, Eq, Hash)]
struct Edge {
    from: String,
    to: String,
}

/// Internal index-based span tree node (not serialized).
struct IndexedNode {
    span: Span,
    children: Vec<usize>,
}

/// Build an index-based span tree from flat spans. Returns (nodes vec, root index).
fn build_span_tree(spans: &[Span]) -> (Vec<IndexedNode>, Option<usize>) {
    if spans.is_empty() {
        return (Vec::new(), None);
    }

    let mut nodes: Vec<IndexedNode> = spans
        .iter()
        .map(|s| IndexedNode {
            span: s.clone(),
            children: Vec::new(),
        })
        .collect();

    let id_to_idx: HashMap<&str, usize> = spans
        .iter()
        .enumerate()
        .map(|(i, s)| (s.span_id.as_str(), i))
        .collect();

    let mut root_candidates: Vec<usize> = Vec::new();
    let mut orphans: Vec<usize> = Vec::new();

    for (i, span) in spans.iter().enumerate() {
        match &span.parent_id {
            Some(pid) if !pid.is_empty() => {
                if let Some(&parent_idx) = id_to_idx.get(pid.as_str()) {
                    nodes[parent_idx].children.push(i);
                } else {
                    orphans.push(i);
                }
            }
            _ => {
                root_candidates.push(i);
            }
        }
    }

    // When no span has parent_id=None (e.g. root has a remote parent),
    // treat orphans as root candidates so the tree is still built.
    if root_candidates.is_empty() && !orphans.is_empty() {
        root_candidates = orphans;
        orphans = Vec::new();
    }

    // Pick the earliest-starting root span as the canonical root.
    // Attach other root candidates and orphans as children of it.
    let root_idx = root_candidates.iter().copied().min_by(|&a, &b| {
        nodes[a]
            .span
            .start_time
            .partial_cmp(&nodes[b].span.start_time)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    if let Some(ri) = root_idx {
        for &other_root in &root_candidates {
            if other_root != ri {
                nodes[ri].children.push(other_root);
            }
        }
        for orphan in orphans {
            nodes[ri].children.push(orphan);
        }
    }

    (nodes, root_idx)
}

/// Convert the index-based tree into a nested `SpanTreeNode` for JSON serialization.
fn build_tree_output(nodes: &[IndexedNode], idx: usize) -> SpanTreeNode {
    SpanTreeNode {
        span: nodes[idx].span.clone(),
        children: nodes[idx]
            .children
            .iter()
            .map(|&ci| build_tree_output(nodes, ci))
            .collect(),
    }
}

/// DFS to find the critical path (longest cumulative duration from root to leaf).
fn find_critical_path_dfs(
    nodes: &[IndexedNode],
    current: usize,
    current_path: &mut Vec<usize>,
    best_path: &mut Vec<usize>,
    best_duration: &mut f64,
    current_duration: f64,
) {
    current_path.push(current);
    let dur = current_duration + nodes[current].span.duration;

    if nodes[current].children.is_empty() {
        if dur > *best_duration {
            *best_duration = dur;
            *best_path = current_path.clone();
        }
    } else {
        for &child in &nodes[current].children {
            find_critical_path_dfs(nodes, child, current_path, best_path, best_duration, dur);
        }
    }

    current_path.pop();
}

/// Extract service graph from span tree.
fn extract_graph(nodes: &[IndexedNode]) -> ServiceGraphOutput {
    let mut services = std::collections::HashSet::new();
    let mut edges = std::collections::HashSet::new();

    for node in nodes {
        services.insert(node.span.service_name.clone());
        for &child_idx in &node.children {
            let child_svc = &nodes[child_idx].span.service_name;
            if node.span.service_name != *child_svc {
                edges.insert(Edge {
                    from: node.span.service_name.clone(),
                    to: child_svc.clone(),
                });
            }
        }
    }

    ServiceGraphOutput {
        services: services.into_iter().collect(),
        edges: edges.into_iter().collect(),
    }
}

/// Find the slowest service by cumulative span duration.
fn find_slowest_service(spans: &[Span]) -> String {
    let mut service_durations: HashMap<&str, f64> = HashMap::new();
    for span in spans {
        *service_durations
            .entry(span.service_name.as_str())
            .or_insert(0.0) += span.duration;
    }
    service_durations
        .into_iter()
        .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(svc, _)| svc.to_string())
        .unwrap_or_default()
}

fn analyze_trace(trace: &Trace) -> ParsedTrace {
    let (nodes, root_idx) = build_span_tree(&trace.spans);

    let span_tree = root_idx.map(|ri| build_tree_output(&nodes, ri));

    let mut critical_path_indices = Vec::new();
    let mut best_duration = 0.0;

    if let Some(root) = root_idx {
        let mut current_path = Vec::new();
        find_critical_path_dfs(
            &nodes,
            root,
            &mut current_path,
            &mut critical_path_indices,
            &mut best_duration,
            0.0,
        );
    }

    let critical_path: Vec<Span> = critical_path_indices
        .iter()
        .map(|&i| nodes[i].span.clone())
        .collect();

    let service_graph = extract_graph(&nodes);

    let total_duration = if trace.spans.is_empty() {
        0.0
    } else {
        let min_start = trace
            .spans
            .iter()
            .map(|s| s.start_time)
            .fold(f64::INFINITY, f64::min);
        let max_end = trace
            .spans
            .iter()
            .map(|s| s.start_time + s.duration)
            .fold(f64::NEG_INFINITY, f64::max);
        (max_end - min_start).max(0.0)
    };

    let slowest_service = find_slowest_service(&trace.spans);

    ParsedTrace {
        trace_id: trace.id.clone(),
        span_tree,
        critical_path,
        service_graph,
        total_duration,
        slowest_service,
    }
}

/// WASM export: parse traces and produce analysis results.
#[wasm_bindgen]
pub fn parse_traces(data: &str) -> String {
    let traces: Vec<Trace> = match serde_json::from_str(data) {
        Ok(v) => v,
        Err(_) => return String::from("[]"),
    };

    let results: Vec<ParsedTrace> = traces.iter().map(analyze_trace).collect();

    serde_json::to_string(&results).unwrap_or_else(|_| String::from("[]"))
}

/// WASM export: find the critical path of a single trace.
#[wasm_bindgen]
pub fn find_critical_path(data: &str) -> String {
    let trace: Trace = match serde_json::from_str(data) {
        Ok(v) => v,
        Err(_) => return String::from("[]"),
    };

    let parsed = analyze_trace(&trace);
    serde_json::to_string(&parsed.critical_path).unwrap_or_else(|_| String::from("[]"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_simple_trace() -> Trace {
        Trace {
            id: "trace-1".to_string(),
            spans: vec![
                Span {
                    trace_id: "trace-1".to_string(),
                    span_id: "span-1".to_string(),
                    parent_id: None,
                    service_name: "gateway".to_string(),
                    operation_name: "GET /api".to_string(),
                    start_time: 1000.0,
                    duration: 200.0,
                    attributes: HashMap::new(),
                    status: "OK".to_string(),
                },
                Span {
                    trace_id: "trace-1".to_string(),
                    span_id: "span-2".to_string(),
                    parent_id: Some("span-1".to_string()),
                    service_name: "service-a".to_string(),
                    operation_name: "process".to_string(),
                    start_time: 1010.0,
                    duration: 80.0,
                    attributes: HashMap::new(),
                    status: "OK".to_string(),
                },
                Span {
                    trace_id: "trace-1".to_string(),
                    span_id: "span-3".to_string(),
                    parent_id: Some("span-1".to_string()),
                    service_name: "service-b".to_string(),
                    operation_name: "query".to_string(),
                    start_time: 1020.0,
                    duration: 150.0,
                    attributes: HashMap::new(),
                    status: "OK".to_string(),
                },
                Span {
                    trace_id: "trace-1".to_string(),
                    span_id: "span-4".to_string(),
                    parent_id: Some("span-3".to_string()),
                    service_name: "database".to_string(),
                    operation_name: "SELECT".to_string(),
                    start_time: 1025.0,
                    duration: 120.0,
                    attributes: HashMap::new(),
                    status: "OK".to_string(),
                },
            ],
        }
    }

    #[test]
    fn test_span_tree_construction() {
        let trace = make_simple_trace();
        let (nodes, root) = build_span_tree(&trace.spans);
        assert_eq!(nodes.len(), 4);
        assert_eq!(root, Some(0));
        assert_eq!(nodes[0].children.len(), 2);
    }

    #[test]
    fn test_span_tree_in_output() {
        let trace = make_simple_trace();
        let parsed = analyze_trace(&trace);
        let tree = parsed.span_tree.expect("should have span tree");
        assert_eq!(tree.span.span_id, "span-1");
        assert_eq!(tree.children.len(), 2);
        let db_node = &tree.children[1].children[0];
        assert_eq!(db_node.span.service_name, "database");
        assert!(db_node.children.is_empty());
    }

    #[test]
    fn test_critical_path_is_longest() {
        let trace = make_simple_trace();
        let parsed = analyze_trace(&trace);
        assert_eq!(parsed.critical_path.len(), 3);
        assert_eq!(parsed.critical_path[0].service_name, "gateway");
        assert_eq!(
            parsed.critical_path.last().map(|s| s.service_name.as_str()),
            Some("database")
        );
    }

    #[test]
    fn test_critical_path_includes_attributes() {
        let mut trace = make_simple_trace();
        trace.spans[0]
            .attributes
            .insert("http.method".to_string(), "GET".to_string());
        let parsed = analyze_trace(&trace);
        assert_eq!(
            parsed.critical_path[0].attributes.get("http.method"),
            Some(&"GET".to_string())
        );
    }

    #[test]
    fn test_service_graph_extraction() {
        let trace = make_simple_trace();
        let parsed = analyze_trace(&trace);
        assert!(parsed.service_graph.services.len() >= 3);
        assert!(!parsed.service_graph.edges.is_empty());
    }

    #[test]
    fn test_slowest_service() {
        let trace = make_simple_trace();
        let parsed = analyze_trace(&trace);
        assert_eq!(parsed.slowest_service, "gateway");
    }

    #[test]
    fn test_orphan_span_attached_to_root() {
        let mut trace = make_simple_trace();
        trace.spans.push(Span {
            trace_id: "trace-1".to_string(),
            span_id: "span-orphan".to_string(),
            parent_id: Some("non-existent".to_string()),
            service_name: "orphan-svc".to_string(),
            operation_name: "lost".to_string(),
            start_time: 1050.0,
            duration: 10.0,
            attributes: HashMap::new(),
            status: "OK".to_string(),
        });
        let parsed = analyze_trace(&trace);
        let tree = parsed.span_tree.expect("should have span tree");
        assert!(tree.children.len() >= 3);
    }

    #[test]
    fn test_parse_traces_wasm_roundtrip() {
        let traces = vec![make_simple_trace()];
        let json = serde_json::to_string(&traces).expect("serialize");
        let result_str = parse_traces(&json);
        let results: Vec<ParsedTrace> = serde_json::from_str(&result_str).expect("deserialize");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].trace_id, "trace-1");
        assert!(results[0].span_tree.is_some());
    }

    #[test]
    fn test_parse_traces_invalid_json() {
        assert_eq!(parse_traces("bad json"), "[]");
    }

    #[test]
    fn test_remote_parent_root_still_builds_tree() {
        let trace = Trace {
            id: "trace-remote".to_string(),
            spans: vec![
                Span {
                    trace_id: "trace-remote".to_string(),
                    span_id: "root".to_string(),
                    parent_id: Some("remote-nonexistent".to_string()),
                    service_name: "gateway".to_string(),
                    operation_name: "synthetic_trace".to_string(),
                    start_time: 1000.0,
                    duration: 200.0,
                    attributes: HashMap::new(),
                    status: "OK".to_string(),
                },
                Span {
                    trace_id: "trace-remote".to_string(),
                    span_id: "child-1".to_string(),
                    parent_id: Some("root".to_string()),
                    service_name: "auth".to_string(),
                    operation_name: "verify".to_string(),
                    start_time: 1010.0,
                    duration: 50.0,
                    attributes: HashMap::new(),
                    status: "OK".to_string(),
                },
                Span {
                    trace_id: "trace-remote".to_string(),
                    span_id: "child-2".to_string(),
                    parent_id: Some("root".to_string()),
                    service_name: "db".to_string(),
                    operation_name: "query".to_string(),
                    start_time: 1020.0,
                    duration: 100.0,
                    attributes: HashMap::new(),
                    status: "OK".to_string(),
                },
            ],
        };
        let parsed = analyze_trace(&trace);
        let tree = parsed
            .span_tree
            .expect("should build span tree even with remote parent");
        assert_eq!(tree.span.span_id, "root");
        assert_eq!(tree.children.len(), 2);
    }
}

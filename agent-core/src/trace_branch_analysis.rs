use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use wasm_bindgen::prelude::*;

#[derive(Clone, Deserialize, Serialize)]
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
struct TraceInput {
    id: String,
    spans: Vec<Span>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ServiceNode {
    service_name: String,
    span_count: usize,
    error_count: usize,
    error_rate: f64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TraceBranch {
    #[serde(rename = "branchId")]
    id: String,
    trace_id: String,
    branch_index: usize,
    service_path: Vec<String>,
    span_ids: Vec<String>,
    total_cost: f64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct BranchLink {
    #[serde(rename = "branchId")]
    branch_id: String,
    trace_id: String,
    branch_index: usize,
    link_index: usize,
    link_key: String,
    source: String,
    target: String,
    occurrence_count: usize,
    link_cost: f64,
    occurrence_costs: Vec<f64>,
    occurrence_span_ids: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LinkCostComparison {
    source: String,
    target: String,
    link_key: String,
    rows: Vec<ComparisonRow>,
    spans: Vec<Span>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ComparisonRow {
    comparison: String,
    #[serde(rename = "branch")]
    branch: TraceBranch,
    link: BranchLink,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TraceBranchAnalysis {
    services: Vec<ServiceNode>,
    branches: Vec<TraceBranch>,
    links: Vec<BranchLink>,
}

struct TraceBranchStore {
    output: TraceBranchAnalysis,
    branch_index_by_id: HashMap<String, usize>,
    link_indices_by_key: HashMap<String, Vec<usize>>,
}

impl TraceBranchStore {
    fn new(output: TraceBranchAnalysis) -> Self {
        let mut branch_index_by_id = HashMap::new();
        for (index, branch) in output.branches.iter().enumerate() {
            branch_index_by_id.entry(branch.id.clone()).or_insert(index);
        }
        let mut link_indices_by_key: HashMap<String, Vec<usize>> = HashMap::new();
        for (index, link) in output.links.iter().enumerate() {
            link_indices_by_key
                .entry(link.link_key.clone())
                .or_default()
                .push(index);
        }

        Self {
            output,
            branch_index_by_id,
            link_indices_by_key,
        }
    }

    fn branch(&self, branch_id: &str) -> Option<&TraceBranch> {
        self.branch_index_by_id
            .get(branch_id)
            .and_then(|index| self.output.branches.get(*index))
    }

    fn links_for(&self, key: &str) -> Vec<&BranchLink> {
        self.link_indices_by_key
            .get(key)
            .into_iter()
            .flatten()
            .filter_map(|index| self.output.links.get(*index))
            .collect()
    }
}

#[derive(Clone)]
struct IndexedSpan {
    span: Span,
    children: Vec<usize>,
}

struct IndexedSpanForest {
    nodes: Vec<IndexedSpan>,
    roots: Vec<usize>,
}

fn link_key(source: &str, target: &str) -> String {
    format!("{source}->{target}")
}

fn stable_span_cmp(left: &IndexedSpan, right: &IndexedSpan) -> std::cmp::Ordering {
    left.span
        .start_time
        .partial_cmp(&right.span.start_time)
        .unwrap_or(std::cmp::Ordering::Equal)
        .then_with(|| left.span.span_id.cmp(&right.span.span_id))
}

fn build_span_forest(spans: &[Span]) -> IndexedSpanForest {
    let mut nodes: Vec<IndexedSpan> = spans
        .iter()
        .cloned()
        .map(|span| IndexedSpan {
            span,
            children: Vec::new(),
        })
        .collect();
    let id_to_idx: HashMap<&str, usize> = spans
        .iter()
        .enumerate()
        .map(|(idx, span)| (span.span_id.as_str(), idx))
        .collect();
    let mut roots = Vec::new();

    for (idx, span) in spans.iter().enumerate() {
        match span.parent_id.as_deref() {
            Some(parent_id) if !parent_id.is_empty() => {
                if let Some(parent_idx) = id_to_idx.get(parent_id) {
                    nodes[*parent_idx].children.push(idx);
                } else {
                    roots.push(idx);
                }
            }
            _ => roots.push(idx),
        }
    }

    for idx in 0..nodes.len() {
        let mut children = std::mem::take(&mut nodes[idx].children);
        children.sort_by(|left, right| stable_span_cmp(&nodes[*left], &nodes[*right]));
        nodes[idx].children = children;
    }
    roots.sort_by(|left, right| stable_span_cmp(&nodes[*left], &nodes[*right]));

    IndexedSpanForest { nodes, roots }
}

fn collect_paths(
    nodes: &[IndexedSpan],
    current: usize,
    path: &mut Vec<usize>,
    output: &mut Vec<Vec<usize>>,
) {
    path.push(current);
    if nodes[current].children.is_empty() {
        output.push(path.clone());
    } else {
        for child in &nodes[current].children {
            collect_paths(nodes, *child, path, output);
        }
    }
    path.pop();
}

#[allow(clippy::too_many_lines)]
fn analyze(traces: &[TraceInput]) -> TraceBranchStore {
    let mut service_stats: BTreeMap<String, (usize, usize)> = BTreeMap::new();
    let mut branches = Vec::new();
    let mut links = Vec::new();

    for trace in traces {
        let forest = build_span_forest(&trace.spans);
        for span in &trace.spans {
            let stats = service_stats
                .entry(span.service_name.clone())
                .or_insert((0, 0));
            stats.0 += 1;
            if span.status == "ERROR" {
                stats.1 += 1;
            }
        }

        let mut paths = Vec::new();
        for root in forest.roots {
            collect_paths(&forest.nodes, root, &mut Vec::new(), &mut paths);
        }

        for (branch_index, path) in paths.iter().enumerate() {
            let branch_id = format!("{}:branch:{branch_index}", trace.id);
            let mut service_path = Vec::new();
            let mut span_ids = Vec::new();
            let mut total_cost = 0.0;
            let mut link_costs = Vec::new();
            let mut link_index_by_key: HashMap<String, usize> = HashMap::new();

            for (position, node_idx) in path.iter().enumerate() {
                let span = &forest.nodes[*node_idx].span;
                span_ids.push(span.span_id.clone());
                total_cost += span.duration;
                if service_path.last() != Some(&span.service_name) {
                    service_path.push(span.service_name.clone());
                }

                if position == 0 {
                    continue;
                }

                let parent = &forest.nodes[path[position - 1]].span;
                if parent.service_name == span.service_name {
                    continue;
                }

                let key = link_key(&parent.service_name, &span.service_name);
                let link_position = if let Some(position) = link_index_by_key.get(&key) {
                    *position
                } else {
                    let position = link_costs.len();
                    link_index_by_key.insert(key.clone(), position);
                    link_costs.push(BranchLink {
                        branch_id: branch_id.clone(),
                        trace_id: trace.id.clone(),
                        branch_index,
                        link_index: position,
                        link_key: key,
                        source: parent.service_name.clone(),
                        target: span.service_name.clone(),
                        occurrence_count: 0,
                        link_cost: 0.0,
                        occurrence_costs: Vec::new(),
                        occurrence_span_ids: Vec::new(),
                    });
                    position
                };
                let entry = &mut link_costs[link_position];
                entry.occurrence_count += 1;
                entry.link_cost += span.duration;
                entry.occurrence_costs.push(span.duration);
                entry.occurrence_span_ids.push(span.span_id.clone());
            }

            branches.push(TraceBranch {
                id: branch_id,
                trace_id: trace.id.clone(),
                branch_index,
                service_path,
                span_ids,
                total_cost,
            });
            links.extend(link_costs);
        }
    }

    branches.sort_by(|left, right| left.id.cmp(&right.id));
    links.sort_by(|left, right| {
        left.branch_id
            .cmp(&right.branch_id)
            .then_with(|| left.link_index.cmp(&right.link_index))
    });

    let services = service_stats
        .into_iter()
        .map(|(service_name, (span_count, error_count))| ServiceNode {
            service_name,
            span_count,
            error_count,
            error_rate: if span_count == 0 {
                0.0
            } else {
                error_count as f64 / span_count as f64
            },
        })
        .collect();

    TraceBranchStore::new(TraceBranchAnalysis {
        services,
        branches,
        links,
    })
}

fn compare_link(traces: &[TraceInput], source: &str, target: &str) -> LinkCostComparison {
    let analysis = analyze(traces);
    let key = link_key(source, target);
    let matching = analysis.links_for(&key);

    let mut rows = Vec::new();
    if let Some(min_link) = matching.iter().min_by(|left, right| {
        left.link_cost
            .partial_cmp(&right.link_cost)
            .unwrap_or(std::cmp::Ordering::Equal)
    }) {
        if let Some(branch) = analysis.branch(&min_link.branch_id) {
            rows.push(ComparisonRow {
                comparison: "min".to_string(),
                branch: branch.clone(),
                link: (*min_link).clone(),
            });
        }
    }
    if let Some(max_link) = matching.iter().max_by(|left, right| {
        left.link_cost
            .partial_cmp(&right.link_cost)
            .unwrap_or(std::cmp::Ordering::Equal)
    }) {
        if let Some(branch) = analysis.branch(&max_link.branch_id) {
            rows.push(ComparisonRow {
                comparison: "max".to_string(),
                branch: branch.clone(),
                link: (*max_link).clone(),
            });
        }
    }

    let selected_span_ids: BTreeSet<&str> = rows
        .iter()
        .flat_map(|row| row.branch.span_ids.iter().map(String::as_str))
        .collect();
    let spans = traces
        .iter()
        .flat_map(|trace| trace.spans.iter())
        .filter(|span| selected_span_ids.contains(span.span_id.as_str()))
        .cloned()
        .collect();

    LinkCostComparison {
        source: source.to_string(),
        target: target.to_string(),
        link_key: key,
        rows,
        spans,
    }
}

/// WASM export: extract trace branches and reduced link costs.
#[wasm_bindgen]
pub fn extract_trace_branches(data: &str) -> String {
    let traces: Vec<TraceInput> = match serde_json::from_str(data) {
        Ok(value) => value,
        Err(error) => return format!(r#"{{"error":"{error}"}}"#),
    };

    match serde_json::to_string(&analyze(&traces).output) {
        Ok(value) => value,
        Err(error) => format!(r#"{{"error":"{error}"}}"#),
    }
}

/// WASM export: compare min and max branch-link cost for one directed service link.
#[wasm_bindgen]
pub fn compare_service_link_cost(data: &str, source: &str, target: &str) -> String {
    let traces: Vec<TraceInput> = match serde_json::from_str(data) {
        Ok(value) => value,
        Err(error) => return format!(r#"{{"error":"{error}"}}"#),
    };

    match serde_json::to_string(&compare_link(&traces, source, target)) {
        Ok(value) => value,
        Err(error) => format!(r#"{{"error":"{error}"}}"#),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};

    fn span(span_id: &str, parent_id: Option<&str>, service_name: &str, duration: f64) -> Span {
        span_for_trace("trace-1", span_id, parent_id, service_name, 0.0, duration)
    }

    fn span_for_trace(
        trace_id: &str,
        span_id: &str,
        parent_id: Option<&str>,
        service_name: &str,
        start_time: f64,
        duration: f64,
    ) -> Span {
        Span {
            trace_id: trace_id.to_string(),
            span_id: span_id.to_string(),
            parent_id: parent_id.map(str::to_string),
            service_name: service_name.to_string(),
            operation_name: span_id.to_string(),
            start_time,
            duration,
            attributes: HashMap::new(),
            status: "OK".to_string(),
        }
    }

    #[test]
    fn should_sum_repeated_directed_link_traversals_inside_branch() {
        let traces = vec![TraceInput {
            id: "trace-1".to_string(),
            spans: vec![
                span("root", None, "gateway", 1.0),
                span("a1", Some("root"), "A", 1.0),
                span("b1", Some("a1"), "B", 20.0),
                span("a2", Some("b1"), "A", 1.0),
                span("b2", Some("a2"), "B", 140.0),
            ],
        }];

        let analysis = analyze(&traces);
        let link = analysis
            .output
            .links
            .iter()
            .find(|link| link.link_key == "A->B")
            .expect("A->B link should exist");

        assert_eq!(link.occurrence_count, 2);
        assert_eq!(link.link_index, 1);
        assert_eq!(link.link_cost, 160.0);
        assert_eq!(link.occurrence_costs, vec![20.0, 140.0]);
    }

    #[test]
    fn should_reduce_opposite_directions_separately() {
        let traces = vec![TraceInput {
            id: "trace-1".to_string(),
            spans: vec![
                span("root", None, "gateway", 1.0),
                span("a", Some("root"), "A", 1.0),
                span("b", Some("a"), "B", 40.0),
                span("a-back", Some("b"), "A", 70.0),
            ],
        }];

        let analysis = analyze(&traces);
        let forward = analysis
            .output
            .links
            .iter()
            .find(|link| link.link_key == "A->B")
            .expect("A->B link should exist");
        let reverse = analysis
            .output
            .links
            .iter()
            .find(|link| link.link_key == "B->A")
            .expect("B->A link should exist");

        assert_eq!(forward.link_cost, 40.0);
        assert_eq!(reverse.link_cost, 70.0);
    }

    #[test]
    fn should_preserve_link_order_inside_branch() {
        let traces = vec![TraceInput {
            id: "trace-1".to_string(),
            spans: vec![
                span("root", None, "gateway", 1.0),
                span("orders", Some("root"), "orders", 20.0),
                span("payments", Some("orders"), "payments", 30.0),
                span("db", Some("payments"), "database", 40.0),
            ],
        }];

        let analysis = analyze(&traces);
        let ordered_link_keys: Vec<&str> = analysis
            .output
            .links
            .iter()
            .map(|link| link.link_key.as_str())
            .collect();
        let link_indices: Vec<usize> = analysis
            .output
            .links
            .iter()
            .map(|link| link.link_index)
            .collect();

        assert_eq!(
            ordered_link_keys,
            vec!["gateway->orders", "orders->payments", "payments->database"]
        );
        assert_eq!(link_indices, vec![0, 1, 2]);
    }

    #[test]
    fn should_preserve_trace_branch_json_contract() {
        let mut orders = span("orders", Some("root"), "orders", 20.0);
        orders.status = "ERROR".to_string();
        let traces = vec![TraceInput {
            id: "trace-1".to_string(),
            spans: vec![span("root", None, "gateway", 1.0), orders],
        }];
        let input = serde_json::to_string(&traces).expect("test trace should serialize");
        let actual: Value = serde_json::from_str(&extract_trace_branches(&input))
            .expect("analysis output should be valid JSON");

        assert_eq!(
            actual,
            json!({
                "services": [
                    {
                        "serviceName": "gateway",
                        "spanCount": 1,
                        "errorCount": 0,
                        "errorRate": 0.0
                    },
                    {
                        "serviceName": "orders",
                        "spanCount": 1,
                        "errorCount": 1,
                        "errorRate": 1.0
                    }
                ],
                "branches": [{
                    "branchId": "trace-1:branch:0",
                    "traceId": "trace-1",
                    "branchIndex": 0,
                    "servicePath": ["gateway", "orders"],
                    "spanIds": ["root", "orders"],
                    "totalCost": 21.0
                }],
                "links": [{
                    "branchId": "trace-1:branch:0",
                    "traceId": "trace-1",
                    "branchIndex": 0,
                    "linkIndex": 0,
                    "linkKey": "gateway->orders",
                    "source": "gateway",
                    "target": "orders",
                    "occurrenceCount": 1,
                    "linkCost": 20.0,
                    "occurrenceCosts": [20.0],
                    "occurrenceSpanIds": ["orders"]
                }]
            })
        );
    }

    #[test]
    fn should_preserve_link_comparison_json_contract() {
        let traces = vec![
            TraceInput {
                id: "trace-min".to_string(),
                spans: vec![
                    span_for_trace("trace-min", "root-min", None, "A", 0.0, 1.0),
                    span_for_trace("trace-min", "child-min", Some("root-min"), "B", 1.0, 20.0),
                ],
            },
            TraceInput {
                id: "trace-max".to_string(),
                spans: vec![
                    span_for_trace("trace-max", "root-max", None, "A", 0.0, 1.0),
                    span_for_trace("trace-max", "child-max", Some("root-max"), "B", 1.0, 80.0),
                ],
            },
        ];
        let input = serde_json::to_string(&traces).expect("test traces should serialize");
        let actual: Value = serde_json::from_str(&compare_service_link_cost(&input, "A", "B"))
            .expect("comparison output should be valid JSON");

        assert_eq!(
            actual,
            json!({
                "source": "A",
                "target": "B",
                "linkKey": "A->B",
                "rows": [
                    {
                        "comparison": "min",
                        "branch": {
                            "branchId": "trace-min:branch:0",
                            "traceId": "trace-min",
                            "branchIndex": 0,
                            "servicePath": ["A", "B"],
                            "spanIds": ["root-min", "child-min"],
                            "totalCost": 21.0
                        },
                        "link": {
                            "branchId": "trace-min:branch:0",
                            "traceId": "trace-min",
                            "branchIndex": 0,
                            "linkIndex": 0,
                            "linkKey": "A->B",
                            "source": "A",
                            "target": "B",
                            "occurrenceCount": 1,
                            "linkCost": 20.0,
                            "occurrenceCosts": [20.0],
                            "occurrenceSpanIds": ["child-min"]
                        }
                    },
                    {
                        "comparison": "max",
                        "branch": {
                            "branchId": "trace-max:branch:0",
                            "traceId": "trace-max",
                            "branchIndex": 0,
                            "servicePath": ["A", "B"],
                            "spanIds": ["root-max", "child-max"],
                            "totalCost": 81.0
                        },
                        "link": {
                            "branchId": "trace-max:branch:0",
                            "traceId": "trace-max",
                            "branchIndex": 0,
                            "linkIndex": 0,
                            "linkKey": "A->B",
                            "source": "A",
                            "target": "B",
                            "occurrenceCount": 1,
                            "linkCost": 80.0,
                            "occurrenceCosts": [80.0],
                            "occurrenceSpanIds": ["child-max"]
                        }
                    }
                ],
                "spans": [
                    {
                        "traceId": "trace-min",
                        "spanId": "root-min",
                        "parentId": null,
                        "serviceName": "A",
                        "operationName": "root-min",
                        "startTime": 0.0,
                        "duration": 1.0,
                        "attributes": {},
                        "status": "OK"
                    },
                    {
                        "traceId": "trace-min",
                        "spanId": "child-min",
                        "parentId": "root-min",
                        "serviceName": "B",
                        "operationName": "child-min",
                        "startTime": 1.0,
                        "duration": 20.0,
                        "attributes": {},
                        "status": "OK"
                    },
                    {
                        "traceId": "trace-max",
                        "spanId": "root-max",
                        "parentId": null,
                        "serviceName": "A",
                        "operationName": "root-max",
                        "startTime": 0.0,
                        "duration": 1.0,
                        "attributes": {},
                        "status": "OK"
                    },
                    {
                        "traceId": "trace-max",
                        "spanId": "child-max",
                        "parentId": "root-max",
                        "serviceName": "B",
                        "operationName": "child-max",
                        "startTime": 1.0,
                        "duration": 80.0,
                        "attributes": {},
                        "status": "OK"
                    }
                ]
            })
        );
    }

    #[test]
    fn should_preserve_shared_prefix_accounting_per_branch() {
        let traces = vec![TraceInput {
            id: "trace-1".to_string(),
            spans: vec![
                span("root", None, "gateway", 1.0),
                span("orders", Some("root"), "orders", 10.0),
                span("database", Some("orders"), "database", 20.0),
                span("cache", Some("orders"), "cache", 5.0),
            ],
        }];
        let analysis = analyze(&traces);
        let shared_links: Vec<&BranchLink> = analysis
            .output
            .links
            .iter()
            .filter(|link| link.link_key == "gateway->orders")
            .collect();

        assert_eq!(analysis.output.branches.len(), 2);
        assert_eq!(shared_links.len(), 2);
        assert!(shared_links.iter().all(|link| link.link_cost == 10.0));
    }

    #[test]
    fn should_collapse_same_service_spans_without_self_links() {
        let traces = vec![TraceInput {
            id: "trace-1".to_string(),
            spans: vec![
                span("root", None, "gateway", 1.0),
                span("internal", Some("root"), "gateway", 2.0),
                span("orders", Some("internal"), "orders", 3.0),
            ],
        }];
        let analysis = analyze(&traces);

        assert_eq!(
            analysis.output.branches[0].service_path,
            vec!["gateway", "orders"]
        );
        assert_eq!(analysis.output.links.len(), 1);
        assert_eq!(analysis.output.links[0].link_key, "gateway->orders");
    }

    #[test]
    fn should_return_empty_analysis_for_empty_input() {
        let actual: Value = serde_json::from_str(&extract_trace_branches("[]"))
            .expect("empty analysis should be valid JSON");

        assert_eq!(
            actual,
            json!({ "services": [], "branches": [], "links": [] })
        );
    }

    #[test]
    fn should_return_explicit_error_for_malformed_input() {
        let actual: Value = serde_json::from_str(&extract_trace_branches("{"))
            .expect("error response should be valid JSON");

        assert!(actual["error"]
            .as_str()
            .is_some_and(|error| !error.is_empty()));
    }

    #[test]
    fn should_assign_deterministic_branch_order() {
        let traces = vec![TraceInput {
            id: "trace-1".to_string(),
            spans: vec![
                span_for_trace("trace-1", "root", None, "gateway", 0.0, 1.0),
                span_for_trace("trace-1", "later", Some("root"), "later", 20.0, 2.0),
                span_for_trace("trace-1", "earlier", Some("root"), "earlier", 10.0, 3.0),
            ],
        }];
        let first = extract_trace_branches(
            &serde_json::to_string(&traces).expect("test trace should serialize"),
        );
        let second = extract_trace_branches(
            &serde_json::to_string(&traces).expect("test trace should serialize"),
        );
        let analysis = analyze(&traces);

        assert_eq!(first, second);
        assert_eq!(
            analysis.output.branches[0].service_path,
            vec!["gateway", "earlier"]
        );
        assert_eq!(
            analysis.output.branches[1].service_path,
            vec!["gateway", "later"]
        );
    }
}

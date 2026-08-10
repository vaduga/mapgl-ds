use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use wasm_bindgen::prelude::*;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(clippy::struct_field_names)]
struct Span {
    service_name: String,
    parent_id: Option<String>,
    span_id: String,
    #[serde(default)]
    #[allow(dead_code)]
    duration: f64,
}

#[derive(Deserialize)]
struct TraceInput {
    spans: Vec<Span>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ServiceGraph {
    services: Vec<String>,
    edges: Vec<ServiceEdge>,
}

#[derive(Serialize, Deserialize, Eq, PartialEq, Hash, Clone)]
struct ServiceEdge {
    from: String,
    to: String,
}

/// WASM export: extract service graph from traces.
/// Input: JSON array of `{ spans: [...] }`.
/// Output: `{ services: [...], edges: [...] }`.
#[wasm_bindgen]
pub fn extract_service_graph(data: &str) -> String {
    let traces: Vec<TraceInput> = match serde_json::from_str(data) {
        Ok(v) => v,
        Err(_) => return String::from(r#"{"services":[],"edges":[]}"#),
    };

    let mut all_services: HashSet<String> = HashSet::new();
    let mut all_edges: HashSet<ServiceEdge> = HashSet::new();

    for trace in &traces {
        let span_map: HashMap<&str, &Span> = trace
            .spans
            .iter()
            .map(|s| (s.span_id.as_str(), s))
            .collect();

        for span in &trace.spans {
            all_services.insert(span.service_name.clone());
            if let Some(pid) = &span.parent_id {
                if let Some(parent) = span_map.get(pid.as_str()) {
                    if parent.service_name != span.service_name {
                        all_edges.insert(ServiceEdge {
                            from: parent.service_name.clone(),
                            to: span.service_name.clone(),
                        });
                    }
                }
            }
        }
    }

    let graph = ServiceGraph {
        services: all_services.into_iter().collect(),
        edges: all_edges.into_iter().collect(),
    };

    serde_json::to_string(&graph).unwrap_or_else(|_| String::from(r#"{"services":[],"edges":[]}"#))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_cross_service_edges() {
        let input = r#"[{"spans":[
            {"spanId":"s1","parentId":null,"serviceName":"gateway","duration":100},
            {"spanId":"s2","parentId":"s1","serviceName":"auth","duration":50},
            {"spanId":"s3","parentId":"s1","serviceName":"gateway","duration":30}
        ]}]"#;
        let result_str = extract_service_graph(input);
        let graph: ServiceGraph = serde_json::from_str(&result_str).expect("parse");
        assert!(graph.services.contains(&"gateway".to_string()));
        assert!(graph.services.contains(&"auth".to_string()));
        // edge: gateway → auth
        assert!(graph
            .edges
            .iter()
            .any(|e| e.from == "gateway" && e.to == "auth"));
        // no self-edge for gateway
        assert!(!graph
            .edges
            .iter()
            .any(|e| e.from == "gateway" && e.to == "gateway"));
    }

    #[test]
    fn test_extract_empty_input() {
        let result = extract_service_graph("[]");
        assert!(result.contains("services"));
    }
}

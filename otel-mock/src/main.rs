// @managed by create-grafana-plugin — do not edit
//! Mock telemetry data generator for the Tempo datasource.
//!
//! Generates high-fidelity synthetic data:
//! - Multi-service distributed traces (OTLP → Tempo) with rich semantic attributes,
//!   intermittent errors, and latency outliers

mod graph;

use std::time::Duration;

use async_recursion::async_recursion;
use graph::{Hop, ServiceCallGraph, Severity, TracePlan};
use opentelemetry::global;
use opentelemetry::trace::{
    SpanContext, SpanId, TraceContextExt, TraceFlags, TraceId, TraceState, TracerProvider as _,
};
use opentelemetry::KeyValue;
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::trace::{RandomIdGenerator, TracerProvider};
use opentelemetry_sdk::Resource;
use rand::rngs::StdRng;
use rand::{Rng, SeedableRng};
use tokio::time::interval;
use tracing::{info, warn, Instrument};
use tracing_opentelemetry::OpenTelemetrySpanExt;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::EnvFilter;

#[derive(Debug)]
struct Config {
    otlp_endpoint: String,
    tick_ms: u64,
}

impl Config {
    fn from_env() -> Self {
        Self {
            otlp_endpoint: std::env::var("OTEL_EXPORTER_OTLP_ENDPOINT")
                .unwrap_or_else(|_| "http://tempo:4317".into()),
            tick_ms: std::env::var("OTEL_MOCK_TICK_MS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(4000),
        }
    }
}

fn init_tracer(otlp_endpoint: &str) -> Result<TracerProvider, opentelemetry::trace::TraceError> {
    let exporter = opentelemetry_otlp::SpanExporter::builder()
        .with_tonic()
        .with_endpoint(otlp_endpoint.to_string())
        .build()?;

    let resource = Resource::new(vec![
        KeyValue::new("service.name", "otel-mock"),
        KeyValue::new("service.version", env!("CARGO_PKG_VERSION")),
    ]);

    Ok(TracerProvider::builder()
        .with_batch_exporter(exporter, opentelemetry_sdk::runtime::Tokio)
        .with_resource(resource)
        .with_id_generator(RandomIdGenerator::default())
        .build())
}

/// Emits a chain of nested child spans with rich OTel semantic attributes.
#[async_recursion]
async fn emit_hops(chain: &[Hop], sleep_ms: &[u64], idx: usize, parent: tracing::Span) {
    if idx >= chain.len() {
        return;
    }
    let hop = &chain[idx];
    let hop_ms = sleep_ms.get(idx).copied().unwrap_or(0);

    let span = tracing::info_span!(
        parent: parent,
        "service_hop",
        "service.name" = hop.service,
        "otel.name" = hop.operation.as_str(),
        "peer.service" = hop.service,
        "severity" = hop.severity.as_str(),
        "rpc.system" = "grpc",
        "otel.status_code" = match hop.severity {
            Severity::Error => "ERROR",
            _ => "OK",
        },
        "http.method" = tracing::field::Empty,
        "http.route" = tracing::field::Empty,
        "http.status_code" = tracing::field::Empty,
        "db.system" = tracing::field::Empty,
        "db.statement" = tracing::field::Empty,
        "rpc.service" = tracing::field::Empty,
        "rpc.method" = tracing::field::Empty,
        "error.message" = tracing::field::Empty,
    );

    if let Some(m) = hop.attrs.http_method {
        span.record("http.method", m);
    }
    if let Some(ref r) = hop.attrs.http_route {
        span.record("http.route", r.as_str());
    }
    if let Some(c) = hop.attrs.http_status_code {
        span.record("http.status_code", i64::from(c));
    }
    if let Some(d) = hop.attrs.db_system {
        span.record("db.system", d);
    }
    if let Some(ref s) = hop.attrs.db_statement {
        span.record("db.statement", s.as_str());
    }
    if let Some(ref s) = hop.attrs.rpc_service {
        span.record("rpc.service", s.as_str());
    }
    if let Some(ref m) = hop.attrs.rpc_method {
        span.record("rpc.method", m.as_str());
    }
    if let Some(ref e) = hop.attrs.error_message {
        span.record("error.message", e.as_str());
    }

    let child = span.clone();
    let _e = span.enter();
    tokio::time::sleep(Duration::from_millis(hop_ms)).await;
    emit_hops(chain, sleep_ms, idx + 1, child).await;
}

async fn emit_trace(plan: &TracePlan) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let trace_id = TraceId::from_bytes(rand::thread_rng().gen());
    let span_id = SpanId::from_bytes(rand::thread_rng().gen());
    let parent_cx = opentelemetry::Context::default().with_remote_span_context(SpanContext::new(
        trace_id,
        span_id,
        TraceFlags::SAMPLED,
        true,
        TraceState::default(),
    ));

    let root = tracing::info_span!("synthetic_trace", "otel.name" = "synthetic_trace");
    root.set_parent(parent_cx);
    async {
        emit_hops(&plan.chain, &plan.hop_sleep_ms, 0, tracing::Span::current()).await;
    }
    .instrument(root)
    .await;

    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let config = Config::from_env();
    let provider = init_tracer(&config.otlp_endpoint)?;
    let tracer = provider.tracer("otel-mock");
    global::set_tracer_provider(provider.clone());

    tracing_subscriber::registry()
        .with(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info,tokio=warn")),
        )
        .with(tracing_subscriber::fmt::layer())
        .with(tracing_opentelemetry::layer().with_tracer(tracer))
        .init();

    let mut rng = StdRng::from_entropy();
    let graph = ServiceCallGraph::new(&mut rng);
    info!(
        error_rate = format!("{:.0}%", graph.error_rate() * 100.0),
        tick_ms = config.tick_ms,
        "Starting mock data generation loop"
    );

    let mut tick = interval(Duration::from_millis(config.tick_ms));

    loop {
        tokio::select! {
            _ = tokio::signal::ctrl_c() => {
                info!("shutting down");
                if let Err(e) = provider.shutdown() {
                    warn!(error = %e, "tracer provider shutdown");
                }
                break;
            }
            _ = tick.tick() => {
                let plan = graph.sample_trace(&mut rng);
                info!(
                    has_error = plan.has_error,
                    total_duration_ms = plan.total_duration_ms,
                    hop_count = plan.chain.len(),
                    "emitting synthetic trace"
                );
                if let Err(e) = emit_trace(&plan).await {
                    warn!(error = %e, "emit tick failed");
                }
            }
        }
    }

    Ok(())
}

# Grafana reviewer instructions

These steps exercise `vaduga-mapgl-datasource` (`vaduga-mapgl-datasource`, version `0.1.0`) with the provisioned Grafana and Tempo demo.

## Prerequisites

- Docker Engine with Docker Compose v2
- Node.js 20 or newer with npm
- Rust stable installed through [rustup](https://rustup.rs/); the default Rust toolchain installed by `rustup` includes both `rustc` and `cargo`
- Network access for the initial npm and Docker image/plugin downloads
- Ports `3000`, `3200`, and `4317` available

`wasm-pack` does not need to be installed separately: `npm run setup` installs it and the required Rust/WASM target.

Verify the Rust tools are available before continuing:

```bash
rustup --version
rustc --version
cargo --version
```

## Review the plugin

1. Check out the commit or tag under review:

   ```bash
   git clone https://github.com/vaduga/mapgl-ds.git
   cd mapgl-ds
   # Optional: pin the exact revision supplied for review.
   git checkout <commit-or-tag>
   ```

2. Install the toolchain and dependencies, then build the WASM bridge and frontend:

   ```bash
   npm run setup
   npm run build
   ```

3. Start the provisioned Grafana, Tempo, and synthetic trace generator:

   ```bash
   docker compose up -d --build
   docker compose ps
   curl http://localhost:3000/api/health
   ```

4. Open <http://localhost:3000>. Anonymous access is enabled for this demo, so no login is required.

5. Wait at least 10 seconds for the `otel-mock` service to send traces. Then review the provisioned **Mapgl Service graph** dashboard. It should show service nodes and directed edges populated from Tempo.

6. In **Connections → Data sources**, open **Mapgl Tempo DataFrames**. Confirm the URL is `http://tempo:3200`, select **Save & test**, and verify that the Tempo search endpoint is reachable.

7. In **Explore**, select **Mapgl Tempo DataFrames** and run a query. Check the **Service graph**, **Trace branches**, and **Links comparison** query modes, including the optional TraceQL and trace ID fields.

The dashboard uses the optional `vaduga-mapgl-panel` plugin. If that panel cannot be downloaded in the review environment, the datasource can still be reviewed through its configuration page and Explore.

## Automated checks

From the repository root:

```bash
npm run verify
npm run build:webpack
npm run e2e
```

The E2E checks require the Docker stack and a Chromium browser. Install Chromium once if needed with `npx playwright install chromium`.

## Cleanup

Stop the services while retaining Grafana and Tempo data:

```bash
docker compose down
```

To remove the persisted demo data as well:

```bash
docker compose down -v
```

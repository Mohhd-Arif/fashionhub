# Codebase Knowledge Graph

This repository uses `codebase-memory-mcp` for code discovery and impact analysis.

Use the graph tools in this order:

1. `search_graph` to find functions, components, routes, classes, and variables.
2. `trace_path` to inspect callers, dependencies, and data flow.
3. `get_code_snippet` to read a specific symbol after finding its qualified name.
4. `search_code` for graph-enriched text searches.
5. `query_graph` for complex structural questions.
6. `get_architecture` for a high-level overview.

Run `index_repository` for the repository root after meaningful code changes or when the graph is stale. Use full mode with persistence when available.

Use normal text/file search only for configuration files, literal messages, generated assets, or when the graph does not contain enough information.

Generated directories such as `node_modules`, `FHUB_ui/dist`, and `FHUB_be/dist` must stay outside the index.

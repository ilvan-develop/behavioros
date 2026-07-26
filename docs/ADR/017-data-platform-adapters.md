# ADR-017: Data Platform Adapters

**Status:** Accepted  
**Date:** 2026-07-21  
**Deciders:** BehaviorOS Architecture Team  

---

## Context

Storage requirements vary dramatically across deployments: time-series analytics, relational transactions, vector embeddings, search indexing, stream processing, object storage, and data warehousing. A one-size-fits-all storage solution is impossible.

## Decision

We define a `DataProvider` interface with adapters for each storage type:

```typescript
interface DataProvider {
  read(query: DataQuery): Promise<DataResult>
  write(data: DataWrite): Promise<WriteResult>
  stream(topic: string): Stream<DataEvent>
  health(): Promise<HealthStatus>
}
```

Supported adapters:
1. **ClickHouse** — Time-series and analytics
2. **PostgreSQL** — Relational transactions
3. **Redis** — Caching and real-time
4. **Milvus** — Vector similarity search
5. **Qdrant** — Vector similarity search (alternative)
6. **Kafka** — Event streaming
7. **S3** — Object storage
8. **Snowflake** — Cloud data warehouse

## Consequences

### Positive

- Flexible storage architecture per use case
- No vendor lock-in — swap providers via configuration
- Unified query interface for application code
- Polyglot persistence without polyglot application code

### Negative

- Increased operational complexity running multiple stores
- Query capability limitations from generic interface
- Cross-store joins require application-level logic

### Risks

- Performance mismatch between stores (mitigated by store-specific optimizations behind interface)
- Data consistency across stores (mitigated by event-driven synchronization)

---

*ADR-017: Data Platform Adapters — Accepted 2026-07-21*

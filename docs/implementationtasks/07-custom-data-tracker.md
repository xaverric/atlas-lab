# 07 — Custom Data Tracker

## Current State

No data tracker service exists yet. This is a brand new service.

## Goals

Build a dynamic REST API service where users can define custom endpoints via configuration. Each endpoint accepts structured JSON data, stores it in MongoDB, and provides visualization dashboards. Think of it as a lightweight, self-hosted version of a custom metrics/data collection platform.

### Business Case

- Track arbitrary data over time (fitness metrics, server stats, sensor readings, finances)
- POST data from scripts, cron jobs, IoT devices, or manual entry
- Visualize collected data with tables, charts, and filters
- Public endpoints for external data sources that can't authenticate
- Private endpoints for sensitive personal data

## Architecture

### New Service: `atlas-tracker`

Port 4006, package `@atlas/tracker`.

```
apps/atlas-tracker/
  src/
    config/index.ts
    models/
      TrackerEndpoint.ts       — endpoint definition (schema, name, visibility)
      TrackerEntry.ts          — not a fixed model — dynamic collections
    controllers/
      endpointController.ts    — CRUD for endpoint definitions
      dataController.ts        — receive + query data
    services/
      endpointService.ts       — manage endpoint lifecycle
      dataService.ts           — store + query data, manage dynamic collections
      schemaValidator.ts       — validate incoming data against endpoint schema
    daos/
      endpointDao.ts
      dynamicDao.ts            — generic DAO for dynamic collections
    routes/
      index.ts
      endpoint.ts              — manage endpoints
      data.ts                  — submit + query data
      public.ts                — public endpoint access
      health.ts
    middleware/
      auth.ts
    index.ts
  tsconfig.json
  package.json
```

### Endpoint Definition Model

`TrackerEndpoint`:
```
{
  name: string,              // unique, URL-friendly slug (e.g., "weight-tracker")
  displayName: string,       // human-readable name
  description: string,
  userId: string,            // owner
  visibility: 'private' | 'public',   // public = no auth required
  schema: {                  // JSON Schema for validation
    type: 'object',
    properties: {
      weight: { type: 'number', minimum: 0 },
      date: { type: 'string', format: 'date' },
      notes: { type: 'string' }
    },
    required: ['weight', 'date']
  },
  indexes: [                 // custom indexes for fast queries
    { fields: { date: -1 }, options: { unique: false } },
    { fields: { 'data.category': 1 } }
  ],
  retentionDays: number,     // optional — auto-delete old entries
  createdAt: Date,
  updatedAt: Date
}
```

**Collection naming:** Each endpoint stores data in its own MongoDB collection: `tracker_{userId}_{endpointName}`. This keeps data isolated and allows per-endpoint indexing.

### Data Entry Schema

Each entry in a dynamic collection:
```
{
  _id: ObjectId,
  data: { ... },           // the actual payload, validated against endpoint schema
  metadata: {
    source: string,        // 'api', 'gui', 'import'
    ip: string,            // requester IP (for public endpoints)
    userAgent: string
  },
  createdAt: Date
}
```

### API Design

#### Endpoint Management (authenticated)
```
POST   /api/v1/tracker/endpoints              — create endpoint definition
GET    /api/v1/tracker/endpoints              — list user's endpoints
GET    /api/v1/tracker/endpoints/:name        — get endpoint details + schema
PUT    /api/v1/tracker/endpoints/:name        — update endpoint config
DELETE /api/v1/tracker/endpoints/:name        — delete endpoint + its data
```

#### Data Submission
```
POST   /api/v1/tracker/endpoints/:name/data   — submit data (auth if private)
GET    /api/v1/tracker/endpoints/:name/data   — query data with filters
DELETE /api/v1/tracker/endpoints/:name/data/:id — delete single entry
```

#### Public Endpoints (no auth)
```
POST   /api/v1/tracker/public/:name/data      — submit data to public endpoint
GET    /api/v1/tracker/public/:name/data      — query public endpoint data
GET    /api/v1/tracker/public/:name           — public endpoint detail (schema + data)
```

#### Query Parameters for Data Retrieval
```
GET /api/v1/tracker/endpoints/:name/data
  ?from=2024-01-01              — filter by createdAt >= from
  &to=2024-12-31                — filter by createdAt <= to
  &sort=createdAt:desc          — sort by field
  &limit=100                    — pagination limit
  &offset=0                     — pagination offset
  &filter[data.category]=health — filter by data field value
  &filter[data.weight][$gte]=70 — MongoDB-style operators
```

### Dynamic Collection Management

`apps/atlas-tracker/src/services/dataService.ts`:
```
class DataService {
  private getCollectionName(userId: string, endpointName: string): string {
    return `tracker_${userId}_${endpointName}`;
  }

  async createCollection(endpoint: TrackerEndpoint): Promise<void> {
    const db = mongoose.connection.db;
    const collName = this.getCollectionName(endpoint.userId, endpoint.name);

    // Create collection
    await db.createCollection(collName);

    // Create indexes
    const collection = db.collection(collName);
    await collection.createIndex({ createdAt: -1 });  // always index by time

    for (const idx of endpoint.indexes || []) {
      await collection.createIndex(idx.fields, idx.options || {});
    }
  }

  async insertData(endpoint: TrackerEndpoint, data: object, metadata: object): Promise<void> {
    const collName = this.getCollectionName(endpoint.userId, endpoint.name);
    const collection = mongoose.connection.db.collection(collName);

    await collection.insertOne({
      data,
      metadata,
      createdAt: new Date()
    });
  }

  async queryData(endpoint: TrackerEndpoint, filters: QueryFilters): Promise<any[]> {
    const collName = this.getCollectionName(endpoint.userId, endpoint.name);
    const collection = mongoose.connection.db.collection(collName);

    const query = this.buildMongoQuery(filters);
    const sort = this.buildSort(filters.sort);

    return collection
      .find(query)
      .sort(sort)
      .skip(filters.offset || 0)
      .limit(filters.limit || 100)
      .toArray();
  }
}
```

### Schema Validation

`apps/atlas-tracker/src/services/schemaValidator.ts`:

Use `ajv` (Another JSON Schema Validator) for validating incoming data against endpoint schemas.

```
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

class SchemaValidator {
  private validators = new Map<string, ValidateFunction>();

  compile(endpointName: string, schema: object): void {
    this.validators.set(endpointName, ajv.compile(schema));
  }

  validate(endpointName: string, data: object): { valid: boolean; errors?: string[] } {
    const validate = this.validators.get(endpointName);
    if (!validate) throw new ApiError(500, 'Schema not compiled');

    const valid = validate(data);
    return {
      valid: !!valid,
      errors: validate.errors?.map(e => `${e.instancePath} ${e.message}`)
    };
  }
}
```

**Package:** `npm install ajv ajv-formats -w @atlas/tracker`

### Public Endpoint Security

When endpoint is public:
- No JWT required
- Rate limiting (per IP): 60 requests/minute
- Response on error: generic 400 with no details (no schema leak)
- No CORS restrictions (allow any origin)
- Request size limit: 10KB
- Log source IP for auditing

When endpoint is private:
- Standard JWT auth via Keycloak
- Full error details in response
- Standard rate limiting

### GUI

#### Endpoint Management Page

`apps/atlas-gui/src/app/(protected)/tracker/page.tsx`:
- List of user's endpoints with status, entry count, last data point
- Create new endpoint button → form with name, schema editor, visibility toggle

`apps/atlas-gui/src/app/(protected)/tracker/[name]/page.tsx`:
- Endpoint detail page
- Tabs: Data | Settings | Schema | API Info

#### Data Visualization

`apps/atlas-gui/src/app/(protected)/tracker/[name]/page.tsx` (Data tab):
- Table view: sortable, filterable columns based on endpoint schema
- Chart view (future): line chart for time-series data, bar chart for categories
- Date range picker for filtering
- Export to CSV/JSON
- Manual data entry form (based on schema)

#### Public Endpoint Page

`apps/atlas-gui/src/app/public/tracker/[name]/page.tsx`:
- Standalone page without app shell
- Shows endpoint name, description
- Data table (read-only)
- No links to authenticated areas
- Clean, minimal design

#### Schema Editor Component

`apps/atlas-gui/src/components/tracker/schema-editor.tsx`:
- Visual JSON Schema builder
- Add/remove fields
- Set field types (string, number, boolean, date)
- Set validation rules (required, min, max, pattern)
- Preview of generated JSON Schema
- Or: raw JSON Schema editor with syntax highlighting (simpler to implement first)

### Infrastructure

**Docker compose:**
```yaml
atlas-tracker:
  build: ./apps/atlas-tracker
  ports:
    - "4006:4006"
  environment:
    - MONGODB_URI=mongodb://mongo:27017/atlas-tracker
    - PORT=4006
  labels:
    - traefik.enable=true
    - traefik.http.routers.tracker.rule=Host(`tracker.${ATLAS_DOMAIN}`)
```

**GUI routing:**
```
if (path.startsWith('/api/v1/tracker')) return TRACKER_URL;
```

## Implementation Order

1. **Endpoint CRUD** — model, API, basic management
2. **Dynamic collections** — create/drop collections, indexing
3. **Data submission + validation** — POST data, schema validation with ajv
4. **Data querying** — GET with filters, sorting, pagination
5. **Public endpoints** — unauthenticated access, rate limiting
6. **GUI — endpoint management** — list, create, configure
7. **GUI — data table** — view data with sorting/filtering
8. **GUI — public page** — standalone data view
9. **GUI — schema editor** — visual schema builder (or raw JSON first)
10. **Charts** — time-series visualization (future enhancement)

## Dependencies

- MongoDB (already available)
- No Redis needed
- `ajv` + `ajv-formats` packages
- Public endpoints: rate limiting middleware (e.g., `express-rate-limit`)
- GUI routing in atlas-gui `lib/api.ts`

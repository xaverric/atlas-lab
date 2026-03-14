# atlas-dms (@atlas/dms)

Document Management Service. Upload, store, manage, and share files with presigned URLs via MinIO (S3-compatible).

## Port: 4001

## Architecture

```
Route → Controller → Service → DAO → Model
                         ↓
                   storageService (MinIO via @aws-sdk/client-s3)
```

## API Endpoints

### Documents (all require auth)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/dms/documents` | Upload file (multipart/form-data) |
| GET | `/api/v1/dms/documents` | List documents (paginated, filterable by tags) |
| GET | `/api/v1/dms/documents/:id` | Get document metadata |
| DELETE | `/api/v1/dms/documents/:id` | Delete document (removes from MinIO + DB) |
| GET | `/api/v1/dms/documents/:id/download` | Get presigned download URL (5min TTL) |

### Upload

```bash
curl -X POST http://localhost:4001/api/v1/dms/documents \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@document.pdf" \
  -F "name=My Document" \
  -F 'tags=["invoice","2024"]'
```

- Max file size: 50MB
- File stored in MinIO bucket `atlas-dms`
- Storage key format: `{timestamp}-{uuid}-{originalFilename}`

### Query Parameters (list)

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max 100) |
| `tags` | string | — | Comma-separated tag filter |

### Shares

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/dms/shares` | Yes | Create share token |
| GET | `/api/v1/dms/shares/:token` | No | Resolve share → presigned URL |
| DELETE | `/api/v1/dms/shares/:id` | Yes | Revoke share token |

### Share Token Flow

1. Owner creates share: `POST /shares { documentId, expiresInHours: 24, maxDownloads: 1 }`
2. Returns token (32 bytes, base64url encoded)
3. Anyone with the token: `GET /shares/:token` → gets presigned MinIO download URL
4. Download count increments on each resolve
5. Token auto-expires via MongoDB TTL index on `expiresAt`
6. `maxDownloads: 0` = unlimited, `maxDownloads: 1` = one-time link

## Data Models

### Document

| Field | Type | Description |
|-------|------|-------------|
| name | string | Display name |
| originalName | string | Original filename |
| mimeType | string | MIME type |
| size | number | File size in bytes |
| storageKey | string | MinIO object key |
| tags | string[] | User-defined tags |
| ownerId | string | Keycloak sub |

### ShareToken

| Field | Type | Description |
|-------|------|-------------|
| documentId | ObjectId | Reference to Document |
| token | string | URL-safe random token |
| createdBy | string | Owner's Keycloak sub |
| expiresAt | Date | Expiration (TTL index) |
| maxDownloads | number | 0 = unlimited |
| downloadCount | number | Current count |

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `PORT` | 4001 | Server port |
| `MONGO_URI` | `mongodb://localhost:27017/atlas-dms` | MongoDB connection |
| `KEYCLOAK_ISSUER` | `http://localhost:8080/realms/atlas` | Keycloak issuer |
| `KEYCLOAK_PUBLIC_ISSUER` | Same as ISSUER | Public Keycloak URL |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed origin |
| `MINIO_ENDPOINT` | `http://localhost:9000` | MinIO S3 API |
| `MINIO_ACCESS_KEY` | `minioadmin` | MinIO access key |
| `MINIO_SECRET_KEY` | `minioadmin` | MinIO secret key |
| `MINIO_BUCKET` | `atlas-dms` | MinIO bucket name |
| `MINIO_REGION` | `us-east-1` | S3 region |

## Docker (Production)

Traefik route: `Host(xaverric.cz) && PathPrefix(/api/v1/dms)`

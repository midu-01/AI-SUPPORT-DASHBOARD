# Database Schema

## ER Diagram

```mermaid
erDiagram
    users {
        string id PK "UUID"
        string email "unique"
        string hashed_password
        string full_name
        datetime created_at
    }

    conversations {
        string id PK "UUID"
        string user_id FK
        string title
        datetime created_at
        datetime updated_at
    }

    messages {
        string id PK "UUID"
        string conversation_id FK
        string role "user | assistant"
        text content
        datetime created_at
    }

    documents {
        string id PK "UUID"
        string user_id FK
        string filename
        string original_filename
        string mime_type
        int size_bytes
        string storage_path
        string status "uploaded | processing | indexed | failed"
        datetime uploaded_at
    }

    users ||--o{ conversations : owns
    users ||--o{ documents : uploads
    conversations ||--o{ messages : contains
```

## Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Primary keys | UUID (string) | Distributed-friendly; prevents ID enumeration attacks |
| `updated_at` on conversations | SQLAlchemy `onupdate` | Enables "Recent conversations" sort without a trigger |
| Indexes | `(user_id, updated_at DESC)` on conversations; `(conversation_id, created_at)` on messages; `(user_id)` on documents | Covers the most common query patterns |
| `documents.status` enum | `uploaded / processing / indexed / failed` | Signals AI-readiness; hooks into a future RAG pipeline |
| Delete strategy | Hard delete + CASCADE | Simple, no orphan rows, avoids over-engineering |

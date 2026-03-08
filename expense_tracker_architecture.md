# Personal Expense Tracker -- Architecture Design Document

## Purpose

This document defines the architecture for a **local-first personal
expense tracking system** that supports:

-   Manual transaction classification
-   Continuous machine learning improvement
-   Modular classification pipeline
-   Event-driven learning architecture
-   Merchant memory
-   Optional rule engine
-   Optional embedding-based similarity
-   Human-in-the-loop ML training
-   Confidence-based UX for predictions
-   Extensible design for future capabilities

The system is designed to **start with zero automation** and gradually
improve through user interaction.

Technology stack decisions are documented in Section 2.5 below.

------------------------------------------------------------------------

# 1. Core Design Principles

## 1.1 Local-first system

The application is hosted locally and accessed over LAN.

Goals: - full control of financial data - no external service
dependency - private ML model training

------------------------------------------------------------------------

## 1.2 Human-first learning

The system initially runs with:

-   no rules
-   no trained ML model
-   no merchant memory

All classifications are performed by the user.

This generates the **initial training dataset**.

------------------------------------------------------------------------

## 1.3 Progressive automation

Automation evolves over time:

1.  Manual classification
2.  ML classification suggestions
3.  Merchant memory inference
4.  Optional rule engine
5.  Optional embedding similarity

------------------------------------------------------------------------

## 1.4 Modular classification pipeline

Classification is performed through **sequential pipeline stages**.

Each stage attempts to classify a transaction.

If a stage produces a valid classification with sufficient confidence,
the pipeline stops.

------------------------------------------------------------------------

## 1.5 Event-driven learning

User actions generate events that update the system's learning
components.

This decouples:

-   classification
-   dataset updates
-   model training
-   analytics

------------------------------------------------------------------------

## 1.6 Continuous improvement

The system improves through:

-   manual corrections
-   incremental training dataset growth
-   scheduled or event-based retraining

------------------------------------------------------------------------

# 2. High-Level Architecture

    Frontend UI
        │
        ▼
    Backend API
        │
        ├── Transaction Service
        ├── Classification Pipeline
        ├── Learning Engine
        ├── Event Bus
        └── Analytics Engine
               │
               ▼
            Data Layer
        ├── Transaction DB
        ├── ML Dataset
        ├── Merchant Memory
        ├── User Overrides
        └── Embedding Index (optional)

------------------------------------------------------------------------

# 2.5 Technology Stack

## Backend

-   **Language & Framework:** Python + FastAPI
-   **ORM:** SQLAlchemy
-   **Database:** SQLite (local-first, zero-config)

## Frontend

-   **Framework:** React + TypeScript
-   **Build Tool:** Vite
-   **Styling:** Tailwind CSS

## Machine Learning

-   **Initial:** scikit-learn (TF-IDF vectorizer + Logistic Regression)
-   **Later:** sentence-transformers for embeddings + FAISS vector index

## Event System

-   In-process observer pattern (no external message broker)
-   Lightweight publish/subscribe within the application process

------------------------------------------------------------------------

# 3. Transaction Classification Pipeline

Pipeline processes transactions sequentially.

    Transaction
         ↓
    1. User Override Stage
         ↓
    2. Merchant Memory Stage
         ↓
    3. Rule Engine Stage
         ↓
    4. ML Classifier Stage
         ↓
    5. Embedding Similarity Stage
         ↓
    6. Human Classification

Each stage returns:

    category
    confidence
    classification_source

If no stage produces a confident result, the user must classify
manually.

------------------------------------------------------------------------

# 3.5 Transaction Ingestion Pipeline

Pipeline for importing bank transactions into the system.

    File Upload
         ↓
    Format Detection
         ↓
    Format-Specific Parser
         ↓
    Normalization
         ↓
    Merchant Extraction
         ↓
    Deduplication
         ↓
    Store
         ↓
    Classification

## Format Detection

Auto-detect file format by extension and content sniffing.

Supported formats are extended over time.

## Parser Abstraction

All parsers implement a common `BankParser` interface.

    BankParser
    ├── CsvBankParser        (Phase 1)
    ├── Mt940BankParser      (later)
    └── CamtBankParser       (later)

CSV parser is implemented first. MT940 and CAMT.053 support added later.

## Normalization

-   Clean and parse monetary amounts
-   Parse dates into consistent ISO 8601 format
-   Normalize text encoding (UTF-8)

## Merchant Extraction

-   Regex heuristics to strip SEPA/POS noise from descriptions
-   Extracted merchant stored alongside raw description
-   User can correct merchant during classification

## Deduplication

Composite SHA-256 hash of:

    (account_id, date, amount, raw_description)

Duplicate transactions are skipped during import. Duplicate count is
recorded per import batch.

------------------------------------------------------------------------

# 4. Pipeline Stages

## 4.1 User Override Stage

Explicit mappings defined by the user.

Patterns are **case-insensitive substring matches** by default, with
optional regex support (controlled by an `is_regex` flag per override).

Overrides have a `priority` field for ordering. Higher priority
overrides are evaluated first.

Example:

    "AMZN Mktp EU" → electronics
    "amzn*"        → electronics   (regex mode)

Highest priority classification.

------------------------------------------------------------------------

## 4.2 Merchant Memory Stage

Learns merchant-category relationships from labeled data.

Example:

    REWE → groceries
    Uber → transport
    Spotify → subscription

Merchant memory is derived from historical classifications.

------------------------------------------------------------------------

## 4.3 Rule Engine Stage

Optional deterministic rule layer.

Example rules:

    if description contains "salary" → income
    if description contains "rent" → housing

Rules should be explicitly defined by the user or plugins.

------------------------------------------------------------------------

## 4.4 ML Classifier Stage

Supervised machine learning classifier.

Input features may include:

-   transaction description
-   merchant name
-   optional features (amount, frequency)

Typical implementation:

    Text → TF‑IDF vectorizer → Logistic Regression classifier

Output:

    predicted category
    confidence score

------------------------------------------------------------------------

## 4.5 Embedding Similarity Stage (optional)

Uses vector embeddings to find similar transactions.

Process:

1.  Generate embedding for transaction text
2.  Search vector index
3.  Find nearest labeled transaction
4.  Assign its category

This stage can initially be **disabled**.

------------------------------------------------------------------------

## 4.6 Human Classification

If automated stages fail or confidence is low, the user selects the
category.

This classification becomes new training data.

------------------------------------------------------------------------

# 5. Initial System Behaviour

At system startup:

    Transaction
       ↓
    Human Classification

No automated stages are active.

The system gradually learns from user actions.

------------------------------------------------------------------------

# 6. Event Driven Learning

User classifications produce a learning event.

    TransactionClassifiedEvent

Example payload:

    transaction_id
    description
    merchant
    amount
    assigned_category
    source = human
    timestamp

------------------------------------------------------------------------

# 7. Event Bus Consumers

The following components listen to classification events.

### ML Dataset Updater

Adds labeled examples to the ML training dataset.

### Merchant Memory Updater

Updates merchant-category statistics.

### Embedding Index Updater

Stores embeddings for similarity search.

### Analytics Updater

Updates reporting statistics.

------------------------------------------------------------------------

# 8. Continuous Training Loop

Retraining occurs periodically or when enough new data is available.

Possible triggers:

    N new labeled transactions
    scheduled training (daily / weekly)
    manual retraining

Retraining updates:

    ML classifier
    vectorizer
    optional embedding index

------------------------------------------------------------------------

# 9. Confidence-Based UX

ML predictions include confidence scores.

All predictions are shown as **suggestions requiring user confirmation**
by default.

Example:

    Prediction: groceries
    Confidence: 0.91

Suggested UX behavior:

  Confidence    UI Behavior
  ------------- ----------------------------------------
  > 0.85        strong suggestion (one-click confirm)
  0.5 -- 0.85   suggest category
  < 0.5         require manual classification

Auto-assign (skip confirmation) is available as a **user preference**
and is disabled by default. When enabled, transactions with confidence
> 0.85 are classified automatically.

------------------------------------------------------------------------

# 10. Observability

Every classification stores metadata.

    transaction_id
    predicted_category
    final_category
    classification_source
    confidence
    pipeline_stage
    timestamp

Possible sources:

    override
    merchant_memory
    rule_engine
    ml_classifier
    embedding_similarity
    human

This enables monitoring of model performance.

------------------------------------------------------------------------

# 11. Data Model (Conceptual)

## Accounts

    accounts
    id
    name
    bank_name
    account_type
    currency
    owner
    created_at

------------------------------------------------------------------------

## Import Batches

    import_batches
    id
    account_id          → FK accounts.id
    filename
    file_format
    transaction_count
    duplicates_skipped
    imported_at

------------------------------------------------------------------------

## Transactions

    transactions
    id
    account_id          → FK accounts.id
    date
    amount
    currency
    description
    raw_description
    merchant
    dedup_hash
    predicted_category
    final_category
    classification_source
    confidence
    import_batch_id     → FK import_batches.id
    created_at

------------------------------------------------------------------------

## Categories

    categories
    id
    name
    parent_category

------------------------------------------------------------------------

## Merchant Memory

    merchant_category_stats
    merchant
    category
    count
    confidence

------------------------------------------------------------------------

## User Overrides

    user_overrides
    id
    pattern
    category_id         → FK categories.id
    is_regex
    priority

------------------------------------------------------------------------

## ML Training Dataset

    training_data
    transaction_id
    text_features
    merchant
    amount
    category
    source

------------------------------------------------------------------------

# 12. Embedding Index (Optional)

Vector index entries:

    embedding_vector
    transaction_id
    category

Used for similarity classification.

------------------------------------------------------------------------

# 13. Analytics Engine

Provides insights such as:

-   spending by category
-   monthly trends
-   merchant spending
-   recurring expenses
-   subscription detection
-   savings tracking
-   investements overviews

Analytics operates on categorized transactions.

------------------------------------------------------------------------

# 14. Extensibility

New classification stages can be added easily.

Examples:

    Subscription Detection Stage
    Recurring Payment Stage
    Anomaly Detection Stage
    Budget Enforcement Stage

All stages implement a common interface.

------------------------------------------------------------------------

# 15. Development Phases

## Phase 1 -- Foundation

Backend:

-   Full project structure with modular extension points
-   SQLite database setup with SQLAlchemy models
-   CSV parser (first BankParser implementation)
-   Transaction ingestion pipeline (format detection, normalization,
    deduplication)
-   Classification pipeline with all stage interfaces
-   Event bus with in-process observer pattern
-   ML classifier (TF-IDF + Logistic Regression) with continuous
    learning
-   Manual classification endpoint

Frontend:

-   File upload for bank transaction history
-   Transaction list with filtering and sorting
-   Classification UI (manual assign + suggestion confirm)
-   Basic spending dashboard

## Phase 2 -- Rule Engine + User Overrides

Backend:

-   User override stage in classification pipeline
-   Rule engine stage in classification pipeline
-   CRUD API for overrides and rules

Frontend:

-   Override management UI (create, edit, delete, reorder)
-   Rule management UI

## Phase 3 -- Merchant Memory

Backend:

-   Merchant memory stage in classification pipeline
-   Statistics aggregation from classified transactions

Frontend:

-   Merchant viewer / editor UI

## Phase 4 -- Analytics + Budgeting

Backend:

-   Analytics API (spending by category, trends, recurring expenses)
-   Budget tracking API

Frontend:

-   Full analytics dashboard
-   Budget tracking UI

## Phase 5 -- Embeddings

Backend:

-   Sentence-transformer embeddings generation
-   FAISS vector index for similarity search
-   Embedding similarity stage in classification pipeline

------------------------------------------------------------------------

# 16. Expected System Evolution

Initial state:

    100% manual classification

After sufficient training data:

    70–90% automated classification

User corrections continuously improve system accuracy.

------------------------------------------------------------------------

# 17. Future Enhancements

Possible expansions:

-   bank API integrations
-   automatic merchant extraction
-   anomaly detection
-   spending forecasts
-   budgeting assistance

------------------------------------------------------------------------

# End of Architecture Document

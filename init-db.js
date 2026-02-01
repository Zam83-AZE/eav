const Database = require('better-sqlite3');
const db = new Database('engine.db');

console.log("⚙️  Universal Engine v3.0 (Clean Install) qurulur...");

// 1. TƏMİZLİK (Köhnə hər şeyi silirik)
db.exec(`
  DROP TABLE IF EXISTS records;
  DROP TABLE IF EXISTS decision_rules;
  DROP TABLE IF EXISTS workflow_states;
  DROP TABLE IF EXISTS attributes;
  DROP TABLE IF EXISTS entities;
  DROP TABLE IF EXISTS projects;
`);

// 2. STRUKTURU QURURUQ (İçi boş olacaq)

db.exec(`
  -- 1. PROYEKTLƏR (Projects)
  CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT
  );

  -- 2. OBYEKTLƏR (Entities)
  CREATE TABLE entities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    is_process BOOLEAN DEFAULT 0, -- Sadəcə cədvəl (0) yoxsa Proses (1)?
    FOREIGN KEY(project_id) REFERENCES projects(id)
  );

  -- 3. SAHƏLƏR (Attributes)
  CREATE TABLE attributes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id INTEGER NOT NULL,
    key TEXT NOT NULL,          
    label TEXT NOT NULL,        
    type TEXT NOT NULL,         -- 'text', 'number', 'date', 'boolean', 'relation'
    required BOOLEAN DEFAULT 0,
    related_entity_id INTEGER,  -- Relation üçün
    display_order INTEGER DEFAULT 0,
    FOREIGN KEY(entity_id) REFERENCES entities(id)
  );

  -- 4. İŞ AXINI (Workflows)
  CREATE TABLE workflow_states (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id INTEGER NOT NULL,
    state_name TEXT NOT NULL,   -- "Draft", "Approved"
    state_key TEXT NOT NULL,    -- "draft"
    is_initial BOOLEAN DEFAULT 0,
    is_final BOOLEAN DEFAULT 0,
    FOREIGN KEY(entity_id) REFERENCES entities(id)
  );

  -- 5. QƏRAR CƏDVƏLİ (Decision Rules)
  CREATE TABLE decision_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    event_type TEXT NOT NULL,    -- 'before_save', 'on_state_change'
    conditions TEXT NOT NULL,    -- JSON
    actions TEXT NOT NULL,       -- JSON
    priority INTEGER DEFAULT 0,
    FOREIGN KEY(entity_id) REFERENCES entities(id)
  );

  -- 6. REAL DATA (Records)
  CREATE TABLE records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id INTEGER NOT NULL,
    current_state_key TEXT,      -- Hazırki status
    data TEXT,                   -- JSON Data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(entity_id) REFERENCES entities(id)
  );
`);

console.log("✅ Universal Baza Strukturu (Boş) yaradıldı.");
console.log("ℹ️  İndi 'Architect Panel' vasitəsilə ilk layihəni yaratmalısan.");
import Database from 'better-sqlite3';

const db = new Database('engine.db');

export default db;

// --- TİPLƏR (TYPES) ---

export interface Project {
  id: number;
  name: string;
  slug: string;
}

export interface Entity {
  id: number;
  project_id: number;
  name: string;
  slug: string;
  is_process: number; // 0 or 1
}

export interface Attribute {
  id: number;
  entity_id: number;
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'relation';
  related_entity_id: number | null;
}

export interface WorkflowState {
  id: number;
  entity_id: number;
  state_name: string;
  state_key: string;
  is_initial: number;
}

export interface DecisionRule {
  id: number;
  entity_id: number;
  name: string;
  event_type: string;
  conditions: string; // JSON string
  actions: string;    // JSON string
}
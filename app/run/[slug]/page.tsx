import Database from 'better-sqlite3';
import { revalidatePath } from 'next/cache';
import React from 'react';

// --- DATABASE HELPER ---
function getDb() {
  return new Database('engine.db');
}

export default async function UniversalRunnerPage({ params }: { params: { slug: string } }) {
  // 1. URL-dən parametri oxuyuruq
  const { slug } = await params;
  const db = getDb();

  // 2. METADATA-NI OXUYURUQ
  const entity = db.prepare('SELECT * FROM entities WHERE slug = ?').get(slug) as any;

  if (!entity) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
          <h1 className="text-4xl mb-4">🚫</h1>
          <h2 className="text-xl font-bold text-red-600 mb-2">Module Not Found</h2>
          <p className="text-slate-600 mb-6">The module <b>"{slug}"</b> has not been created yet.</p>
          <a href="/architect" className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition">Go to Architect</a>
        </div>
      </div>
    );
  }

  // 3. SAHƏLƏR VƏ STATUSLAR
  const attributes = db.prepare('SELECT * FROM attributes WHERE entity_id = ?').all(entity.id) as any[];
  const workflows = db.prepare('SELECT * FROM workflow_states WHERE entity_id = ? ORDER BY is_initial DESC, id ASC').all(entity.id) as any[];

  // 4. DATA CƏDVƏLİ (Hazırlıq)
  const tableName = `data_${entity.slug.replace(/-/g, '_')}`;
  
  const columnDefs = attributes.map(attr => {
    let type = 'TEXT';
    if (attr.type === 'number') type = 'REAL'; 
    return `${attr.key} ${type}`;
  }).join(', ');

  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      state_key TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ${columnDefs ? `, ${columnDefs}` : ''}
    )
  `;
  db.exec(createTableSQL);

  // 5. DATA OXUMA (Table)
  let rows: any[] = [];
  try {
    rows = db.prepare(`SELECT * FROM ${tableName} ORDER BY id DESC`).all();
  } catch (e) {
    rows = [];
  }

  // 6. RELATION SEÇİMLƏRİ
  const relationOptions: Record<string, any[]> = {};
  for (const attr of attributes) {
    if (attr.type === 'relation' && attr.related_entity_id) {
      const relatedEntity = db.prepare('SELECT slug FROM entities WHERE id = ?').get(attr.related_entity_id) as any;
      if (relatedEntity) {
        const relTable = `data_${relatedEntity.slug.replace(/-/g, '_')}`;
        try {
          relationOptions[attr.key] = db.prepare(`SELECT * FROM ${relTable}`).all();
        } catch (e) {
          relationOptions[attr.key] = [];
        }
      }
    }
  }

  // --- SERVER ACTIONS ---

  async function saveData(formData: FormData) {
    'use server';
    const dbOp = new Database('engine.db');
    
    const values = attributes.map(attr => formData.get(attr.key));
    const placeholders = attributes.map(() => '?').join(', ');
    const columns = attributes.map(attr => attr.key).join(', ');

    let initialState = null;
    if (entity.is_process) {
       const initialWf = dbOp.prepare('SELECT state_key FROM workflow_states WHERE entity_id = ? AND is_initial = 1').get(entity.id) as any;
       if (initialWf) initialState = initialWf.state_key;
    }

    if (columns.length > 0) {
      const sql = `INSERT INTO ${tableName} (state_key, ${columns}) VALUES (?, ${placeholders})`;
      dbOp.prepare(sql).run(initialState, ...values);
    } else {
      dbOp.prepare(`INSERT INTO ${tableName} (state_key) VALUES (?)`).run(initialState);
    }
    
    revalidatePath(`/run/${slug}`);
  }

  async function deleteData(formData: FormData) {
    'use server';
    const id = formData.get('id');
    const dbOp = new Database('engine.db');
    dbOp.prepare(`DELETE FROM ${tableName} WHERE id = ?`).run(id);
    revalidatePath(`/run/${slug}`);
  }

  async function changeStatus(formData: FormData) {
    'use server';
    const id = formData.get('id');
    const newState = formData.get('new_state');
    const dbOp = new Database('engine.db');

    console.log(`UPDATING ID: ${id} TO STATUS: ${newState}`); // Debug log

    if (id && newState) {
        dbOp.prepare(`UPDATE ${tableName} SET state_key = ? WHERE id = ?`).run(newState, id);
    }
    
    revalidatePath(`/run/${slug}`);
  }

  // --- UI RENDER ---
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20">
      
      {/* HEADER */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className={`w-10 h-10 flex items-center justify-center rounded-lg text-xl text-white ${entity.is_process ? 'bg-amber-500' : 'bg-blue-600'}`}>
               {entity.is_process ? '⚙️' : '📄'}
             </div>
             <div>
               <h1 className="text-xl font-bold text-slate-900 capitalize">{entity.name}</h1>
               <p className="text-xs text-slate-500 uppercase tracking-wider">{entity.is_process ? 'Workflow Process' : 'Data Registry'}</p>
             </div>
          </div>
          <a href="/architect" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition flex items-center gap-1">
            <span>← Back to Architect</span>
          </a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* --- LEFT: FORM --- */}
        <div className="lg:col-span-4">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 sticky top-24">
            <h2 className="text-lg font-bold mb-6 text-slate-800 flex items-center gap-2 pb-4 border-b">
              <span>Add New Record</span>
            </h2>
            
            <form action={saveData} className="flex flex-col gap-5">
              {attributes.map((attr) => (
                <div key={attr.id}>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">
                    {attr.label}
                  </label>
                  
                  {attr.type === 'relation' ? (
                    <div className="relative">
                      <select name={attr.key} className="w-full appearance-none border border-slate-300 p-3 rounded-lg bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition cursor-pointer" required>
                         <option value="">-- Select --</option>
                         {relationOptions[attr.key]?.map((opt: any) => {
                           const displayLabel = Object.entries(opt)
                             .filter(([k, v]) => k !== 'id' && k !== 'created_at' && k !== 'state_key' && typeof v === 'string')
                             .map(([_, v]) => v)[0] || `ID: ${opt.id}`;
                           return <option key={opt.id} value={opt.id}>{String(displayLabel)}</option>;
                         })}
                      </select>
                      <div className="absolute right-3 top-3.5 pointer-events-none text-slate-400 text-xs">▼</div>
                    </div>
                  ) : (
                    <input 
                      type={attr.type === 'number' ? 'number' : attr.type === 'date' ? 'date' : 'text'} 
                      name={attr.key}
                      step={attr.type === 'number' ? "any" : undefined}
                      placeholder={`Enter ${attr.label}...`}
                      className="w-full border border-slate-300 p-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition"
                      required 
                      autoComplete="off"
                    />
                  )}
                </div>
              ))}
              
              <button className="bg-slate-900 text-white py-3.5 rounded-lg font-bold hover:bg-slate-800 transition shadow-lg mt-2 flex justify-center items-center gap-2">
                <span>Save Record</span>
              </button>
            </form>
          </div>
        </div>

        {/* --- RIGHT: TABLE --- */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b bg-slate-50 flex justify-between items-center">
               <h3 className="font-bold text-slate-700">Records ({rows.length})</h3>
               <div className="text-xs text-slate-400 font-mono bg-white px-2 py-1 rounded border">Table: {tableName}</div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-white text-slate-500 border-b">
                  <tr>
                    <th className="p-4 font-bold text-xs uppercase tracking-wider w-16 text-center">ID</th>
                    {attributes.map(attr => <th key={attr.id} className="p-4 font-bold text-xs uppercase tracking-wider">{attr.label}</th>)}
                    {entity.is_process === 1 && <th className="p-4 font-bold text-xs uppercase tracking-wider text-center">Status</th>}
                    <th className="p-4 text-right font-bold text-xs uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50 transition group">
                      <td className="p-4 text-slate-400 font-mono text-xs text-center">#{row.id}</td>
                      
                      {attributes.map(attr => (
                        <td key={attr.id} className="p-4">
                          {attr.type === 'relation' ? (
                            <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-xs font-bold border border-blue-100">
                              🔗 {
                                String(
                                  relationOptions[attr.key]?.find((r:any) => String(r.id) === String(row[attr.key])) 
                                  ? (Object.entries(relationOptions[attr.key]?.find((r:any) => String(r.id) === String(row[attr.key])))
                                      .filter(([k, v]) => k !== 'id' && k !== 'created_at' && k !== 'state_key' && typeof v === 'string')
                                      .map(([_, v]) => v)[0])
                                  : `(ID:${row[attr.key]})`
                                )
                              }
                            </span>
                          ) : (
                            <span className="text-slate-700 font-medium">{row[attr.key] as React.ReactNode}</span>
                          )}
                        </td>
                      ))}

                      {/* --- FIX: WORKFLOW BUTTONS --- */}
                      {entity.is_process === 1 && (
                        <td className="p-4 text-center">
                           <div className="flex flex-col items-center gap-2">
                             <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${row.state_key === 'paid' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                               {row.state_key || 'Draft'}
                             </span>
                             
                             <div className="flex flex-wrap justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                               {workflows.filter(wf => wf.state_key !== row.state_key).map(wf => (
                                 /* Hər düymə üçün ayrıca FORM yaradırıq ki, null xətası olmasın */
                                 <form key={wf.id} action={changeStatus}>
                                   <input type="hidden" name="id" value={row.id} />
                                   <input type="hidden" name="new_state" value={wf.state_key} />
                                   <button className="text-[10px] bg-white border border-slate-300 px-2 py-1 rounded hover:bg-slate-800 hover:text-white transition shadow-sm cursor-pointer">
                                     → {wf.state_name}
                                   </button>
                                 </form>
                               ))}
                             </div>
                           </div>
                        </td>
                      )}

                      <td className="p-4 text-right">
                        <form action={deleteData}>
                          <input type="hidden" name="id" value={row.id} />
                          <button className="text-slate-300 hover:text-red-600 transition p-1.5 hover:bg-red-50 rounded">🗑️</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                     <tr>
                       <td colSpan={10} className="p-12 text-center text-slate-400">
                         <div className="text-3xl mb-3 opacity-20">📂</div>
                         No records found.
                       </td>
                     </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
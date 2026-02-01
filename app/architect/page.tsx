import { revalidatePath } from 'next/cache';
import Database from 'better-sqlite3';
import { redirect } from 'next/navigation';

// --- TYPES ---
interface WorkflowState { id: number; entity_id: number; state_name: string; state_key: string; is_initial: number; }
interface Attribute { id: number; entity_id: number; key: string; label: string; type: string; related_entity_id: number | null; }
interface Entity { id: number; project_id: number; name: string; slug: string; is_process: number; attributes?: Attribute[]; workflows?: WorkflowState[]; }
interface Project { id: number; name: string; slug: string; entities?: Entity[]; }

// --- DATABASE INITIALIZATION ---
function getDb() {
  const db = new Database('engine.db');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      slug TEXT
    );
    CREATE TABLE IF NOT EXISTS entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      name TEXT,
      slug TEXT,
      is_process INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS attributes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id INTEGER,
      key TEXT,
      label TEXT,
      type TEXT,
      related_entity_id INTEGER
    );
    CREATE TABLE IF NOT EXISTS workflow_states (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id INTEGER,
      state_name TEXT,
      state_key TEXT,
      is_initial INTEGER DEFAULT 0
    );
  `);
  
  return db;
}

export default async function ArchitectPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  
  const sp = await searchParams;
  const editingId = sp?.edit ? Number(sp.edit) : null;

  // --- SERVER ACTIONS ---
  
  async function createProject(formData: FormData) {
    'use server';
    const db = getDb();
    const name = formData.get('name') as string;
    const slug = name.toLowerCase().replace(/ /g, '-');
    db.prepare('INSERT INTO projects (name, slug) VALUES (?, ?)').run(name, slug);
    revalidatePath('/architect');
  }

  async function deleteProject(formData: FormData) {
    'use server';
    const id = formData.get('id');
    const db = getDb();
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    db.prepare('DELETE FROM entities WHERE project_id = ?').run(id); 
    revalidatePath('/architect');
  }

  async function createEntity(formData: FormData) {
    'use server';
    const db = getDb();
    const name = formData.get('name') as string;
    const projectId = formData.get('project_id');
    const isProcess = formData.get('is_process') === 'on' ? 1 : 0;
    const slug = name.toLowerCase().replace(/ /g, '_');
    db.prepare('INSERT INTO entities (project_id, name, slug, is_process) VALUES (?, ?, ?, ?)').run(projectId, name, slug, isProcess);
    revalidatePath('/architect');
  }

  async function deleteEntity(formData: FormData) {
    'use server';
    const id = formData.get('id');
    const db = getDb();
    db.prepare('DELETE FROM entities WHERE id = ?').run(id);
    db.prepare('DELETE FROM attributes WHERE entity_id = ?').run(id);
    db.prepare('DELETE FROM workflow_states WHERE entity_id = ?').run(id);
    revalidatePath('/architect');
  }

  async function createAttribute(formData: FormData) {
    'use server';
    const db = getDb();
    const label = formData.get('label') as string;
    const entityId = formData.get('entity_id');
    const type = formData.get('type');
    const relatedEntityId = formData.get('related_entity_id') || null;
    const key = label.toLowerCase().replace(/ /g, '_').replace(/[^\w]/g, '');
    db.prepare('INSERT INTO attributes (entity_id, key, label, type, related_entity_id) VALUES (?, ?, ?, ?, ?)').run(entityId, key, label, type, relatedEntityId);
    revalidatePath('/architect');
  }

  async function updateAttribute(formData: FormData) {
    'use server';
    const db = getDb();
    const id = formData.get('id');
    const label = formData.get('label') as string;
    const type = formData.get('type'); 
    db.prepare('UPDATE attributes SET label = ?, type = ? WHERE id = ?').run(label, type, id);
    redirect('/architect');
  }

  async function deleteAttribute(formData: FormData) {
    'use server';
    const id = formData.get('id');
    const db = getDb();
    db.prepare('DELETE FROM attributes WHERE id = ?').run(id);
    revalidatePath('/architect');
  }

  async function createWorkflow(formData: FormData) {
    'use server';
    const db = getDb();
    const name = formData.get('state_name') as string;
    const entityId = formData.get('entity_id');
    const isInitial = formData.get('is_initial') === 'on' ? 1 : 0;
    const key = name.toLowerCase().replace(/ /g, '_');
    db.prepare('INSERT INTO workflow_states (entity_id, state_name, state_key, is_initial) VALUES (?, ?, ?, ?)').run(entityId, name, key, isInitial);
    revalidatePath('/architect');
  }

  async function deleteWorkflow(formData: FormData) {
    'use server';
    const id = formData.get('id');
    const db = getDb();
    db.prepare('DELETE FROM workflow_states WHERE id = ?').run(id);
    revalidatePath('/architect');
  }

  // --- DATA FETCHING ---
  const dbReader = getDb();
  const projects = dbReader.prepare('SELECT * FROM projects ORDER BY id DESC').all() as Project[];
  const allEntities = dbReader.prepare('SELECT * FROM entities').all() as Entity[];

  projects.forEach((p) => {
    p.entities = dbReader.prepare('SELECT * FROM entities WHERE project_id = ? ORDER BY id DESC').all(p.id) as Entity[];
    p.entities.forEach((e) => {
      e.attributes = dbReader.prepare('SELECT * FROM attributes WHERE entity_id = ?').all(e.id) as Attribute[];
      e.workflows = dbReader.prepare('SELECT * FROM workflow_states WHERE entity_id = ? ORDER BY is_initial DESC, id ASC').all(e.id) as WorkflowState[];
    });
  });

  // --- UI RENDER (ENGLISH VERSION) ---
  return (
    <div className="min-h-screen bg-gray-50 text-slate-800 pb-20 font-sans">
      
      {/* HEADER */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
           <div className="flex items-center gap-2">
             <div className="bg-blue-600 text-white p-2 rounded-lg">🚀</div>
             <h1 className="text-xl font-bold text-slate-900">Architect Panel <span className="text-blue-600">v5.2 English</span></h1>
           </div>
           <div className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded-full border border-green-200 font-medium">
             System Active
           </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-8">
        
        {/* NEW PROJECT SECTION */}
        <div className="bg-slate-900 rounded-2xl shadow-lg p-8 mb-12 text-white flex items-center gap-8">
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2">Start New System</h2>
            <p className="text-slate-400">Create a new "universe" to manage your business logic.</p>
          </div>
          <form action={createProject} className="flex gap-2 w-1/2 bg-white/10 p-2 rounded-xl border border-white/20">
            <input name="name" placeholder="Project Name (e.g. Payroll, CRM)..." className="flex-1 bg-transparent border-none text-white px-4 py-2 outline-none placeholder-slate-400" required autoComplete="off"/>
            <button className="bg-blue-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-400 transition shadow-lg">Create</button>
          </form>
        </div>

        {/* PROJECTS LOOP */}
        <div className="space-y-20">
          {projects.map((proj) => (
            <div key={proj.id} className="animate-fade-in">
              
              {/* PROJECT HEADER */}
              <div className="flex items-center gap-4 mb-8">
                <h2 className="text-4xl font-black text-slate-800">{proj.name}</h2>
                <div className="h-px bg-slate-300 flex-1"></div>
                <form action={deleteProject}>
                  <input type="hidden" name="id" value={proj.id} />
                  <button className="text-red-400 text-sm hover:bg-red-50 px-4 py-2 rounded transition">Delete Project</button>
                </form>
              </div>

              {/* ENTITY CREATION BAR */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-8 flex flex-wrap items-center gap-4">
                <span className="font-bold text-slate-500 text-sm uppercase tracking-wide">New Module:</span>
                <form action={createEntity} className="flex flex-1 gap-3 items-center">
                  <input type="hidden" name="project_id" value={proj.id} />
                  <input name="name" placeholder="Name (e.g. Employee, Payment)" className="border border-slate-300 p-2 rounded-lg w-56 focus:border-blue-500 outline-none transition" required autoComplete="off" />
                  
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-2 rounded-lg border hover:bg-slate-100 transition">
                    <input type="checkbox" name="is_process" className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                    <span className="text-sm font-medium">Is this a Process?</span>
                  </label>
                  
                  <button className="bg-slate-800 text-white px-5 py-2 rounded-lg font-medium hover:bg-black transition">Add Module +</button>
                </form>
              </div>

              {/* ENTITIES GRID */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                {proj.entities?.map((entity) => (
                  <div key={entity.id} className={`rounded-2xl border shadow-sm bg-white overflow-hidden flex flex-col transition-all hover:shadow-md ${entity.is_process ? 'border-amber-200' : 'border-slate-200'}`}>
                    
                    {/* ENTITY HEADER */}
                    <div className={`px-6 py-4 flex justify-between items-center border-b ${entity.is_process ? 'bg-amber-50/60 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex items-center gap-3">
                         <div className={`w-10 h-10 flex items-center justify-center rounded-lg text-xl shadow-sm ${entity.is_process ? 'bg-amber-100 text-amber-700' : 'bg-white border text-slate-500'}`}>
                           {entity.is_process ? '⚙️' : '📄'}
                         </div>
                         <div>
                            <h3 className="font-bold text-lg text-slate-900">{entity.name}</h3>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${entity.is_process ? 'text-amber-600' : 'text-slate-400'}`}>
                                {entity.is_process ? 'Workflow Process' : 'Data Record'}
                            </span>
                         </div>
                      </div>
                      <form action={deleteEntity}>
                        <input type="hidden" name="id" value={entity.id} />
                        <button className="text-slate-300 hover:text-red-500 p-2 hover:bg-red-50 rounded transition">🗑️</button>
                      </form>
                    </div>

                    <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100 flex-1">
                      
                      {/* --- COLUMN 1: INTERNAL FIELDS --- */}
                      <div className="flex-1 p-6">
                        <h4 className="font-bold text-xs uppercase text-slate-400 mb-4 tracking-wider flex items-center gap-2">
                          <span>📝 Internal Fields</span>
                        </h4>

                        <div className="space-y-3 mb-6">
                          {entity.attributes?.filter(a => a.type !== 'relation').map(attr => (
                            <div key={attr.id}>
                              {/* EDIT MODE */}
                              {editingId === attr.id ? (
                                <form action={updateAttribute} className="flex gap-2 items-center bg-blue-50 p-2 rounded-lg border border-blue-200">
                                  <input type="hidden" name="id" value={attr.id} />
                                  <input name="label" defaultValue={attr.label} className="w-full text-sm border p-1 rounded" autoFocus />
                                  <select name="type" defaultValue={attr.type} className="text-xs border p-1 rounded">
                                    <option value="text">Text</option>
                                    <option value="number">Num</option>
                                    <option value="date">Date</option>
                                  </select>
                                  <button className="text-green-600 font-bold px-2">💾</button>
                                  <a href="/architect" className="text-slate-400 px-2">✖</a>
                                </form>
                              ) : (
                                /* NORMAL MODE */
                                <div className="flex justify-between items-center group">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-slate-700">{attr.label}</span>
                                    <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{attr.type}</span>
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <a href={`/architect?edit=${attr.id}`} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">✏️</a>
                                    <form action={deleteAttribute}>
                                      <input type="hidden" name="id" value={attr.id} />
                                      <button className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded">×</button>
                                    </form>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                          
                          {/* NEW FIELD FORM */}
                          <form action={createAttribute} className="flex gap-2 mt-4 pt-4 border-t border-slate-100 border-dashed">
                             <input type="hidden" name="entity_id" value={entity.id} />
                             <input name="label" placeholder="New Field (e.g. Name, Date)..." className="flex-1 border border-slate-300 p-2 text-xs rounded-lg focus:border-slate-500 outline-none" required autoComplete="off"/>
                             <select name="type" className="border border-slate-300 p-2 text-xs rounded-lg bg-white outline-none w-20">
                                 <option value="text">Text</option>
                                 <option value="number">Num</option>
                                 <option value="date">Date</option>
                             </select>
                             <button className="bg-slate-100 hover:bg-slate-200 text-slate-600 w-8 rounded-lg font-bold transition">+</button>
                          </form>
                        </div>
                      </div>

                      {/* --- COLUMN 2: RELATIONS --- */}
                      <div className="flex-1 p-6 bg-slate-50/50">
                        <h4 className="font-bold text-xs uppercase text-blue-500 mb-4 tracking-wider flex items-center gap-2">
                          <span>🔗 Relations (Connects To)</span>
                        </h4>

                        <div className="space-y-3 mb-6">
                          {entity.attributes?.filter(a => a.type === 'relation').map(attr => (
                            <div key={attr.id} className="group">
                               {editingId === attr.id ? (
                                  <form action={updateAttribute} className="flex gap-2 items-center bg-white p-2 rounded-lg border border-blue-300 shadow-sm">
                                    <input type="hidden" name="id" value={attr.id} />
                                    <input type="hidden" name="type" value="relation" />
                                    <input name="label" defaultValue={attr.label} className="w-full text-sm border p-1 rounded" />
                                    <button className="text-green-600 font-bold px-2">💾</button>
                                    <a href="/architect" className="text-slate-400 px-2">✖</a>
                                  </form>
                               ) : (
                                  <div className="flex justify-between items-center bg-white px-3 py-2.5 rounded-lg border border-blue-100 shadow-sm group-hover:border-blue-300 transition">
                                    <div className="flex items-center gap-2">
                                      <span className="text-blue-400 text-xs">➡</span>
                                      <span className="text-sm font-bold text-blue-900">{attr.label}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <a href={`/architect?edit=${attr.id}`} className="text-slate-300 hover:text-blue-500 text-xs p-1">✏️</a>
                                      <form action={deleteAttribute}>
                                        <input type="hidden" name="id" value={attr.id} />
                                        <button className="text-red-200 hover:text-red-500 font-bold px-1">×</button>
                                      </form>
                                    </div>
                                  </div>
                               )}
                            </div>
                          ))}
                          {entity.attributes?.filter(a => a.type === 'relation').length === 0 && (
                            <div className="text-xs text-slate-400 italic py-2">No relations connected.</div>
                          )}
                        </div>

                        {/* NEW RELATION FORM */}
                        <form action={createAttribute} className="flex flex-col gap-2 mt-auto pt-4 border-t border-blue-100 border-dashed">
                           <input type="hidden" name="entity_id" value={entity.id} />
                           <input type="hidden" name="type" value="relation" />
                           <div className="flex gap-2">
                             <input name="label" placeholder="Connection Name (e.g. Employee)" className="flex-1 border border-blue-200 p-2 text-xs rounded-lg outline-none focus:border-blue-400" required autoComplete="off" />
                           </div>
                           <div className="flex gap-2">
                             <select name="related_entity_id" className="flex-1 border border-blue-200 p-2 text-xs rounded-lg bg-white text-slate-700 outline-none cursor-pointer hover:border-blue-400 transition">
                                <option value="">-- Connect to which module? --</option>
                                {allEntities.filter(e => e.id !== entity.id).map((e) => (
                                  <option key={e.id} value={e.id}>{e.name}</option>
                                ))}
                             </select>
                             <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-lg text-xs font-bold transition shadow-sm">Link</button>
                           </div>
                        </form>
                      </div>
                    </div>

                    {/* --- WORKFLOW --- */}
                    {entity.is_process === 1 && (
                      <div className="bg-amber-50 px-6 py-4 border-t border-amber-100">
                         <div className="flex justify-between items-center mb-3">
                            <h4 className="font-bold text-xs uppercase text-amber-700 tracking-wider">Workflow Steps</h4>
                            <span className="text-[10px] text-amber-600/60 bg-amber-100/50 px-2 py-1 rounded">Left → Right Sequence</span>
                         </div>
                         
                         {/* VISUAL STEPS */}
                         <div className="flex flex-wrap items-center gap-2 mb-4">
                           {entity.workflows?.map((wf, index) => (
                             <div key={wf.id} className="flex items-center">
                               {index > 0 && <span className="text-amber-300 mx-1 text-lg">→</span>}
                               
                               <div className={`relative group flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-bold shadow-sm ${wf.is_initial ? 'bg-green-100 border-green-300 text-green-800' : 'bg-white border-amber-200 text-slate-600'}`}>
                                 {Boolean(wf.is_initial) && <span title="Start">🚀</span>}
                                 {wf.state_name}
                                 
                                 <form action={deleteWorkflow} className="ml-1 border-l border-black/10 pl-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <input type="hidden" name="id" value={wf.id} />
                                    <button className="text-red-400 hover:text-red-600">×</button>
                                 </form>
                               </div>
                             </div>
                           ))}
                           {(!entity.workflows || entity.workflows.length === 0) && (
                             <span className="text-xs text-slate-400 italic">No steps defined. Process cannot start.</span>
                           )}
                         </div>

                         {/* NEW STEP FORM */}
                         <form action={createWorkflow} className="flex gap-2 items-center bg-white/50 p-2 rounded-lg border border-amber-100">
                            <input type="hidden" name="entity_id" value={entity.id} />
                            <span className="text-xs font-bold text-amber-800 pl-1">New Step:</span>
                            <input name="state_name" placeholder="Name (e.g. Approved)" className="flex-1 border border-amber-200 p-1.5 text-xs rounded focus:outline-none bg-white" required autoComplete="off"/>
                            
                            <label className="flex items-center gap-1 cursor-pointer px-2 border-l border-amber-200" title="Does process start here?">
                               <input type="checkbox" name="is_initial" className="w-3.5 h-3.5 accent-green-600" />
                               <span className="text-[10px] text-slate-500 font-medium">Start?</span>
                            </label>
                            
                            <button className="bg-amber-500 text-white w-8 h-8 rounded flex items-center justify-center font-bold hover:bg-amber-600 shadow-sm transition pb-1">+</button>
                         </form>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
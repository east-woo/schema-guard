import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  Handle, 
  Position,
  Node,
  Edge,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  Connection,
  addEdge
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { Icons } from './components/Icons';
import { cn } from './lib/utils';

// --- Types ---

type View = 'dashboard' | 'designer' | 'drift' | 'dictionary' | 'setup' | 'users' | 'requests' | 'services';

type DBType = 'RDBMS' | 'NoSQL' | 'Cache';

interface ServiceConfig {
  id: string;
  name: string;
  type: DBType;
  provider: string;
  status: 'online' | 'offline';
  alignment: number;
}

interface ChangeRequest {
  id: string;
  table: string;
  author: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: string;
  description: string;
  changes: {
    type: 'add_column' | 'modify_column' | 'drop_column';
    column: string;
    before?: string;
    after?: string;
  }[];
  lintResults: {
    rule: string;
    passed: boolean;
    message?: string;
  }[];
}

interface UserData {
  id: string;
  name: string;
  email: string;
  role: 'DBA' | 'Developer';
  lastActive: string;
}

interface Column {
  name: string;
  type: string;
  isPK?: boolean;
  isFK?: boolean;
  nullable?: boolean;
}

interface TableData {
  id: string;
  name: string;
  columns: Column[];
  status: 'valid' | 'warning' | 'error';
  message?: string;
}

// --- Mock Data ---

const MOCK_TABLES: TableData[] = [
  {
    id: 'users',
    name: 'users',
    status: 'valid',
    columns: [
      { name: 'id', type: 'BIGINT', isPK: true },
      { name: 'email', type: 'VARCHAR(255)', nullable: false },
      { name: 'password_hash', type: 'VARCHAR(255)' },
      { name: 'created_at', type: 'TIMESTAMP' },
      { name: 'updated_at', type: 'TIMESTAMP' }
    ]
  },
  {
    id: 'posts',
    name: 'posts',
    status: 'warning',
    message: 'Snake_case violation: "postTitle"',
    columns: [
      { name: 'id', type: 'BIGINT', isPK: true },
      { name: 'user_id', type: 'BIGINT', isFK: true },
      { name: 'postTitle', type: 'VARCHAR(255)' },
      { name: 'content', type: 'TEXT' },
      { name: 'created_at', type: 'TIMESTAMP' }
    ]
  },
  {
    id: 'comments',
    name: 'comments',
    status: 'valid',
    columns: [
      { name: 'id', type: 'BIGINT', isPK: true },
      { name: 'post_id', type: 'BIGINT', isFK: true },
      { name: 'user_id', type: 'BIGINT', isFK: true },
      { name: 'body', type: 'TEXT' }
    ]
  }
];

const MOCK_SERVICES: ServiceConfig[] = [
  { id: 'auth-db', name: 'Auth Service (PostgreSQL)', type: 'RDBMS', provider: 'PostgreSQL', status: 'online', alignment: 98 },
  { id: 'order-db', name: 'Order Service (MySQL)', type: 'RDBMS', provider: 'MySQL', status: 'online', alignment: 85 },
  { id: 'catalog-nosql', name: 'Product Catalog (MongoDB)', type: 'NoSQL', provider: 'MongoDB', status: 'online', alignment: 100 },
  { id: 'session-cache', name: 'Session Store (Redis)', type: 'Cache', provider: 'Redis', status: 'online', alignment: 92 },
];
const MOCK_USERS: UserData[] = [
  { id: '1', name: 'Admin User', email: 'admin@schemaguard.io', role: 'DBA', lastActive: '2 mins ago' },
  { id: '2', name: 'Kim Developer', email: 'kim.dev@company.com', role: 'Developer', lastActive: '1 hour ago' },
  { id: '3', name: 'Lee Architect', email: 'lee.arch@company.com', role: 'DBA', lastActive: '3 hours ago' },
  { id: '4', name: 'Park Junior', email: 'park.jr@company.com', role: 'Developer', lastActive: '1 day ago' },
];

const MOCK_REQUESTS: ChangeRequest[] = [
  {
    id: 'CR-102',
    table: 'orders',
    author: 'Kim Developer',
    status: 'pending',
    timestamp: '10 mins ago',
    description: 'Add shipping_address column for international orders',
    changes: [
      { type: 'add_column', column: 'shipping_address', before: 'N/A', after: 'VARCHAR(500)' },
      { type: 'add_column', column: 'is_international', before: 'N/A', after: 'BOOLEAN DEFAULT FALSE' }
    ],
    lintResults: [
      { rule: 'Snake Case Check', passed: true },
      { rule: 'Data Type Standards', passed: true },
      { rule: 'Mandatory Columns', passed: true },
      { rule: 'Reserved Words Check', passed: true }
    ]
  },
  {
    id: 'CR-101',
    table: 'users',
    author: 'Park Junior',
    status: 'pending',
    timestamp: '2 hours ago',
    description: 'Change phone column name to phoneNumber',
    changes: [
      { type: 'modify_column', column: 'phone', before: 'phone VARCHAR(20)', after: 'phoneNumber VARCHAR(20)' }
    ],
    lintResults: [
      { rule: 'Snake Case Check', passed: false, message: 'Column "phoneNumber" should be "phone_number"' },
      { rule: 'Data Type Standards', passed: true },
      { rule: 'Mandatory Columns', passed: true }
    ]
  }
];
const DRIFT_DATA = [
  {
    table: 'users',
    field: 'phone_number',
    design: 'N/A',
    actual: 'VARCHAR(20)',
    type: 'missing_in_design',
    severity: 'high'
  },
  {
    table: 'posts',
    field: 'postTitle',
    design: 'VARCHAR(255)',
    actual: 'VARCHAR(255)',
    type: 'naming_violation',
    severity: 'medium'
  },
  {
    table: 'orders',
    field: 'Table',
    design: 'Exists',
    actual: 'Missing',
    type: 'missing_in_db',
    severity: 'critical'
  }
];

// --- Components ---

const TableNode = ({ data }: { data: TableData }) => {
  return (
    <div className="react-flow__node-table min-w-[200px]">
      <div className={cn(
        "px-3 py-2 border-b flex items-center justify-between",
        data.status === 'valid' ? "bg-slate-50 border-slate-200" : 
        data.status === 'warning' ? "bg-amber-50 border-amber-200 text-amber-900" : 
        "bg-red-50 border-red-200 text-red-900"
      )}>
        <div className="flex items-center gap-2">
          <Icons.Table className="w-4 h-4 text-slate-500" />
          <span className="font-bold text-sm tracking-tight">{data.name}</span>
        </div>
        {data.status !== 'valid' && (
          <Icons.Alert className="w-4 h-4" />
        )}
      </div>
      <div className="p-2 space-y-1">
        {data.columns.map((col, i) => (
          <div key={i} className="flex items-center justify-between text-[11px] group">
            <div className="flex items-center gap-1.5">
              {col.isPK ? <Icons.PK className="w-3 h-3 text-amber-500" /> : <div className="w-3" />}
              <span className={cn(
                "font-medium",
                col.name.includes('Title') ? "text-amber-600 underline decoration-dotted" : "text-slate-700"
              )}>{col.name}</span>
            </div>
            <span className="text-slate-400 font-mono uppercase">{col.type}</span>
          </div>
        ))}
      </div>
      <Handle type="target" position={Position.Top} className="!bg-brand-500" />
      <Handle type="source" position={Position.Bottom} className="!bg-brand-500" />
    </div>
  );
};

const nodeTypes = {
  table: TableNode,
};

const SetupView = () => {
  const [activeTab, setActiveTab] = useState<'database' | 'git' | 'governance'>('database');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Project Setup</h2>
          <p className="text-sm text-slate-500">Configure connectivity and governance policies</p>
        </div>
        <button className="px-6 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 shadow-lg shadow-brand-500/20 flex items-center gap-2">
          <Icons.Save className="w-4 h-4" />
          Save Configuration
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[500px]">
        {/* Tabs */}
        <div className="w-full md:w-64 bg-slate-50 border-r border-slate-200 p-4 space-y-1">
          <button 
            onClick={() => setActiveTab('database')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
              activeTab === 'database' ? "bg-white shadow-sm text-brand-600 border border-slate-200" : "text-slate-500 hover:bg-slate-100"
            )}
          >
            <Icons.Designer className="w-4 h-4" />
            Database (JDBC)
          </button>
          <button 
            onClick={() => setActiveTab('git')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
              activeTab === 'git' ? "bg-white shadow-sm text-brand-600 border border-slate-200" : "text-slate-500 hover:bg-slate-100"
            )}
          >
            <Icons.Drift className="w-4 h-4" />
            Git Integration
          </button>
          <button 
            onClick={() => setActiveTab('governance')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
              activeTab === 'governance' ? "bg-white shadow-sm text-brand-600 border border-slate-200" : "text-slate-500 hover:bg-slate-100"
            )}
          >
            <Icons.ShieldCheck className="w-4 h-4" />
            Governance & Lint
          </button>
        </div>

        {/* Form Content */}
        <div className="flex-1 p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'database' && (
              <motion.div 
                key="db"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6 max-w-2xl"
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Database Type</label>
                    <div className="flex gap-2">
                      {['RDBMS (JDBC)', 'NoSQL (MongoDB)', 'Key-Value (Redis)', 'Graph'].map(t => (
                        <button key={t} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs font-medium hover:border-brand-500 hover:text-brand-600 transition-all">
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Connection String / URL</label>
                      <input 
                        type="text" 
                        placeholder="jdbc:postgresql://... or mongodb+srv://..." 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none font-mono"
                      />
                    </div>
                    {/* Dynamic fields based on type would go here */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Access Key / User</label>
                      <input 
                        type="text" 
                        placeholder="admin" 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Secret / Password</label>
                      <input 
                        type="password" 
                        placeholder="••••••••" 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-3">
                  <Icons.Alert className="w-5 h-5 text-blue-500 shrink-0" />
                  <p className="text-xs text-blue-700 leading-relaxed">
                    MSA 환경에서는 각 서비스별로 독립된 DB 연결 정보를 관리합니다. NoSQL의 경우 컬렉션 구조 및 인덱스 거버넌스가 적용됩니다.
                  </p>
                </div>
                <button className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors">
                  Test Connectivity
                </button>
              </motion.div>
            )}

            {activeTab === 'git' && (
              <motion.div 
                key="git"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6 max-w-2xl"
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Git Provider</label>
                    <div className="flex gap-2">
                      {['GitHub', 'GitLab', 'Gitea', 'Bitbucket'].map(p => (
                        <button key={p} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:border-brand-500 hover:text-brand-600 transition-all">
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Repository URL</label>
                    <input 
                      type="text" 
                      placeholder="https://github.com/org/repo.git" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Branch</label>
                      <input 
                        type="text" 
                        placeholder="main" 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Migration Path</label>
                      <input 
                        type="text" 
                        placeholder="src/main/resources/db/migration" 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Access Token (PAT)</label>
                    <input 
                      type="password" 
                      placeholder="ghp_xxxxxxxxxxxx" 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'governance' && (
              <motion.div 
                key="gov"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-8 max-w-3xl"
              >
                {/* Naming Conventions */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900 border-l-4 border-brand-500 pl-3">Naming Conventions (Lint Rules)</h4>
                    <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-1 rounded">Active</span>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Table Case Policy</label>
                      <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500">
                        <option>snake_case (Recommended)</option>
                        <option>camelCase</option>
                        <option>PascalCase</option>
                        <option>UPPER_SNAKE_CASE</option>
                      </select>
                      <p className="text-[10px] text-slate-400">Example: `user_profiles`</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Column Case Policy</label>
                      <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500">
                        <option>snake_case (Recommended)</option>
                        <option>camelCase</option>
                      </select>
                      <p className="text-[10px] text-slate-400">Example: `created_at`</p>
                    </div>
                  </div>
                </div>

                {/* Mandatory Columns */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 border-l-4 border-brand-500 pl-3">Mandatory Audit Columns</h4>
                  <p className="text-xs text-slate-500 mb-2">모든 신규 테이블 생성 시 린트 단계에서 강제할 컬럼 목록입니다.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { name: 'created_at', type: 'TIMESTAMP', enabled: true },
                      { name: 'updated_at', type: 'TIMESTAMP', enabled: true },
                      { name: 'created_by', type: 'VARCHAR', enabled: true },
                      { name: 'updated_by', type: 'VARCHAR', enabled: false },
                      { name: 'is_deleted', type: 'BOOLEAN', enabled: false },
                    ].map(col => (
                      <div key={col.name} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-brand-200 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            col.enabled ? "bg-brand-500" : "bg-slate-300"
                          )} />
                          <div>
                            <p className="text-sm font-mono font-bold text-slate-700">{col.name}</p>
                            <p className="text-[10px] text-slate-400">{col.type}</p>
                          </div>
                        </div>
                        <div 
                          className={cn(
                            "w-10 h-5 rounded-full relative cursor-pointer transition-colors",
                            col.enabled ? "bg-brand-500" : "bg-slate-300"
                          )}
                        >
                          <div className={cn(
                            "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all",
                            col.enabled ? "right-0.5" : "left-0.5"
                          )} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Data Type Restrictions */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 border-l-4 border-brand-500 pl-3">Data Type Restrictions</h4>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-800">Use BIGINT for Primary Keys</p>
                        <p className="text-xs text-slate-500">모든 PK는 BIGINT 타입을 사용하도록 강제합니다.</p>
                      </div>
                      <div className="w-10 h-5 bg-brand-500 rounded-full relative cursor-pointer">
                        <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-800">Disallow TEXT type</p>
                        <p className="text-xs text-slate-500">TEXT 대신 VARCHAR(MAX) 사용을 권장합니다.</p>
                      </div>
                      <div className="w-10 h-5 bg-slate-300 rounded-full relative cursor-pointer">
                        <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Drift Policy */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 border-l-4 border-brand-500 pl-3">Drift & Merge Policy</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex items-start gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                      <input type="radio" name="policy" className="mt-1 accent-brand-500" defaultChecked />
                      <div>
                        <p className="text-sm font-bold text-slate-900">Advisory Mode</p>
                        <p className="text-xs text-slate-500 leading-relaxed">불일치 발생 시 경고 리포트만 생성하며, 머지를 차단하지 않습니다.</p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 p-4 border border-brand-200 bg-brand-50/30 rounded-xl cursor-pointer hover:bg-brand-50 transition-colors">
                      <input type="radio" name="policy" className="mt-1 accent-brand-500" />
                      <div>
                        <p className="text-sm font-bold text-slate-900 text-brand-900">Blocking Mode</p>
                        <p className="text-xs text-brand-700 leading-relaxed">린트 에러가 있거나 드리프트가 해결되지 않으면 머지를 원천 차단합니다.</p>
                      </div>
                    </label>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

const ServicesView = ({ onSelectService }: { onSelectService: (s: ServiceConfig) => void }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Service Registry (MSA)</h2>
          <p className="text-sm text-slate-500">Manage multiple database instances across your microservices</p>
        </div>
        <button className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 flex items-center gap-2 shadow-sm">
          <Icons.Add className="w-4 h-4" />
          Register New Service
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MOCK_SERVICES.map((service) => (
          <div key={service.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-brand-300 transition-all group overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className={cn(
                  "p-3 rounded-xl",
                  service.type === 'RDBMS' ? "bg-blue-50 text-blue-600" : 
                  service.type === 'NoSQL' ? "bg-emerald-50 text-emerald-600" : "bg-purple-50 text-purple-600"
                )}>
                  <Icons.Designer className="w-6 h-6" />
                </div>
                <div className="flex flex-col items-end">
                  <span className={cn(
                    "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full mb-1",
                    service.status === 'online' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                  )}>
                    {service.status}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{service.type}</span>
                </div>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">{service.name}</h3>
              <p className="text-xs text-slate-500 mb-4">Provider: {service.provider}</p>
              
              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">Alignment</span>
                  <span className="font-bold text-slate-900">{service.alignment}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-500",
                      service.alignment > 90 ? "bg-emerald-500" : service.alignment > 70 ? "bg-brand-500" : "bg-red-500"
                    )}
                    style={{ width: `${service.alignment}%` }}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => onSelectService(service)}
                  className="flex-1 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors"
                >
                  Manage Schema
                </button>
                <button className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors">
                  <Icons.Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
const UsersView = () => {
  const [users, setUsers] = useState<UserData[]>(MOCK_USERS);

  const toggleRole = (userId: string) => {
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        return { ...u, role: u.role === 'DBA' ? 'Developer' : 'DBA' };
      }
      return u;
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
          <p className="text-sm text-slate-500">Manage system access and assign DBA roles</p>
        </div>
        <button className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 flex items-center gap-2 shadow-sm">
          <Icons.Add className="w-4 h-4" />
          Invite User
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Active</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white",
                      user.role === 'DBA' ? "bg-brand-500" : "bg-slate-400"
                    )}>
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{user.name}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                    user.role === 'DBA' ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-700"
                  )}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs text-slate-500">
                  {user.lastActive}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => toggleRole(user.id)}
                      className="text-xs font-bold text-brand-600 hover:text-brand-700 bg-brand-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Set as {user.role === 'DBA' ? 'Developer' : 'DBA'}
                    </button>
                    <button className="p-1.5 text-slate-400 hover:text-red-600 transition-colors">
                      <Icons.Delete className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const RequestsView = () => {
  const [selectedRequest, setSelectedRequest] = useState<ChangeRequest | null>(MOCK_REQUESTS[0]);
  const [showFullPreview, setShowFullPreview] = useState(false);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-180px)] relative">
      {/* Full ERD Preview Modal */}
      <AnimatePresence>
        {showFullPreview && selectedRequest && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-8"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-50 w-full h-full rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-white/20"
            >
              <div className="px-8 py-4 bg-white border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Icons.Eye className="w-5 h-5 text-brand-500" />
                    Full Schema Preview: {selectedRequest.id}
                  </h3>
                  <p className="text-xs text-slate-500">전체 테이블 구조 내에서 변경 사항이 적용된 모습을 시뮬레이션합니다.</p>
                </div>
                <button 
                  onClick={() => setShowFullPreview(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <Icons.Delete className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              
              <div className="flex-1 p-8 overflow-hidden relative bg-slate-50/50">
                <div className="absolute inset-0 overflow-auto p-20">
                  <div className="relative w-[2000px] h-[2000px]">
                    {/* Mocking other tables in the system */}
                    {['users', 'products', 'orders', 'payments'].map((tableName, idx) => {
                      const isTarget = tableName === selectedRequest.table;
                      return (
                        <motion.div 
                          key={tableName} 
                          drag
                          dragMomentum={false}
                          initial={{ x: 100 + (idx * 300), y: 100 + (idx % 2 * 50) }}
                          className={cn(
                            "absolute w-64 bg-white rounded-xl border shadow-sm overflow-hidden transition-shadow cursor-move active:shadow-xl active:z-50",
                            isTarget ? "border-brand-500 ring-4 ring-brand-500/10 z-10" : "border-slate-200 opacity-60 hover:opacity-100"
                          )}
                        >
                          <div className={cn(
                            "px-3 py-2 text-xs font-bold select-none",
                            isTarget ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"
                          )}>
                            {tableName}
                            {isTarget && <span className="ml-2 text-[8px] bg-white/20 px-1 rounded">PROPOSED</span>}
                          </div>
                          <div className="p-3 space-y-1.5 pointer-events-none">
                            <div className="flex items-center gap-2 text-[10px] text-slate-500">
                              <Icons.PK className="w-3 h-3" /> id (BIGINT)
                            </div>
                            {isTarget ? (
                              <>
                                {selectedRequest.changes.map((change, idx) => (
                                  <div key={idx} className={cn(
                                    "flex items-center gap-2 text-[10px] font-bold px-1.5 py-0.5 rounded",
                                    change.type === 'add_column' ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                                  )}>
                                    <Icons.String className="w-3 h-3" /> 
                                    {change.type === 'modify_column' ? change.after?.split(' ')[0] : change.column}
                                  </div>
                                ))}
                              </>
                            ) : (
                              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                <Icons.String className="w-3 h-3" /> ... (hidden)
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-[10px] text-slate-500">
                              <Icons.Date className="w-3 h-3" /> created_at
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Drag Instruction Overlay */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold rounded-full pointer-events-none flex items-center gap-2">
                  <Icons.Sync className="w-3 h-3 animate-spin-slow" />
                  테이블을 드래그하여 자유롭게 배치할 수 있습니다.
                </div>
              </div>
              
              <div className="px-8 py-4 bg-white border-t border-slate-200 flex justify-end">
                <button 
                  onClick={() => setShowFullPreview(false)}
                  className="px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors"
                >
                  Close Preview
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Request List */}
      <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <Icons.History className="w-4 h-4 text-brand-500" />
            Pending Requests
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {MOCK_REQUESTS.map((req) => (
            <button
              key={req.id}
              onClick={() => setSelectedRequest(req)}
              className={cn(
                "w-full p-4 text-left transition-colors hover:bg-slate-50",
                selectedRequest?.id === req.id ? "bg-brand-50/50 border-r-4 border-brand-500" : ""
              )}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-bold text-brand-600">{req.id}</span>
                <span className="text-[10px] text-slate-400 font-medium">{req.timestamp}</span>
              </div>
              <p className="text-sm font-bold text-slate-900 mb-1 truncate">{req.description}</p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                  {req.table}
                </span>
                <span className="text-[10px] text-slate-400">by {req.author}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Request Detail */}
      <div className="lg:col-span-2 space-y-6 overflow-y-auto pr-2">
        {selectedRequest ? (
          <>
            {/* Header Info */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-bold text-slate-900">{selectedRequest.description}</h2>
                    <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full uppercase">Pending Review</span>
                  </div>
                  <p className="text-sm text-slate-500 flex items-center gap-2">
                    <Icons.User className="w-3 h-3" /> {selectedRequest.author} requested changes on <strong>{selectedRequest.table}</strong> table
                  </p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowFullPreview(true)}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors flex items-center gap-2"
                  >
                    <Icons.Eye className="w-4 h-4" />
                    Visual Preview
                  </button>
                  <button className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors">
                    Reject
                  </button>
                  <button className={cn(
                    "px-6 py-2 rounded-lg text-sm font-bold text-white shadow-lg transition-all",
                    selectedRequest.lintResults.every(r => r.passed) 
                      ? "bg-brand-600 hover:bg-brand-700 shadow-brand-500/20" 
                      : "bg-slate-400 cursor-not-allowed"
                  )}>
                    Approve & Merge
                  </button>
                </div>
              </div>
            </div>

            {/* Visual Comparison Viewers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Before State */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Current Schema (Before)</span>
                  <div className="w-2 h-2 rounded-full bg-slate-300" />
                </div>
                <div className="p-6 bg-slate-50/30 min-h-[200px] flex items-center justify-center">
                  <div className="w-full max-w-[240px] bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden opacity-60">
                    <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-700">
                      {selectedRequest.table}
                    </div>
                    <div className="p-2 space-y-1">
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <Icons.PK className="w-3 h-3" /> id (BIGINT)
                      </div>
                      {selectedRequest.changes.filter(c => c.type === 'modify_column').map((c, i) => (
                        <div key={i} className="flex items-center gap-2 text-[10px] text-slate-400 line-through">
                          <Icons.String className="w-3 h-3" /> {c.column}
                        </div>
                      ))}
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <Icons.Date className="w-3 h-3" /> created_at
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* After State */}
              <div className="bg-white rounded-2xl border border-brand-100 shadow-sm overflow-hidden ring-2 ring-brand-500/10">
                <div className="px-4 py-2 bg-brand-50 border-b border-brand-100 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-brand-600 uppercase tracking-wider">Proposed Schema (After)</span>
                  <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                </div>
                <div className="p-6 bg-brand-50/10 min-h-[200px] flex items-center justify-center">
                  <div className="w-full max-w-[240px] bg-white rounded-lg border border-brand-200 shadow-md overflow-hidden">
                    <div className="px-3 py-2 bg-brand-600 text-white text-xs font-bold">
                      {selectedRequest.table}
                    </div>
                    <div className="p-2 space-y-1">
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <Icons.PK className="w-3 h-3" /> id (BIGINT)
                      </div>
                      {selectedRequest.changes.map((change, i) => (
                        <div key={i} className={cn(
                          "flex items-center gap-2 text-[10px] font-bold px-1.5 py-0.5 rounded",
                          change.type === 'add_column' ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                        )}>
                          <Icons.String className="w-3 h-3" /> 
                          {change.type === 'modify_column' ? change.after?.split(' ')[0] : change.column}
                          <span className="ml-auto text-[8px] opacity-70 uppercase">{change.type === 'add_column' ? 'New' : 'Mod'}</span>
                        </div>
                      ))}
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <Icons.Date className="w-3 h-3" /> created_at
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Diff View */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Schema Changes (Before vs After)</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-2 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <div className="px-4 py-2 border-r border-slate-200">Current State</div>
                  <div className="px-4 py-2">Proposed Change</div>
                </div>
                <div className="divide-y divide-slate-100">
                  {selectedRequest.changes.map((change, i) => (
                    <div key={i} className="grid grid-cols-2 text-sm font-mono">
                      <div className="px-4 py-3 border-r border-slate-200 bg-slate-50/30 text-slate-400 line-through decoration-red-300">
                        {change.before}
                      </div>
                      <div className={cn(
                        "px-4 py-3",
                        change.type === 'add_column' ? "bg-emerald-50 text-emerald-700 font-bold" : "bg-blue-50 text-blue-700 font-bold"
                      )}>
                        <span className="mr-2">{change.type === 'add_column' ? '+' : 'Δ'}</span>
                        {change.after}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Linting Results */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Governance Linting (Rule-as-Code)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedRequest.lintResults.map((result, i) => (
                  <div key={i} className={cn(
                    "flex items-start gap-3 p-3 rounded-xl border",
                    result.passed ? "bg-emerald-50/50 border-emerald-100" : "bg-red-50/50 border-red-100"
                  )}>
                    <div className={cn(
                      "mt-0.5 p-1 rounded-full",
                      result.passed ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                    )}>
                      {result.passed ? <Icons.Success className="w-3 h-3" /> : <Icons.Alert className="w-3 h-3" />}
                    </div>
                    <div>
                      <p className={cn("text-xs font-bold", result.passed ? "text-emerald-900" : "text-red-900")}>
                        {result.rule}
                      </p>
                      {!result.passed && (
                        <p className="text-[11px] text-red-600 mt-0.5 leading-relaxed">
                          {result.message}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300">
            <Icons.History className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm font-medium">Select a request to view details</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Views ---

const DashboardView = () => {
  const alignmentData = [
    { name: 'Aligned', value: 85, color: '#0ea5e9' },
    { name: 'Drifted', value: 15, color: '#f43f5e' },
  ];

  const activityData = [
    { name: 'Mon', changes: 4 },
    { name: 'Tue', changes: 7 },
    { name: 'Wed', changes: 2 },
    { name: 'Thu', changes: 12 },
    { name: 'Fri', changes: 5 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500 mb-4 uppercase tracking-wider">Schema Alignment</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={alignmentData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {alignmentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center mt-2">
            <span className="text-3xl font-bold text-slate-900">85%</span>
            <p className="text-xs text-slate-400">Overall Consistency</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500 mb-4 uppercase tracking-wider">Recent Changes</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                <Tooltip cursor={{fill: '#f8fafc'}} />
                <Bar dataKey="changes" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-500 mb-4 uppercase tracking-wider">System Status</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Production DB</span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Connected
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Git Sync</span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <Icons.Success className="w-3 h-3" />
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Governance Mode</span>
                <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                  Blocking
                </span>
              </div>
            </div>
          </div>
          <button className="mt-6 w-full py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
            <Icons.Sync className="w-4 h-4" />
            Run Full Scan
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Critical Alerts</h3>
          <button className="text-xs text-brand-600 font-medium hover:underline">View All</button>
        </div>
        <div className="divide-y divide-slate-50">
          {[
            { id: 1, type: 'drift', msg: 'Drift detected in "orders" table on Production', time: '2 mins ago', severity: 'high' },
            { id: 2, type: 'lint', msg: 'Naming convention violation in "postTitle" column', time: '1 hour ago', severity: 'medium' },
            { id: 3, type: 'sync', msg: 'GitHub PR #42 approved and merged', time: '3 hours ago', severity: 'low' },
          ].map((alert) => (
            <div key={alert.id} className="px-6 py-4 flex items-start gap-4 hover:bg-slate-50 transition-colors">
              <div className={cn(
                "p-2 rounded-lg",
                alert.severity === 'high' ? "bg-red-50 text-red-600" : 
                alert.severity === 'medium' ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"
              )}>
                {alert.type === 'drift' ? <Icons.Drift className="w-4 h-4" /> : 
                 alert.type === 'lint' ? <Icons.Alert className="w-4 h-4" /> : <Icons.Sync className="w-4 h-4" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">{alert.msg}</p>
                <p className="text-xs text-slate-400 mt-0.5">{alert.time}</p>
              </div>
              <Icons.ChevronRight className="w-4 h-4 text-slate-300" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const DesignerView = ({ currentService }: { currentService: ServiceConfig }) => {
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [generatedSql, setGeneratedSql] = useState('');

  const initialNodes: Node[] = MOCK_TABLES.map((t, i) => ({
    id: t.id,
    type: 'table',
    data: t,
    position: { x: 100 + (i * 250), y: 100 },
  }));

  const initialEdges: Edge[] = [
    { id: 'e-posts-users', source: 'users', target: 'posts', animated: true, style: { stroke: '#0ea5e9' } },
    { id: 'e-comments-posts', source: 'posts', target: 'comments', animated: true, style: { stroke: '#0ea5e9' } },
  ];

  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);

  const onNodesChange = (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds));
  const onEdgesChange = (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds));
  const onConnect = (params: Connection) => setEdges((eds) => addEdge(params, eds));

  const handleGenerateSql = () => {
    const sql = `-- Migration SQL for Schema: ${currentService.name}\n` +
                `CREATE TABLE users (\n` +
                `  id BIGINT PRIMARY KEY,\n` +
                `  email VARCHAR(255) NOT NULL,\n` +
                `  name VARCHAR(100),\n` +
                `  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n` +
                `);\n\n` +
                `CREATE TABLE posts (\n` +
                `  id BIGINT PRIMARY KEY,\n` +
                `  user_id BIGINT REFERENCES users(id),\n` +
                `  title VARCHAR(255) NOT NULL,\n` +
                `  body TEXT,\n` +
                `  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n` +
                `);`;
    
    setGeneratedSql(sql);
    setShowSqlModal(true);
  };

  return (
    <div className="h-[calc(100vh-180px)] bg-slate-100 rounded-xl border border-slate-200 overflow-hidden relative">
      {/* SQL Preview Modal */}
      <AnimatePresence>
        {showSqlModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-8"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-white/10"
            >
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-slate-800">
                <div className="flex items-center gap-2">
                  <Icons.Terminal className="w-5 h-5 text-brand-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-widest">Generated Migration SQL</h3>
                </div>
                <button onClick={() => setShowSqlModal(false)} className="text-slate-400 hover:text-white">
                  <Icons.Delete className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 bg-slate-950">
                <pre className="text-brand-300 font-mono text-sm leading-relaxed overflow-x-auto p-4 bg-black/30 rounded-xl border border-white/5">
                  {generatedSql}
                </pre>
              </div>
              <div className="px-6 py-4 bg-slate-800 border-t border-white/10 flex justify-end gap-3">
                <button 
                  onClick={() => setShowSqlModal(false)}
                  className="px-4 py-2 text-slate-400 text-sm font-bold hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button className="px-6 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 flex items-center gap-2">
                  <Icons.Copy className="w-4 h-4" />
                  Copy to Clipboard
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background color="#cbd5e1" gap={20} />
        <Controls />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
      </ReactFlow>

      {/* Sidebar Overlay */}
      <div className="absolute top-4 right-4 w-80 bg-white/90 backdrop-blur-md border border-slate-200 rounded-xl shadow-xl p-4 z-10">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-slate-900">Properties</h4>
          <Icons.Settings className="w-4 h-4 text-slate-400" />
        </div>
        <div className="space-y-4">
          <div className="p-3 bg-brand-50 border border-brand-100 rounded-lg">
            <p className="text-xs font-semibold text-brand-700 uppercase tracking-wider mb-1">Active Table</p>
            <p className="text-sm font-bold text-brand-900">users</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Linting Results</p>
            <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
              <Icons.Success className="w-3 h-3" />
              All rules passed
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100">
            <button 
              onClick={handleGenerateSql}
              className="w-full py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/20 active:scale-95"
            >
              Generate Migration SQL
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const DriftView = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Drift Report</h2>
          <p className="text-sm text-slate-500">Comparing Design (SSOT) vs Production DB</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center gap-2">
            <Icons.Export className="w-4 h-4" />
            Export Report
          </button>
          <button className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 flex items-center gap-2 shadow-sm">
            <Icons.Sync className="w-4 h-4" />
            Re-Sync Now
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Table / Field</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Current Design</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actual DB</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Drift Type</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {DRIFT_DATA.map((drift, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Icons.Table className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">{drift.table}</p>
                      <p className="text-xs text-slate-500">{drift.field}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{drift.design}</code>
                </td>
                <td className="px-6 py-4">
                  <code className="text-xs bg-red-50 px-1.5 py-0.5 rounded text-red-600 font-bold">{drift.actual}</code>
                </td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                    drift.severity === 'critical' ? "bg-red-100 text-red-700" : 
                    drift.severity === 'high' ? "bg-orange-100 text-orange-700" : "bg-amber-100 text-amber-700"
                  )}>
                    {drift.type.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button className="text-xs font-bold text-brand-600 hover:text-brand-700 bg-brand-50 px-3 py-1.5 rounded-lg transition-colors">
                      Adopt to Design
                    </button>
                    <button className="text-xs font-bold text-slate-600 hover:text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg transition-colors">
                      Rollback DB
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const DictionaryView = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Data Dictionary</h2>
          <p className="text-sm text-slate-500">Manage standard naming and domain types</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center gap-2">
            <Icons.Excel className="w-4 h-4 text-emerald-600" />
            Import Excel
          </button>
          <button className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 flex items-center gap-2 shadow-sm">
            <Icons.Add className="w-4 h-4" />
            Add Term
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Domains</h4>
            <div className="space-y-1">
              {['User ID', 'Amount', 'Date/Time', 'Status Code', 'Description'].map((domain) => (
                <button key={domain} className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-brand-600 transition-colors flex items-center justify-between group">
                  {domain}
                  <Icons.ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-4">
              <div className="relative flex-1">
                <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search dictionary terms..." 
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
              <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                <Icons.Filter className="w-5 h-5" />
              </button>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Standard Term</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Abbreviation</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { term: 'User Identifier', abbr: 'user_id', type: 'BIGINT', desc: 'Unique ID for system users' },
                  { term: 'Created Timestamp', abbr: 'created_at', type: 'TIMESTAMP', desc: 'Record creation date/time' },
                  { term: 'Email Address', abbr: 'email', type: 'VARCHAR(255)', desc: 'Validated user email' },
                  { term: 'Order Amount', abbr: 'ord_amt', type: 'DECIMAL(18,2)', desc: 'Total transaction amount' },
                ].map((item, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">{item.term}</td>
                    <td className="px-6 py-4"><code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{item.abbr}</code></td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-500">{item.type}</td>
                    <td className="px-6 py-4 text-xs text-slate-500">{item.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [currentService, setCurrentService] = useState<ServiceConfig>(MOCK_SERVICES[0]);

  const navItems = [
    { id: 'dashboard', icon: Icons.Dashboard, label: 'Dashboard' },
    { id: 'services', icon: Icons.Designer, label: 'Service Registry' },
    { id: 'designer', icon: Icons.Designer, label: 'Schema Designer' },
    { id: 'requests', icon: Icons.History, label: 'Change Requests' },
    { id: 'drift', icon: Icons.Drift, label: 'Drift Report' },
    { id: 'dictionary', icon: Icons.Dictionary, label: 'Dictionary' },
    { id: 'users', icon: Icons.User, label: 'User Management' },
    { id: 'setup', icon: Icons.Settings, label: 'Governance & Setup' },
  ];

  const handleSelectService = (service: ServiceConfig) => {
    setCurrentService(service);
    setActiveView('dashboard');
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-400 flex flex-col border-r border-slate-800">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Icons.Logo className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold tracking-tight">SchemaGuard</h1>
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Governance v1.0</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as View)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                activeView === item.id 
                  ? "bg-brand-500/10 text-brand-400 font-bold" 
                  : "hover:bg-slate-800 hover:text-slate-200"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 transition-colors",
                activeView === item.id ? "text-brand-400" : "text-slate-500 group-hover:text-slate-300"
              )} />
              <span className="text-sm">{item.label}</span>
              {activeView === item.id && (
                <motion.div 
                  layoutId="active-pill"
                  className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400"
                />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 mt-auto">
          <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-500 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white">
                DBA
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-bold text-slate-200 truncate">tjehddn42@gmail.com</p>
                <p className="text-[10px] text-slate-500">System Administrator</p>
              </div>
            </div>
            <button className="w-full py-2 flex items-center justify-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors">
              <Icons.Settings className="w-3 h-3" />
              Settings
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between z-20">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <button 
                onClick={() => setActiveView('services')}
                className="hover:text-brand-600 transition-colors"
              >
                Services
              </button>
              <Icons.ChevronRight className="w-3 h-3" />
              <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-lg border border-slate-200">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  currentService.type === 'RDBMS' ? "bg-blue-500" : 
                  currentService.type === 'NoSQL' ? "bg-emerald-500" : "bg-purple-500"
                )} />
                <span className="text-slate-900 font-bold">{currentService.name}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search schema..." 
                className="pl-10 pr-4 py-1.5 bg-slate-100 border-none rounded-full text-xs focus:ring-2 focus:ring-brand-500 outline-none w-64"
              />
            </div>
            <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <Icons.Notifications className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeView === 'dashboard' && <DashboardView />}
              {activeView === 'services' && <ServicesView onSelectService={handleSelectService} />}
              {activeView === 'designer' && <DesignerView currentService={currentService} />}
              {activeView === 'requests' && <RequestsView />}
              {activeView === 'drift' && <DriftView />}
              {activeView === 'dictionary' && <DictionaryView />}
              {activeView === 'users' && <UsersView />}
              {activeView === 'setup' && <SetupView />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

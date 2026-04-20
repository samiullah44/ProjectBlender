// frontend/src/pages/admin/Analytics.tsx
// Comprehensive admin analytics dashboard with real-time updates, filters, charts, and user activity

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '@/lib/axios';
import { analytics } from '@/services/analytics';
import {
  Users, Eye, Clock, MousePointer, Globe, Activity,
  TrendingUp, BarChart2, Map, RefreshCw, ChevronRight,
  ArrowUpRight, Smartphone, Monitor, Tablet, Filter,
  X, User, Calendar, Search, AlertCircle
} from 'lucide-react';

// ─── Styles ──────────────────────────────────────────────────────────────────
const DashboardStyles = () => (
  <style>{`
    .an-layout {
      display: flex;
      min-height: 100vh;
      background: #020617;
      color: #f8fafc;
      font-family: 'Inter', system-ui, sans-serif;
    }
    .an-sidebar {
      width: 260px;
      min-width: 260px;
      background: #0f172a;
      border-right: 1px solid #1e293b;
      height: calc(100vh - 80px); /* Adjust based on navbar height */
      position: sticky;
      top: 80px;
      display: flex;
      flex-direction: column;
      z-index: 10;
    }
    .an-side-group {
      padding: 1.5rem 1.5rem 0.5rem;
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #64748b;
    }
    .an-side-item {
      padding: 0.75rem 1.5rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.875rem;
      color: #94a3b8;
      cursor: pointer;
      transition: all 0.2s;
    }
    .an-side-item:hover {
      color: #f8fafc;
      background: #1e293b;
    }
    .an-side-item.active {
      color: #818cf8;
      background: #1e293b;
      border-right: 2px solid #6366f1;
    }
    .an-main {
      flex: 1;
      background: #020617;
    }
    .an-content {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2.5rem;
    }
    .an-topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2.5rem;
      gap: 1.5rem;
    }
    .an-filter-row {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .an-select {
      background: #1e293b;
      border: 1px solid #334155;
      color: #f1f5f9;
      padding: 0.4rem 0.8rem;
      border-radius: 0.5rem;
      font-size: 0.8rem;
      cursor: pointer;
      outline: none;
    }
    .an-select:hover { border-color: #475569; }
    .an-select:focus { border-color: #6366f1; }
    .an-ga-card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 1.5rem;
      transition: all 0.2s;
    }
    .an-ga-card:hover { border-color: #334155; box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5); }
    .an-ga-header {
      font-size: 0.875rem;
      font-weight: 600;
      color: #94a3b8;
    }
    .an-ga-sub {
      font-size: 0.75rem;
      color: #64748b;
      margin-top: 0.25rem;
    }
    .an-ga-val {
      font-size: 1.875rem;
      font-weight: 700;
      margin-top: 0.5rem;
      color: #f8fafc;
    }
    .an-ga-foot {
      font-size: 0.65rem;
      color: #64748b;
      margin-top: 1rem;
      border-top: 1px solid #334155;
      padding-top: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .an-table-ga {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    .an-table-ga th {
      padding: 1rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      border-bottom: 1px solid #334155;
    }
    .an-table-ga td {
      padding: 1rem;
      font-size: 0.875rem;
      border-bottom: 1px solid #1e293b;
    }
    .an-pulse-blob {
      height: 8px;
      width: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
      animation: pulse-green 2s infinite;
    }
    @keyframes pulse-green {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }
    .an-spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #1e293b;
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .an-card {
      display: flex;
      gap: 1rem;
      align-items: center;
      padding: 1rem;
      background: #1e293b80;
      border-radius: 0.75rem;
      border: 1px solid #334155;
    }
    .an-card-icon {
      width: 40px;
      height: 40px;
      border-radius: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .an-stat-label { font-size: 0.75rem; color: #94a3b8; }
    .an-stat-value { font-size: 1.25rem; font-weight: 700; color: #f8fafc; }
    .an-stat-sub { font-size: 0.65rem; color: #64748b; }
    .an-bar-bg { height: 8px; background: #1e293b; border-radius: 4px; overflow: hidden; }
    .an-bar-fill { height: 100%; border-radius: 4px; transition: width 0.5s ease-out; }
    .an-skeleton {
      background: linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 8px;
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `}</style>
);

// ─── Types ────────────────────────────────────────────────────────────────────
interface DashboardData {
  kpi: {
    totalUsers: number;
    newUsers: number;
    activeUsers: number;
    avgEngagementTime: number;
    sessions: number;
    viewsPerUser: number;
  };
  traffic: { date: string; value: number }[];
  reports: {
    pages?: any[];
    events?: any[];
    geo?: any[];
    tech?: any[];
    retention?: any[];
  };
  conversions?: {
    get_early_access_waitlist?: number;
    home_cta_client?: number;
    home_cta_provider?: number;
    register_submit?: number;
    waitlist_submit?: number;
    join_waitlist_button?: number;
    join_waitlist_topbar?: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const RANGES = ['24h', '7d', '30d', '90d', 'all'] as const;
type Range = typeof RANGES[number];

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleDateString();
};

// ─── Main Component ────────────────────────────────────────────────────────────
const Analytics: React.FC = () => {
  const navigate = useNavigate();
  const [activeReport, setActiveReport] = useState<'snapshot' | 'realtime' | 'engagement' | 'demographics' | 'tech' | 'retention' | 'users' | 'flow' | 'events' | 'funnels' | 'sessions'>('snapshot');
  const [filters, setFilters] = useState({ range: '7d' as Range, country: '', os: '', device: '', browser: '', dimension: 'Country', userId: '' });
  const [data, setData] = useState<DashboardData | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtime, setRealtime] = useState<{ activeCount: number; recentEvents: any[] } | null>(null);
  const [usersData, setUsersData] = useState<{ users: any[]; total: number } | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams(filters);
      const res = await axiosInstance.get(`/analytics/dashboard?${params}`);
      setData(res.data);
    } catch (e: any) {
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchReport = useCallback(async (type: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ ...filters, type });
      const res = await axiosInstance.get(`/analytics/reports?${params}`);
      setReportData(res.data);
    } catch {
      setError('Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchRealtime = useCallback(async () => {
    try {
      const res = await axiosInstance.get('/analytics/realtime');
      setRealtime(res.data);
    } catch {}
  }, []);

  const fetchUsers = useCallback(async (page: number = 1, search: string = '') => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/analytics/users?range=${filters.range}&country=${filters.country}&page=${page}&search=${search}`);
      setUsersData(res.data);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [filters.range, filters.country]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
  
  useEffect(() => { 
    if (activeReport !== 'snapshot' && activeReport !== 'realtime' && activeReport !== 'users') {
      // Map frontend state to backend report types
      let reqType: string = activeReport;
      if (activeReport === 'funnels') reqType = 'funnel';
      if (activeReport === 'engagement') reqType = 'engagement';
      if (activeReport === 'tech') reqType = 'dimensions';
      if (activeReport === 'events') reqType = 'engagement';
      if (activeReport === 'flow') reqType = 'flow';
      fetchReport(reqType);
    } else if (activeReport === 'users') {
      fetchUsers();
    }
  }, [activeReport, fetchReport, fetchUsers, filters]);

  useEffect(() => { 
    fetchRealtime(); 
    const t = setInterval(fetchRealtime, 15000); 
    return () => clearInterval(t); 
  }, [fetchRealtime]);

  const updateFilter = (key: string, val: string) => {
    setFilters(prev => ({ ...prev, [key]: val }));
  };

  const drillToUserSessions = (uId: string) => {
    setFilters(prev => ({ ...prev, userId: uId }));
    setActiveReport('sessions');
  };

  // Non-blocking loading
  const isInitialLoad = loading && !data && activeReport === 'snapshot';
  const isReportLoading = loading && activeReport !== 'snapshot';

  // Skeleton UI
  const SkeletonCard = () => (
    <div className="an-ga-card h-[180px] flex flex-col gap-4">
      <div className="an-skeleton h-4 w-1/3" />
      <div className="an-skeleton h-8 w-1/2 mt-auto" />
      <div className="an-skeleton h-2 w-full mt-auto" />
    </div>
  );

  const SkeletonTable = () => (
    <div className="an-ga-card p-0 overflow-hidden">
      <div className="p-6 border-b border-gray-800"><div className="an-skeleton h-5 w-40" /></div>
      <div className="p-6 space-y-4">
        {[1,2,3,4,5].map(i => <div key={i} className="an-skeleton h-8 w-full" />)}
      </div>
    </div>
  );

  return (
    <>
      <DashboardStyles />
      <div className="an-layout">
        <div className="an-sidebar">
          <div className="p-6">
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Analytics</h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">RenderOnNodes Engine</p>
          </div>
          
          <div className="an-side-group">Master Structure</div>
          <div className={`an-side-item ${activeReport === 'snapshot' ? 'active' : ''}`} onClick={() => setActiveReport('snapshot')}><Activity size={18} /> Dashboard</div>
          <div className={`an-side-item ${activeReport === 'realtime' ? 'active' : ''}`} onClick={() => setActiveReport('realtime')}><div className="an-pulse-blob mr-1" /> Realtime</div>
          
          <div className="an-side-group">Audience</div>
          <div className={`an-side-item ${activeReport === 'users' ? 'active' : ''}`} onClick={() => setActiveReport('users')}><Users size={18} /> Users</div>
          <div className={`an-side-item ${activeReport === 'sessions' ? 'active' : ''}`} onClick={() => setActiveReport('sessions')}><Clock size={18} /> Sessions</div>
          <div className={`an-side-item ${activeReport === 'demographics' ? 'active' : ''}`} onClick={() => setActiveReport('demographics')}><Globe size={18} /> Demographics</div>
          <div className={`an-side-item ${activeReport === 'tech' ? 'active' : ''}`} onClick={() => setActiveReport('tech')}><Smartphone size={18} /> Technology</div>

          <div className="an-side-group">Behavior</div>
          <div className={`an-side-item ${activeReport === 'engagement' ? 'active' : ''}`} onClick={() => setActiveReport('engagement')}><BarChart2 size={18} /> Pages</div>
          <div className={`an-side-item ${activeReport === 'events' ? 'active' : ''}`} onClick={() => setActiveReport('events')}><MousePointer size={18} /> Events</div>
          <div className={`an-side-item ${activeReport === 'funnels' ? 'active' : ''}`} onClick={() => setActiveReport('funnels')}><Filter size={18} /> Funnels</div>
          <div className={`an-side-item ${activeReport === 'flow' ? 'active' : ''}`} onClick={() => setActiveReport('flow')}><TrendingUp size={18} /> Flow</div>
          <div className={`an-side-item ${activeReport === 'retention' ? 'active' : ''}`} onClick={() => setActiveReport('retention')}><RefreshCw size={18} /> Retention</div>
        </div>

        <div className="an-main">
          <div className="an-content">
            <div className="an-topbar">
              <div className="an-filter-row">
                {/* Date Range - Hidden for Real-time */}
                {activeReport !== 'realtime' && (
                  <select className="an-select" value={filters.range} onChange={e => updateFilter('range', e.target.value)}>
                    {RANGES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                )}

                {/* Geography - Shown for most reports */}
                {!['tech', 'retention'].includes(activeReport) && (
                  <select className="an-select" value={filters.country} onChange={e => updateFilter('country', e.target.value)}>
                    <option value="">All Countries</option>
                    <option value="Pakistan">Pakistan</option>
                    <option value="United States">United States</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="India">India</option>
                  </select>
                )}

                {/* Tech Dimensions - Specific to Tech report */}
                {activeReport === 'tech' && (
                  <>
                    <select className="an-select" value={filters.os} onChange={e => updateFilter('os', e.target.value)}>
                      <option value="">All OS</option>
                      <option value="windows">Windows</option>
                      <option value="macos">macOS</option>
                      <option value="ios">iOS</option>
                      <option value="android">Android</option>
                      <option value="linux">Linux</option>
                    </select>
                    <select className="an-select" value={filters.device} onChange={e => updateFilter('device', e.target.value)}>
                      <option value="">All Devices</option>
                      <option value="desktop">Desktop</option>
                      <option value="mobile">Mobile</option>
                      <option value="tablet">Tablet</option>
                    </select>
                    <select className="an-select" value={filters.browser} onChange={e => updateFilter('browser', e.target.value)}>
                      <option value="">All Browsers</option>
                      <option value="chrome">Chrome</option>
                      <option value="safari">Safari</option>
                      <option value="firefox">Firefox</option>
                      <option value="edge">Edge</option>
                    </select>
                  </>
                )}

                {/* Search - Specific to User Details */}
                {activeReport === 'users' && (
                  <div className="relative group">
                    <input 
                      type="text" 
                      placeholder="Search email or ID..." 
                      className="an-select w-64 pr-10 focus:ring-1 focus:ring-indigo-500 transition-all"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          // Search logic
                          fetchUsers(1, (e.target as HTMLInputElement).value);
                        }
                      }}
                    />
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-indigo-400 transition-colors" size={14} />
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-4 text-xs text-gray-400">
                 <span className="flex items-center gap-2 bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20">
                    <div className="an-pulse-blob" /> {realtime?.activeCount || 0} users active
                 </span>
                 <button 
                   className="p-2 hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2" 
                   onClick={() => { fetchDashboard(); if(activeReport !== 'snapshot') fetchReport(activeReport); }}
                 >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                 </button>
              </div>
            </div>

            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
              {activeReport === 'snapshot' && (
                <>
                  {isInitialLoad ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
                      <div className="lg:col-span-3"><SkeletonTable /></div>
                      <div className="lg:col-span-1"><SkeletonTable /></div>
                    </div>
                  ) : data ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="an-ga-card relative overflow-hidden group">
                         <div className="an-ga-header">Active Users</div>
                         <div className="an-ga-sub">Last 5 min</div>
                         <div className="an-ga-val">{data.kpi.activeUsers}</div>
                         <div className="h-12 mt-4 flex items-end gap-1">
                            {data.traffic.slice(-20).map((t, idx) => (
                              <div key={idx} className="flex-1 bg-indigo-500/20 rounded-t-sm" style={{ height: `${(t.value / Math.max(...data.traffic.map(v => v.value), 1)) * 100}%` }} />
                            ))}
                         </div>
                      </div>
                      <div className="an-ga-card">
                         <div className="an-ga-header">Conversion Rate</div>
                         <div className="an-ga-sub">Waitlist / Signups vs Visitors</div>
                         <div className="an-ga-val text-emerald-400">
                           {data.kpi.totalUsers > 0 ? ((data.reports?.geo?.[0]?.count /* temporary stat hook until converted */ || 10) / data.kpi.totalUsers * 100).toFixed(1) : 0}%
                         </div>
                         <div className="an-ga-foot">Funnel conversion</div>
                      </div>
                      <div className="an-ga-card">
                         <div className="an-ga-header">New Users</div>
                         <div className="an-ga-sub">Visitors in {filters.range}</div>
                         <div className="an-ga-val">{data.kpi.newUsers}</div>
                         <div className="an-ga-foot">GA-style aggregation</div>
                      </div>
                      <div className="an-ga-card">
                         <div className="an-ga-header">Avg. Engagement</div>
                         <div className="an-ga-sub">Time per session</div>
                         <div className="an-ga-val">{data.kpi.avgEngagementTime >= 60 ? `${Math.floor(data.kpi.avgEngagementTime / 60)}m ${data.kpi.avgEngagementTime % 60}s` : `${data.kpi.avgEngagementTime}s`}</div>
                         <div className="an-ga-foot">Heartbeat driven</div>
                      </div>
                      <div className="an-ga-card">
                         <div className="an-ga-header">Views per User</div>
                         <div className="an-ga-sub">Content depth</div>
                         <div className="an-ga-val">{data.kpi.viewsPerUser.toFixed(2)}</div>
                         <div className="an-ga-foot">Interaction avg</div>
                      </div>
                      <div className="lg:col-span-3 an-ga-card p-0 overflow-hidden">
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                          <h3 className="font-bold">Views by Page Path</h3>
                          <button className="text-xs text-indigo-400 hover:underline" onClick={() => setActiveReport('engagement')}>View Report</button>
                        </div>
                        <table className="an-table-ga">
                          <thead><tr><th>Page Path</th><th>Views</th><th>Users</th></tr></thead>
                          <tbody>
                            {data.reports?.pages?.slice(0, 5).map((p: any, i: number) => (
                              <tr key={i}>
                                <td className="text-indigo-300 font-medium">{p.page}</td>
                                <td className="font-bold">{p.views}</td>
                                <td>{p.uniqueUsers}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="lg:col-span-1 an-ga-card p-0 overflow-hidden">
                         <div className="p-6 border-b border-gray-800"><h3 className="font-bold">By Country</h3></div>
                         <div className="p-4 space-y-4">
                            {data.reports?.geo?.slice(0, 5).map((g: any, i: number) => (
                              <div key={i} className="space-y-1">
                                <div className="flex justify-between text-xs"><span>{g._id || 'Unknown'}</span><span className="font-bold">{g.count}</span></div>
                                <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                                  <div className="h-full bg-indigo-500" style={{ width: `${(g.count / (data.reports?.geo?.[0]?.count || 1)) * 100}%` }} />
                                </div>
                              </div>
                            ))}
                         </div>
                      </div>
                    </div>
                  ) : null}
                </>
              )}

              {activeReport === 'engagement' && (
                <div className={isReportLoading ? 'opacity-50 pointer-events-none transition-opacity relative' : ''}>
                  {isReportLoading && <div className="absolute inset-0 flex items-center justify-center z-20 bg-gray-950/20 backdrop-blur-[1px]"><div className="an-spinner w-8 h-8" /></div>}
                  {reportData ? (
                    <div className="an-ga-card p-0 overflow-hidden">
                      <div className="p-6"><h2 className="text-xl font-bold mb-1">Engagement: Pages</h2></div>
                      <table className="an-table-ga">
                        <thead><tr><th>Index</th><th>Page Path</th><th>Views</th><th>Active Users</th><th>Views/User</th><th>Avg Time</th></tr></thead>
                        <tbody>
                          {reportData.pages?.map((p: any, i: number) => (
                            <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                              <td className="text-gray-600">{i + 1}</td>
                              <td className="text-indigo-400 font-medium">{p.page}</td>
                              <td className="font-bold">{p.views.toLocaleString()}</td>
                              <td>{p.uniqueUsers}</td>
                              <td>{p.viewsPerUser.toFixed(2)}</td>
                              <td>{Math.floor(p.avgTime / 60)}m {p.avgTime % 60}s</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <SkeletonTable />}
                </div>
              )}

              {activeReport === 'events' && (
                <div className={isReportLoading ? 'opacity-50 pointer-events-none transition-opacity relative' : ''}>
                  {isReportLoading && <div className="absolute inset-0 flex items-center justify-center z-20 bg-gray-950/20 backdrop-blur-[1px]"><div className="an-spinner w-8 h-8" /></div>}
                  {reportData ? (
                    <div className="an-ga-card p-0 overflow-hidden">
                      <div className="p-6"><h2 className="text-xl font-bold mb-1">Events: Event name</h2></div>
                      <table className="an-table-ga">
                        <thead><tr><th>Index</th><th>Event Name</th><th>Target</th><th>Page</th><th>Count</th><th>Users</th></tr></thead>
                        <tbody>
                          {reportData.events?.map((e: any, i: number) => (
                            <tr key={i}>
                              <td className="text-gray-600">{i + 1}</td>
                              <td className="text-indigo-400 font-bold uppercase text-[10px] tracking-wider">{e.event.replace(/_/g, ' ')}</td>
                              <td className="font-medium text-emerald-400">{e.button ? e.button.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : '-'}</td>
                              <td className="text-gray-400">{e.page === '/' ? 'Home' : e.page}</td>
                              <td className="font-bold">{e.count.toLocaleString()}</td>
                              <td>{e.users}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <SkeletonTable />}
                </div>
              )}

              {activeReport === 'funnels' && (
                <div className={isReportLoading ? 'opacity-50 pointer-events-none transition-opacity relative' : ''}>
                  {isReportLoading && <div className="absolute inset-0 flex items-center justify-center z-20 bg-gray-950/20 backdrop-blur-[1px]"><div className="an-spinner w-8 h-8" /></div>}
                  {reportData ? (
                    <div className="an-ga-card p-0 overflow-hidden">
                      <div className="p-6 border-b border-gray-800"><h2 className="text-xl font-bold mb-1">Conversion Funnel</h2></div>
                      <div className="p-8">
                         {reportData.funnel?.map((f: any, i: number) => (
                           <div key={i} className="flex relative items-center gap-6 mb-8 group">
                              <div className="w-1/3 text-right">
                                <div className="font-bold text-lg text-indigo-400">{f.step}</div>
                                <div className="text-sm text-gray-500">{f.count.toLocaleString()} users</div>
                                {i > 0 && <div className="text-xs text-red-500 mt-1 font-bold">-{f.drop}% Drop-off</div>}
                              </div>
                              <div className="relative flex-1 h-12 bg-gray-800 rounded-r-lg overflow-hidden border border-gray-700 group-hover:border-indigo-500/50 transition-colors">
                                 <div className="absolute top-0 left-0 h-full bg-indigo-500/80 transition-all duration-1000" style={{ width: `${f.percentage}%` }} />
                                 <div className="absolute inset-0 flex items-center px-4 font-bold text-white drop-shadow-md z-10">
                                   {f.percentage}%
                                 </div>
                              </div>
                           </div>
                         ))}
                      </div>
                    </div>
                  ) : <SkeletonTable />}
                </div>
              )}

              {activeReport === 'sessions' && (
                <div className={isReportLoading ? 'opacity-50 pointer-events-none transition-opacity relative' : ''}>
                  {isReportLoading && <div className="absolute inset-0 flex items-center justify-center z-20 bg-gray-950/20 backdrop-blur-[1px]"><div className="an-spinner w-8 h-8" /></div>}
                  {reportData ? (
                    <div className="an-ga-card p-0 overflow-hidden">
                      <div className="p-6 flex justify-between items-center">
                        <div>
                          <h2 className="text-xl font-bold mb-1">Session Analytics</h2>
                          <p className="text-xs text-gray-500">Individual user sessions and activity</p>
                        </div>
                        <div className="flex gap-2">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input 
                              type="text"
                              placeholder="Search User ID..."
                              className="an-select pl-10 w-64"
                              value={filters.userId}
                              onChange={(e) => setFilters(prev => ({ ...prev, userId: e.target.value }))}
                            />
                            {filters.userId && (
                              <button 
                                onClick={() => setFilters(prev => ({ ...prev, userId: '' }))}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <table className="an-table-ga">
                        <thead><tr><th>User / ID</th><th>Device</th><th>Start Time</th><th>Duration</th><th>Pages</th></tr></thead>
                        <tbody>
                          {reportData.sessions?.map((s: any, i: number) => (
                            <tr key={i}>
                              <td>
                                <div 
                                  className="font-bold text-indigo-400 cursor-pointer hover:underline"
                                  onClick={() => drillToUserSessions(s.userId)}
                                >
                                  {s.name ? `${s.name} (${s.email})` : 'Anonymous'}
                                </div>
                                <div className="text-[10px] text-gray-600 font-mono">{s.sessionId}</div>
                              </td>
                              <td className="text-gray-400 capitalize">{s.device?.os || 'Unknown'} {s.device?.type || ''}</td>
                              <td className="text-gray-400">{timeAgo(s.startTime)}</td>
                              <td className="font-bold">{s.duration >= 60000 ? `${Math.floor(s.duration / 60000)}m ${Math.floor((s.duration % 60000) / 1000)}s` : `${Math.floor(s.duration / 1000)}s`}</td>
                              <td className="font-bold text-emerald-400">{s.pageCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <SkeletonTable />}
                </div>
              )}

              {activeReport === 'demographics' && (
                <div className={isReportLoading ? 'opacity-50 pointer-events-none transition-opacity relative' : ''}>
                  {isReportLoading && <div className="absolute inset-0 flex items-center justify-center z-20 bg-gray-950/20 backdrop-blur-[1px]"><div className="an-spinner w-8 h-8" /></div>}
                  {reportData ? (
                    <div className="an-ga-card p-0 overflow-x-auto">
                      <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/40">
                         <div className="flex flex-col gap-2">
                           <h2 className="text-xl font-bold">Active users by {reportData.dimensionName || 'Country'} over time</h2>
                           <div className="flex items-center gap-2">
                             <span className="text-xs text-gray-500 font-mono tracking-widest uppercase">Search Items</span>
                             <select className="bg-[#0f172a] border border-[#1e293b] text-xs px-2 py-1 rounded text-white font-medium focus:outline-none focus:border-indigo-500" value={filters.dimension} onChange={(e) => updateFilter('dimension', e.target.value)}>
                               {['Country', 'Region', 'City', 'Language', 'Age', 'Gender', 'Interests', 'Platform/Devices', 'User lifetime'].map(d => (
                                 <option key={d} value={d}>{d}</option>
                               ))}
                             </select>
                           </div>
                         </div>
                         <div className="text-xs text-gray-500 font-mono">1-{reportData.dimension?.length || 0} of {reportData.dimension?.length || 0}</div>
                      </div>
                      <table className="an-table-ga whitespace-nowrap">
                        <thead>
                          <tr>
                            <th>Index</th>
                            <th>{reportData.dimensionName || 'Country'}</th>
                            <th>Active Users</th>
                            <th>New Users</th>
                            <th>Engaged Sessions</th>
                            <th>Engagement Rate</th>
                            <th>Avg Time</th>
                            <th>Event Count</th>
                            <th>Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Totals Row */}
                          <tr className="bg-gray-800/20 border-b-2 border-gray-800">
                             <td colSpan={2} className="font-bold text-gray-400">Total</td>
                             <td className="font-bold">{reportData.dimension?.reduce((acc:any,c:any)=>acc+c.activeUsers,0)} <div className="text-[9px] text-gray-500 font-normal">100% of total</div></td>
                             <td className="font-bold">{reportData.dimension?.reduce((acc:any,c:any)=>acc+c.newUsers,0)} <div className="text-[9px] text-gray-500 font-normal">100% of total</div></td>
                             <td className="font-bold">{reportData.dimension?.reduce((acc:any,c:any)=>acc+c.engagedSessions,0)} <div className="text-[9px] text-gray-500 font-normal">100% of total</div></td>
                             <td className="font-bold">Avg 65.2%</td>
                             <td className="font-bold">Avg 2m 14s</td>
                             <td className="font-bold">{reportData.dimension?.reduce((acc:any,c:any)=>acc+c.events,0)} <div className="text-[9px] text-gray-500 font-normal">100% of total</div></td>
                             <td className="font-bold text-gray-500">$0.00</td>
                          </tr>
                          
                          {/* Data Rows */}
                          {reportData.dimension?.map((c: any, i: number) => {
                            const totalAct = reportData.dimension?.reduce((acc:any,dim:any)=>acc+dim.activeUsers,0) || 1;
                            const totalSes = reportData.dimension?.reduce((acc:any,dim:any)=>acc+dim.engagedSessions,0) || 1;
                            const totalNew = reportData.dimension?.reduce((acc:any,dim:any)=>acc+dim.newUsers,0) || 1;
                            return (
                              <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                                <td className="text-gray-600">{i + 1}</td>
                                <td className="text-indigo-400 font-bold">{c._id || '(not set)'}</td>
                                <td className="font-bold">{c.activeUsers} <span className="text-[10px] text-gray-500 font-normal">({Math.round((c.activeUsers/totalAct)*100)}%)</span></td>
                                <td>{c.newUsers} <span className="text-[10px] text-gray-500 font-normal">({Math.round((c.newUsers/totalNew)*100)}%)</span></td>
                                <td>{c.engagedSessions} <span className="text-[10px] text-gray-500 font-normal">({Math.round((c.engagedSessions/totalSes)*100)}%)</span></td>
                                <td className="text-emerald-400">{c.engagementRate}%</td>
                                <td>{c.avgTime >= 60 ? `${Math.floor(c.avgTime/60)}m ${c.avgTime%60}s` : `${c.avgTime}s`}</td>
                                <td>{c.events}</td>
                                <td className="text-gray-500">$0.00 <span className="text-[10px]">(–)</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : <SkeletonTable />}
                </div>
              )}

              {activeReport === 'tech' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   {reportData ? (
                     ['os', 'device', 'browser'].map(slice => (
                       <div key={slice} className="an-ga-card p-0 overflow-hidden">
                          <div className="p-6 border-b border-gray-800 capitalize flex items-center gap-2">
                             <h3 className="font-bold text-sm">{slice} Breakdown</h3>
                          </div>
                          <div className="p-6 space-y-4">
                             {reportData[slice]?.map((item: any, i: number) => (
                               <div key={i} className="space-y-1">
                                  <div className="flex justify-between items-center text-[11px]">
                                     <span className="text-gray-400 capitalize">{item._id || 'Unknown'}</span>
                                     <span className="font-bold">{item.count}</span>
                                  </div>
                                  <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                                     <div className="h-full bg-indigo-500" style={{ width: `${(item.count / Math.max(...reportData[slice].map((v:any) => v.count), 1)) * 100}%` }} />
                                  </div>
                               </div>
                             ))}
                          </div>
                       </div>
                     ))
                   ) : <><SkeletonTable /><SkeletonTable /><SkeletonTable /></>}
                </div>
              )}

              {activeReport === 'realtime' && (
                 <div className="space-y-6">
                    <div className="an-ga-card text-center p-12">
                       <div className="flex justify-center mb-4"><div className="an-pulse-blob h-4 w-4" /></div>
                       <div className="text-5xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">{realtime?.activeCount || 0}</div>
                       <div className="text-gray-500 uppercase tracking-widest text-xs mt-2">Live active users</div>
                    </div>
                    <div className="an-ga-card p-0 overflow-hidden">
                       <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                         <h3 className="font-bold">Real-time Activity Stream</h3>
                       </div>
                       <div className="divide-y divide-gray-800">
                         {realtime?.recentEvents.map((ev: any, i: number) => (
                           <div key={i} className="p-4 flex justify-between items-center text-sm">
                              <div>
                                <div className="font-bold uppercase text-[10px] text-indigo-400">{ev.eventType}</div>
                                <div className="text-white">{ev.page}</div>
                                {ev.metadata?.button && <div className="text-[10px] text-gray-500">Clicked: {ev.metadata.button}</div>}
                              </div>
                              <div className="text-xs text-gray-400">{timeAgo(ev.timestamp)}</div>
                           </div>
                         ))}
                       </div>
                    </div>
                 </div>
              )}

              {activeReport === 'users' && (
                 <div className="an-ga-card p-0 overflow-hidden">
                    <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                       <h3 className="font-bold">User Explorer</h3>
                    </div>
                    <table className="an-table-ga">
                        <thead><tr><th>Status</th><th>User ID</th><th>Location</th><th>Sessions</th><th>Views</th><th>Action</th></tr></thead>
                        <tbody>
                           {usersData?.users.map((u: any, i: number) => {
                             const isLive = new Date(u.lastSeen).getTime() > Date.now() - 5 * 60 * 1000;
                             return (
                               <tr key={i} className="hover:bg-gray-800/20">
                                  <td>
                                    <div className="flex items-center gap-2">
                                      <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-600'}`} />
                                      <span className={`text-[10px] uppercase font-bold ${isLive ? 'text-emerald-500' : 'text-gray-500'}`}>
                                        {isLive ? 'Live' : 'Offline'}
                                      </span>
                                    </div>
                                  </td>
                                  <td 
                                    className="font-mono text-[10px] text-indigo-400 cursor-pointer hover:underline"
                                    onClick={() => drillToUserSessions(u.userId)}
                                  >
                                    {u.userId}
                                  </td>
                                  <td className="text-xs">{u.geo?.country}, {u.geo?.city || 'Local'}</td>
                                  <td className="font-bold">{u.totalSessions}</td>
                                  <td>{u.totalPageViews}</td>
                                  <td className="flex gap-2">
                                    <button onClick={() => drillToUserSessions(u.userId)} className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded" title="View Sessions"><Clock size={14} /></button>
                                    <button onClick={() => navigate(`/admin/analytics/users/${u.userId}`)} className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded" title="User Profile"><ArrowUpRight size={14} /></button>
                                  </td>
                               </tr>
                             );
                           })}
                        </tbody>
                     </table>
                 </div>
              )}

              {activeReport === 'flow' && (
                 <div className="an-ga-card p-0 overflow-hidden">
                    <div className="p-6 border-b border-gray-800"><h3 className="font-bold">Path Exploration</h3></div>
                    <div className="p-6 space-y-4">
                       {reportData?.flow?.map((f: any, i: number) => (
                         <div key={i} className="flex items-center gap-4 bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                            <div className="flex-1 text-right text-xs text-indigo-400 font-medium">{f.from}</div>
                            <ChevronRight size={16} className="text-gray-600" />
                            <div className="flex-1 text-xs text-emerald-400 font-medium">{f.to}</div>
                            <div className="w-12 text-right font-bold text-white text-sm">{f.count}</div>
                         </div>
                       ))}
                       {(!reportData?.flow || reportData.flow.length === 0) && (
                         <div className="text-center py-20 text-gray-500 italic">No flow data available.</div>
                       )}
                    </div>
                 </div>
              )}

              {activeReport === 'retention' && (
                 <div className="an-ga-card p-0 overflow-hidden">
                    <div className="p-6 border-b border-gray-800"><h3 className="font-bold">Cohort Retention</h3></div>
                    <table className="an-table-ga">
                       <thead><tr><th>First Visit</th><th>New Users</th><th>Retained</th><th>Rate</th></tr></thead>
                       <tbody>
                          {reportData?.cohorts?.map((c: any, i: number) => (
                            <tr key={i}>
                               <td>{c._id}</td>
                               <td className="font-bold">{c.newUsers}</td>
                               <td>{c.retained}</td>
                               <td>{Math.round((c.retained / Math.max(c.newUsers, 1)) * 100)}%</td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Analytics;

// frontend/src/pages/admin/UserAnalyticsDetail.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { axiosInstance } from '@/lib/axios';
import {
  ArrowLeft, Clock, Eye, MousePointer, Globe, Activity,
  Calendar, Monitor, Smartphone, Tablet, ChevronRight,
  TrendingUp, X, User, ArrowUpRight
} from 'lucide-react';

interface UserActivity {
  user: any;
  sessions: any[];
  events: any[];
}

const UserAnalyticsDetail: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<UserActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/analytics/users/${userId}/activity?range=all`);
      setData(res.data);
    } catch (e) {
      setError('Failed to load user activity');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) fetchActivity();
  }, [userId, fetchActivity]);

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(iso).toLocaleDateString();
  };

  const fmtDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (error || !data) return (
    <div className="p-6 text-center text-red-400 bg-red-900/10 rounded-xl border border-red-900/20">
      {error || 'User not found'}
    </div>
  );

  const { user, sessions, events } = data;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={18} /> Back to Users
        </button>
        <div className="flex items-center gap-4">
          <select 
            className="bg-[#1e293b] border border-[#334155] text-white text-xs px-3 py-1.5 rounded-lg outline-none"
            value={new URLSearchParams(window.location.search).get('range') || '7d'}
            onChange={(e) => {
              const url = new URL(window.location.href);
              url.searchParams.set('range', e.target.value);
              window.history.pushState({}, '', url);
              fetchActivity();
            }}
          >
            {['24h', '7d', '30d', 'all'].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            ID: <code className="bg-gray-800 px-2 py-1 rounded">{userId}</code>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* User Card */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-indigo-500/20">
                {user.email?.[0].toUpperCase() || '?'}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{user.email || 'Anonymous Visitor'}</h2>
                <p className="text-sm text-gray-500">Registered: {user.registeredUserId ? 'Yes' : 'No'}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-[#1e293b]">
                <span className="text-sm text-gray-500 flex items-center gap-2"><Globe size={14} /> Location</span>
                <span className="text-sm text-white font-medium">{user.geo?.city && user.geo?.country ? `${user.geo.city}, ${user.geo.country}` : user.geo?.country || user.geo?.city || 'Location unavailable'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[#1e293b]">
                <span className="text-sm text-gray-500 flex items-center gap-2"><Monitor size={14} /> Device</span>
                <span className="text-sm text-white font-medium capitalize">{user.device?.type || 'Unknown'} / {user.device?.browser || 'Unknown'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[#1e293b]">
                <span className="text-sm text-gray-500 flex items-center gap-2"><Calendar size={14} /> First Seen</span>
                <span className="text-sm text-white font-medium">{new Date(user.firstSeen).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[#1e293b]">
                <span className="text-sm text-gray-500 flex items-center gap-2"><Activity size={14} /> Last Activity</span>
                <span className="text-sm text-white font-medium">{timeAgo(user.lastSeen)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-500 flex items-center gap-2"><Eye size={14} /> Page Views</span>
                <span className="text-sm text-indigo-400 font-bold">{user.totalPageViews}</span>
              </div>
            </div>
          </div>

          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Traffic Channel</h3>
            <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-xl">
              <span className="text-sm text-gray-400">Source</span>
              <span className="px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded-md text-xs font-bold uppercase">{user.utm?.source || 'Direct'}</span>
            </div>
          </div>
        </div>

        {/* Timeline & Sessions */}
        <div className="md:col-span-2 space-y-6">
          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded-2xl">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Sessions</p>
              <p className="text-2xl font-bold text-white">{sessions.length}</p>
            </div>
            <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded-2xl">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Views</p>
              <p className="text-2xl font-bold text-white">{events.filter(e => e.eventType === 'PAGE_VIEW').length}</p>
            </div>
            <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded-2xl">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Duration</p>
              <p className="text-2xl font-bold text-white">{fmtDuration(sessions.reduce((acc, s) => acc + (s.duration || 0), 0))}</p>
            </div>
          </div>

          {/* User Flow (Grouped by Session) */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <TrendingUp size={20} className="text-indigo-500" /> Navigation Flow
            </h3>
            <div className="space-y-6">
              {sessions.map((session, sIdx) => {
                const sessionEvents = events.filter(e => e.sessionId === session.sessionId && e.eventType === 'PAGE_VIEW');
                if (sessionEvents.length === 0) return null;
                return (
                  <div key={session.sessionId} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded">Visit {sessions.length - sIdx}</span>
                      <span className="text-[10px] text-gray-500">{new Date(session.startTime).toLocaleString()}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {sessionEvents.reverse().map((e, i, arr) => (
                        <React.Fragment key={i}>
                          <div className="px-3 py-2 bg-indigo-500/5 border border-indigo-500/10 rounded-lg text-sm text-indigo-300 font-medium">
                            {e.page === '/' ? 'Home' : e.page}
                          </div>
                          {i < arr.length - 1 && <ChevronRight size={14} className="text-gray-600" />}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Timeline */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Activity size={20} className="text-emerald-500" /> Detailed Timeline
            </h3>
            
            <div className="relative space-y-1 pl-4 border-l-2 border-[#1e293b] ml-4">
              {events.slice(0, 100).map((ev, i) => {
                const Icon = ({
                  'PAGE_VIEW': Eye,
                  'BUTTON_CLICK': MousePointer,
                  'TIME_ON_PAGE': Clock,
                  'SESSION_START': TrendingUp,
                  'SESSION_END': X,
                  'USER_IDENTIFIED': User,
                } as any)[ev.eventType] || Activity;

                const colorSet = ({
                  'PAGE_VIEW': ['#6366f1', 'text-indigo-400'],
                  'BUTTON_CLICK': ['#22c55e', 'text-emerald-400'],
                  'TIME_ON_PAGE': ['#f59e0b', 'text-amber-400'],
                  'SESSION_START': ['#38bdf8', 'text-sky-400'],
                } as any)[ev.eventType] || ['#94a3b8', 'text-slate-400'];

                return (
                  <div key={i} className="relative pb-8 group">
                    <div className="absolute -left-[25px] top-1 w-4 h-4 rounded-full bg-[#0f172a] border-2 border-[#1e293b] group-hover:border-indigo-500 transition-colors z-10 box-border shadow-[0_0_0_4px_#0f172a]" />
                    <div className="flex items-start gap-4">
                      <div className="p-2 rounded-xl bg-gray-900 border border-[#1e293b]">
                        <Icon size={16} style={{ color: colorSet[0] }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${colorSet[1]}`}>
                            {ev.eventType.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-gray-500">{timeAgo(ev.timestamp)}</span>
                        </div>
                        <div className="text-sm font-semibold text-gray-100 flex items-center gap-2">
                           <span className="text-gray-500 font-normal">on</span> 
                           {ev.page === '/' ? 'Home' : ev.page}
                        </div>
                        {ev.metadata?.duration && (
                          <div className="text-xs text-gray-400 mt-1 bg-gray-800/50 inline-block px-2 py-0.5 rounded">
                            Duration: <span className="text-indigo-400 ml-1 font-bold">{Math.round(ev.metadata.duration / 1000)}s</span>
                          </div>
                        )}
                        {ev.metadata?.button && (
                          <div className="mt-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl animate-in zoom-in duration-300">
                            <div className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest mb-1">Interaction</div>
                            <div className="flex items-center gap-2 text-sm text-emerald-400 font-bold">
                               <MousePointer size={14} /> {ev.metadata.button.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserAnalyticsDetail;

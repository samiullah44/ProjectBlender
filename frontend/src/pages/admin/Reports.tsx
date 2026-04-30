import React, { useState, useEffect, useCallback } from 'react'
import AdminLayout from '@/components/admin/AdminLayout'
import { Card } from '@/components/ui/Card'
import { Flag, CheckCircle2, XCircle, Clock, ExternalLink } from 'lucide-react'
import axiosInstance from '@/lib/axios'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { websocketService } from '@/services/websocketService'

type ReportStatus = 'pending' | 'reviewed' | 'dismissed'

interface IReport {
  _id: string
  targetType: 'blog' | 'comment'
  targetId: string
  reportedBy: { _id: string; name: string; email: string; username: string }
  reason: string
  details?: string
  status: ReportStatus
  createdAt: string
}

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  misinformation: 'Misinformation',
  hate_speech: 'Hate Speech',
  harassment: 'Harassment',
  inappropriate_content: 'Inappropriate Content',
  other: 'Other',
}

const STATUS_STYLES: Record<ReportStatus, string> = {
  pending: 'text-amber-400 bg-amber-400/10',
  reviewed: 'text-green-400 bg-green-400/10',
  dismissed: 'text-gray-400 bg-gray-400/10',
}

const STATUS_ICONS: Record<ReportStatus, React.ReactNode> = {
  pending: <Clock className="w-3.5 h-3.5" />,
  reviewed: <CheckCircle2 className="w-3.5 h-3.5" />,
  dismissed: <XCircle className="w-3.5 h-3.5" />,
}

const AdminReports: React.FC = () => {
  const [reports, setReports] = useState<IReport[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'all'>('pending')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [updating, setUpdating] = useState<string | null>(null)

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true)
      const params: any = { page, limit: 20 }
      if (statusFilter !== 'all') params.status = statusFilter

      const { data } = await axiosInstance.get('/reports', { params })
      if (data.success) {
        setReports(data.reports)
        setTotalPages(data.pages)
        setTotal(data.total)
      }
    } catch {
      toast.error('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  // Live updates — re-fetch when a new report comes in or blog changes
  useEffect(() => {
    const unsubscribe = websocketService.subscribeToSystem((data: any) => {
      if (
        data.type === 'blog_status_changed' ||
        data.type === 'comment_added' ||
        data.type === 'comment_deleted' ||
        data.type === 'report_submitted'
      ) {
        fetchReports()
      }
    })
    return unsubscribe
  }, [fetchReports])

  // Polling fallback — refresh every 30s even without a WS event
  useEffect(() => {
    const interval = setInterval(fetchReports, 30_000)
    return () => clearInterval(interval)
  }, [fetchReports])

  const updateStatus = async (id: string, status: 'reviewed' | 'dismissed') => {
    setUpdating(id)
    try {
      const { data } = await axiosInstance.patch(`/reports/${id}`, { status })
      if (data.success) {
        setReports((prev) =>
          prev.map((r) => (r._id === id ? { ...r, status } : r))
        )
        toast.success(`Report marked as ${status}`)
      }
    } catch {
      toast.error('Failed to update report')
    } finally {
      setUpdating(null)
    }
  }

  const tabs: { label: string; value: ReportStatus | 'all' }[] = [
    { label: 'Pending', value: 'pending' },
    { label: 'Reviewed', value: 'reviewed' },
    { label: 'Dismissed', value: 'dismissed' },
    { label: 'All', value: 'all' },
  ]

  return (
    <AdminLayout title="Reports" subtitle={`${total} report${total !== 1 ? 's' : ''} total`}>
      <div className="space-y-6">

        {/* Status tabs */}
        <div className="flex gap-2 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setStatusFilter(tab.value); setPage(1); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === tab.value
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <Card className="bg-[#0d0d15] border-white/[0.06]">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-white/[0.02] border-b border-white/[0.06]">
                <tr>
                  <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Reported by</th>
                  <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Target</th>
                  <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Reason</th>
                  <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Details</th>
                  <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={7} className="px-6 py-5 h-16 bg-white/[0.01]" />
                    </tr>
                  ))
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <Flag className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">No reports found.</p>
                    </td>
                  </tr>
                ) : (
                  reports.map((report) => (
                    <tr key={report._id} className="hover:bg-white/[0.01] transition-colors">
                      {/* Date */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {format(new Date(report.createdAt), 'MMM d, yyyy HH:mm')}
                      </td>

                      {/* Reporter */}
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-white/90">{report.reportedBy?.name ?? '—'}</div>
                        <div className="text-xs text-gray-500">{report.reportedBy?.email}</div>
                      </td>

                      {/* Target */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          report.targetType === 'blog'
                            ? 'text-blue-400 bg-blue-400/10'
                            : 'text-purple-400 bg-purple-400/10'
                        }`}>
                          {report.targetType}
                        </span>
                        <div className="text-[10px] text-gray-600 font-mono mt-1 max-w-[120px] truncate">
                          {report.targetId}
                        </div>
                      </td>

                      {/* Reason */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-300">
                          {REASON_LABELS[report.reason] ?? report.reason}
                        </span>
                      </td>

                      {/* Details */}
                      <td className="px-6 py-4 max-w-[200px]">
                        <p className="text-xs text-gray-500 truncate" title={report.details}>
                          {report.details || <span className="text-gray-700">—</span>}
                        </p>
                      </td>

                      {/* Status badge */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[report.status]}`}>
                          {STATUS_ICONS[report.status]}
                          {report.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {report.status === 'pending' ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateStatus(report._id, 'reviewed')}
                              disabled={updating === report._id}
                              className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium hover:bg-green-500/20 transition-colors disabled:opacity-50"
                            >
                              Mark reviewed
                            </button>
                            <button
                              onClick={() => updateStatus(report._id, 'dismissed')}
                              disabled={updating === report._id}
                              className="px-3 py-1.5 rounded-lg bg-gray-500/10 text-gray-400 text-xs font-medium hover:bg-gray-500/20 transition-colors disabled:opacity-50"
                            >
                              Dismiss
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 disabled:opacity-50 hover:bg-white/10 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 disabled:opacity-50 hover:bg-white/10 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

export default AdminReports

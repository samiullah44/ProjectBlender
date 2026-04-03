// services/websocketService.ts - WITH subscribeToSystem added back
import { toast } from 'react-hot-toast'
import jobStore from '@/stores/jobStore'

class WebSocketService {
  private socket: WebSocket | null = null
  private jobSubscriptions: Map<string, ((job: any) => void)[]> = new Map()
  private systemSubscriptions: ((data: any) => void)[] = [] // Added this back
  private nodeSubscriptions: Map<string, ((node: any) => void)[]> = new Map()
  private jobStatusCache: Map<string, string> = new Map() // Track previous job statuses
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 1000
  private heartbeatInterval: number | null = null
  private isConnecting = false

  constructor() {
    // Auto-connect on service creation
    this.connect()
  }

  connect() {
    if (this.socket?.readyState === WebSocket.OPEN || this.isConnecting) {
      return
    }

    this.isConnecting = true

    // Get the backend URL from environment or use current host
    const backendUrl = import.meta.env.VITE_API_URL || window.location.origin
    const wsUrl = backendUrl.replace('http', 'ws') + '/ws'

    console.log('🔌 Connecting to WebSocket:', wsUrl)

    this.socket = new WebSocket(wsUrl)

    this.socket.onopen = () => {
      console.log('✅ WebSocket connected')
      this.isConnecting = false
      this.reconnectAttempts = 0

      // Start heartbeat
      this.startHeartbeat()

      // Resubscribe to all jobs
      this.jobSubscriptions.forEach((_, jobId) => {
        this.subscribeToJobInternal(jobId)
      })

      toast.success('Real-time updates connected')
    }

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        this.handleMessage(data)
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }

    this.socket.onclose = (event) => {
      console.log('❌ WebSocket disconnected:', event.code, event.reason)
      this.isConnecting = false
      this.stopHeartbeat()
      this.attemptReconnect()
    }

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error)
      this.isConnecting = false
    }
  }

  disconnect() {
    if (this.socket) {
      this.stopHeartbeat()
      this.socket.close()
      this.socket = null
    }
  }

  private handleMessage(data: any) {
    console.log('📨 WebSocket message:', data.type)

    switch (data.type) {
      case 'notification:new':
        this.handleNotification(data)
        break
      case 'job_update':
        this.handleJobUpdate(data)
        break
      case 'node_update':
        this.handleNodeUpdate(data)
        break
      case 'system_update':
        this.handleSystemUpdate(data)
        break
      case 'auth_success':
        console.log('WebSocket authenticated successfully')
        break
      case 'connected':
        console.log('WebSocket connection established')
        // Send auth message if user is logged in
        this.authenticateIfPossible()
        break
      case 'credit_balance_updated':
        console.log('💳 Credit balance update received, refreshing...')
        window.dispatchEvent(new Event('refresh_credit_balance'))
        break
      case 'pong':
        // Heartbeat response
        break
      case 'error':
        console.error('WebSocket error:', data.message)
        toast.error(data.message)
        break
      default:
        console.log('Unknown message type:', data.type)
    }
  }

  private authenticateIfPossible() {
    try {
      const authStorage = localStorage.getItem('auth-storage')
      if (authStorage) {
        const { state } = JSON.parse(authStorage)
        if (state.user?.id) {
          this.authenticate(state.user.id)
        }
      }
    } catch (error) {
      console.error('Error authenticating websocket:', error)
    }
  }

  authenticate(userId: string) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.send({
        type: 'auth',
        userId: userId
      })
      console.log('🔐 Sent WebSocket authentication for user:', userId)
    } else {
      console.warn('WebSocket not ready for authentication, will retry on connect')
    }
  }

  private handleNotification(data: any) {
    const notification = data.data.notification
    console.log('🔔 New notification received:', notification)

    // Update notification store - importing dynamically to avoid circular dependencies if any
    import('@/stores/notificationStore').then(({ useNotificationStore }) => {
      useNotificationStore.getState().addNotification({
        ...notification,
        _id: notification._id || Date.now().toString(),
        createdAt: notification.createdAt || new Date().toISOString()
      })
    })

    // Show toast
    toast.success(notification.title, {
      icon: '🔔',
      duration: 5000
    })

    // If application approved, refresh user profile to update roles
    if (notification.type === 'application_approved') {
      import('@/stores/authStore').then(({ useAuthStore }) => {
        useAuthStore.getState().getProfile()
      })
    }
  }

  private handleJobUpdate(data: any) {
    const jobId = data.event?.split(':')[1]
    if (!jobId) return

    const job = data.data
    console.log('📊 Job update received:', jobId, job.status, job.progress)

    // Check for status transition to completed
    const previousStatus = this.jobStatusCache.get(jobId)
    const currentStatus = job.status

    // Update job in store
    jobStore.getState().updateJobProgress(jobId, job)

    // Notify subscribers
    const subscribers = this.jobSubscriptions.get(jobId) || []
    subscribers.forEach(callback => callback(job))

    // Show toast only when job transitions to completed (not on every update)
    if (currentStatus === 'completed' && previousStatus !== 'completed') {
      toast.success(`🎉 Job "${job.blendFileName || job.jobId}" completed!`)
    }

    // Update status cache
    this.jobStatusCache.set(jobId, currentStatus)
  }

  private handleNodeUpdate(data: any) {
    // Handle node updates if needed
    console.log('Node update:', data)

    // Notify node subscribers
    const nodeId = data.event?.split(':')[1]
    if (nodeId) {
      const subscribers = this.nodeSubscriptions.get(nodeId) || []
      subscribers.forEach(callback => callback(data.data))
    }
  }

  private handleSystemUpdate(data: any) {
    // Handle system updates if needed
    console.log('System update:', data)

    // Notify all system subscribers
    this.systemSubscriptions.forEach(callback => {
      try {
        callback(data.data)
      } catch (error) {
        console.error('Error in system update callback:', error)
      }
    })
  }

  private subscribeToJobInternal(jobId: string) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.send({ type: 'subscribe', event: `job:${jobId}` })
      console.log(`📡 Subscribed to job: ${jobId}`)
    }
  }

  private unsubscribeFromJobInternal(jobId: string) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.send({ type: 'unsubscribe', event: `job:${jobId}` })
      console.log(`📡 Unsubscribed from job: ${jobId}`)
    }
  }

  subscribeToJob(jobId: string, callback: (job: any) => void) {
    if (!this.jobSubscriptions.has(jobId)) {
      this.jobSubscriptions.set(jobId, [])
      // Subscribe on WebSocket
      this.subscribeToJobInternal(jobId)
    }

    this.jobSubscriptions.get(jobId)!.push(callback)

    // Return unsubscribe function
    return () => {
      const callbacks = this.jobSubscriptions.get(jobId) || []
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
      if (callbacks.length === 0) {
        this.jobSubscriptions.delete(jobId)
        this.unsubscribeFromJobInternal(jobId)
      }
    }
  }

  // ADD THIS METHOD BACK - for system updates
  subscribeToSystem(callback: (data: any) => void) {
    this.systemSubscriptions.push(callback)

    // Return unsubscribe function
    return () => {
      const index = this.systemSubscriptions.indexOf(callback)
      if (index > -1) {
        this.systemSubscriptions.splice(index, 1)
      }
    }
  }

  // Optional: Add node subscription method
  subscribeToNode(nodeId: string, callback: (node: any) => void) {
    if (!this.nodeSubscriptions.has(nodeId)) {
      this.nodeSubscriptions.set(nodeId, [])
    }

    this.nodeSubscriptions.get(nodeId)!.push(callback)

    // Return unsubscribe function
    return () => {
      const callbacks = this.nodeSubscriptions.get(nodeId) || []
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
      if (callbacks.length === 0) {
        this.nodeSubscriptions.delete(nodeId)
      }
    }
  }

  private send(data: any) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data))
    } else {
      console.warn('WebSocket not ready, cannot send:', data)
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = window.setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping', timestamp: Date.now() })
      }
    }, 25000) // Every 25 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000)

      console.log(`🔄 Attempting reconnect in ${delay}ms (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

      setTimeout(() => {
        console.log('🔌 Reconnecting...')
        this.connect()
      }, delay)
    } else {
      console.error('Max reconnection attempts reached')
      toast.error('Lost connection to real-time updates. Please refresh the page.')
    }
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN
  }
}

// Create a singleton instance
export const websocketService = new WebSocketService()
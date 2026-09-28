/**
 * Trace Console UI - comprehensive logging and monitoring interface
 * Shows all system events, integration health, errors, and traces
 */

import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface TraceEvent {
  id: string;
  timestamp: string;
  severity: 'critical' | 'warning' | 'info' | 'debug';
  module: string;
  message: string;
  details: Record<string, any>;
}

interface IntegrationHealth {
  [key: string]: {
    status: 'ok' | 'missing_key' | 'mock' | 'error';
    last_check: string;
    message: string;
  };
}

export default function TraceConsole() {
  const [traces, setTraces] = useState<TraceEvent[]>([]);
  const [health, setHealth] = useState<IntegrationHealth>({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    severity: 'all',
    module: 'all',
    integration: 'all',
    timeRange: 'today',
    search: '',
  });
  const [pagination, setPagination] = useState({
    limit: 100,
    offset: 0,
    total: 0,
  });

  // Fetch trace events
  const fetchTraces = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: String(pagination.limit),
        offset: String(pagination.offset),
      });

      if (filters.severity !== 'all') params.append('severity', filters.severity);
      if (filters.module !== 'all') params.append('module', filters.module);
      if (filters.integration !== 'all') params.append('integration', filters.integration);
      if (filters.timeRange !== 'all') {
        const from = getFromDate(filters.timeRange);
        params.append('from_date', from.toISOString());
      }

      const response = await api.get(`/v1/console/traces?${params}`);
      setTraces(response.events || []);
      setPagination(prev => ({ ...prev, total: response.total || 0 }));
    } catch (error) {
      console.error('Failed to fetch traces:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch integration health
  const fetchHealth = async () => {
    try {
      const response = await api.get('/v1/console/integration-health');
      setHealth(response);
    } catch (error) {
      console.error('Failed to fetch integration health:', error);
    }
  };

  useEffect(() => {
    fetchTraces();
    fetchHealth();

    // Poll every 30 seconds
    const interval = setInterval(() => {
      fetchTraces();
      fetchHealth();
    }, 30000);

    return () => clearInterval(interval);
  }, [filters, pagination]);

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'debug': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // Get health status color
  const getHealthColor = (status: string) => {
    switch (status) {
      case 'ok': return 'text-green-600';
      case 'missing_key': return 'text-yellow-600';
      case 'mock': return 'text-orange-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  // Get health status badge
  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'ok': return <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">✓ OK</span>;
      case 'missing_key': return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">⚠ Missing Key</span>;
      case 'mock': return <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs font-medium">🔧 Mock</span>;
      case 'error': return <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">✗ Error</span>;
      default: return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium">Unknown</span>;
    }
  };

  // Filtered traces
  const filteredTraces = traces.filter(trace => {
    if (filters.search && !trace.message.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Format timestamp
  const formatTimestamp = (iso: string) => {
    return new Date(iso).toLocaleString('en-IN');
  };

  // Calculate from date for time range
  const getFromDate = (range: string): Date => {
    const now = new Date();
    switch (range) {
      case 'realtime': return new Date(now.getTime() - 5 * 60 * 1000); // Last 5 min
      case 'today': return new Date(now.setHours(0, 0, 0, 0));
      case 'week': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default: return new Date(0); // All time
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Trace Console</h1>
            <p className="text-sm text-gray-500 mt-1">Monitor all system events, integrations, and errors in real-time</p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => { fetchTraces(); fetchHealth(); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              🔄 Refresh
            </button>
            <button
              onClick={() => exportLogs()}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium border border-gray-300"
            >
              📥 Export Logs
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Integration Health Dashboard */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Integration Health</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(health).map(([key, data]) => (
              <div key={key} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900 capitalize">{key.replace(/-/g, ' ')}</h3>
                  {getHealthBadge(data.status)}
                </div>
                <div className={`text-sm ${getHealthColor(data.status)}`}>
                  {data.message}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Last check: {formatTimestamp(data.last_check)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Search messages..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Severity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
              <select
                value={filters.severity}
                onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
              </select>
            </div>

            {/* Module */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Module</label>
              <select
                value={filters.module}
                onChange={(e) => setFilters({ ...filters, module: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="platform">Platform</option>
                <option value="business">Business</option>
                <option value="ca">CA Practice</option>
                <option value="console">Console</option>
              </select>
            </div>

            {/* Integration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Integration</label>
              <select
                value={filters.integration}
                onChange={(e) => setFilters({ ...filters, integration: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="firebase">Firebase</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="gsp">GSP</option>
                <option value="database">Database</option>
                <option value="redis">Redis</option>
                <option value="storage">Storage</option>
                <option value="email">Email</option>
              </select>
            </div>

            {/* Time Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time Range</label>
              <select
                value={filters.timeRange}
                onChange={(e) => setFilters({ ...filters, timeRange: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="realtime">Real-time (last 5 min)</option>
                <option value="today">Today</option>
                <option value="week">Last 7 days</option>
                <option value="month">Last 30 days</option>
                <option value="all">All time</option>
              </select>
            </div>
          </div>
        </div>

        {/* Trace Events */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Event Stream</h2>
            <p className="text-sm text-gray-500 mt-1">
              {filteredTraces.length} events {pagination.total > 0 && `of ${pagination.total} total`}
            </p>
          </div>

          <div className="divide-y divide-gray-200">
            {loading ? (
              <div className="p-12 text-center text-gray-500">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2">Loading traces...</p>
              </div>
            ) : filteredTraces.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <p>No events found</p>
                <p className="text-sm mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              filteredTraces.map((trace) => (
                <div key={trace.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start space-x-4">
                    {/* Severity Badge */}
                    <div className={`px-2 py-1 rounded text-xs font-medium border ${getSeverityColor(trace.severity)} uppercase`}>
                      {trace.severity}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">{trace.module}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-sm text-gray-500">{formatTimestamp(trace.timestamp)}</span>
                      </div>
                      <p className="text-gray-900 font-medium">{trace.message}</p>
                      {trace.details && Object.keys(trace.details).length > 0 && (
                        <details className="mt-2">
                          <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-900">
                            Show details ({Object.keys(trace.details).length} fields)
                          </summary>
                          <pre className="mt-2 text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-auto">
                            {JSON.stringify(trace.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0">
                      <button
                        onClick={() => copyTrace(trace)}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {pagination.total > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {Math.min((pagination.offset + 1) * pagination.limit, pagination.total)} of {pagination.total} events
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPagination({ ...pagination, offset: Math.max(0, pagination.offset - 1) })}
                  disabled={pagination.offset === 0}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => setPagination({ ...pagination, offset: pagination.offset + 1 })}
                  disabled={(pagination.offset + 1) * pagination.limit >= pagination.total}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Export logs function
function exportLogs() {
  // TODO: Implement export to CSV/JSON
  alert('Export functionality will be implemented');
}

// Copy trace to clipboard
function copyTrace(trace: TraceEvent) {
  const text = `[${trace.severity.toUpperCase()}] ${trace.module} - ${trace.message}\n${JSON.stringify(trace.details, null, 2)}`;
  navigator.clipboard.writeText(text);
}

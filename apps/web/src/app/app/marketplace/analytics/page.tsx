'use client';

import { useState, useEffect } from 'react';
import { toast } from '@platform/ui';
import {
  BarChart3,
  TrendingUp,
  Eye,
  MousePointerClick,
  Star,
  Clock,
  RefreshCw,
} from 'lucide-react';
import api from '@/lib/api';

interface Connection {
  id: string;
  name: string;
  platform: string;
  marketplaceId: string;
  isConnected: boolean;
}

interface TrafficReport {
  totalImpressions: number;
  totalClicks: number;
  clickThroughRate: number;
  totalWatchers: number;
}

interface RatingBreakdown {
  positive: number;
  neutral: number;
  negative: number;
}

interface SellerStandards {
  level: string;
  ratingBreakdown: RatingBreakdown;
}

interface CustomerServiceMetrics {
  responseTimeHours: number;
  resolutionRate: number;
  casesOpen: number;
  casesClosed: number;
  lateShipmentRate: number;
  onTimeDeliveryRate: number;
}

type DateRange = 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'LAST_90_DAYS';

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'LAST_7_DAYS', label: 'Last 7 Days' },
  { value: 'LAST_30_DAYS', label: 'Last 30 Days' },
  { value: 'LAST_90_DAYS', label: 'Last 90 Days' },
];

export default function MarketplaceAnalyticsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange>('LAST_30_DAYS');
  const [loading, setLoading] = useState(true);
  const [trafficLoading, setTrafficLoading] = useState(false);
  const [sellerLoading, setSellerLoading] = useState(false);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [traffic, setTraffic] = useState<TrafficReport | null>(null);
  const [sellerStandards, setSellerStandards] = useState<SellerStandards | null>(null);
  const [customerService, setCustomerService] = useState<CustomerServiceMetrics | null>(null);

  useEffect(() => {
    loadConnections();
  }, []);

  useEffect(() => {
    if (selectedConnection) {
      loadTraffic();
      loadSellerStandards();
      loadCustomerService();
    }
  }, [selectedConnection]);

  useEffect(() => {
    if (selectedConnection) {
      loadTraffic();
    }
  }, [dateRange]);

  const loadConnections = async () => {
    try {
      const res = await api.get<Connection[]>('/v1/marketplace/connections');
      setConnections(res.data);
      if (res.data.length > 0) {
        setSelectedConnection(res.data[0].id);
      }
    } catch (error) {
      console.error('Failed to load connections:', error);
      toast({ title: 'Error', description: 'Failed to load connections', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadTraffic = async () => {
    if (!selectedConnection) return;
    setTrafficLoading(true);
    try {
      // Convert date range label to actual start/end dates for the API
      const now = new Date();
      let daysBack = 30;
      if (dateRange === 'LAST_7_DAYS') daysBack = 7;
      else if (dateRange === 'LAST_90_DAYS') daysBack = 90;
      const startDate = new Date(now.getTime() - daysBack * 86400000).toISOString().split('T')[0];
      const endDate = now.toISOString().split('T')[0];

      const res = await api.get<TrafficReport>('/v1/marketplace/analytics/traffic', {
        params: { connectionId: selectedConnection, startDate, endDate },
      });
      setTraffic(res.data);
    } catch (error: any) {
      console.error('Failed to load traffic:', error);
      toast({
        title: 'Error',
        description: error?.response?.data?.error || error?.response?.data?.message || 'Failed to load traffic data',
        variant: 'destructive',
      });
      setTraffic(null);
    } finally {
      setTrafficLoading(false);
    }
  };

  const loadSellerStandards = async () => {
    if (!selectedConnection) return;
    setSellerLoading(true);
    try {
      const res = await api.get<SellerStandards>('/v1/marketplace/analytics/seller-standards', {
        params: { connectionId: selectedConnection },
      });
      setSellerStandards(res.data);
    } catch (error: any) {
      console.error('Failed to load seller standards:', error);
      toast({
        title: 'Error',
        description: error?.response?.data?.error || error?.response?.data?.message || 'Failed to load seller standards',
        variant: 'destructive',
      });
      setSellerStandards(null);
    } finally {
      setSellerLoading(false);
    }
  };

  const loadCustomerService = async () => {
    if (!selectedConnection) return;
    setServiceLoading(true);
    try {
      const res = await api.get<CustomerServiceMetrics>(
        '/v1/marketplace/analytics/customer-service',
        { params: { connectionId: selectedConnection } },
      );
      setCustomerService(res.data);
    } catch (error: any) {
      console.error('Failed to load customer service metrics:', error);
      toast({
        title: 'Error',
        description: error?.response?.data?.error || error?.response?.data?.message || 'Failed to load customer service metrics',
        variant: 'destructive',
      });
      setCustomerService(null);
    } finally {
      setServiceLoading(false);
    }
  };

  const handleRefresh = () => {
    if (!selectedConnection) return;
    loadTraffic();
    loadSellerStandards();
    loadCustomerService();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Marketplace Analytics</h1>
          <p className="text-gray-600 mt-2">Monitor your store performance, traffic, and seller metrics</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={!selectedConnection}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className="w-5 h-5" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
            <select
              value={selectedConnection}
              onChange={(e) => setSelectedConnection(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a store...</option>
              {connections.map((conn) => (
                <option key={conn.id} value={conn.id}>
                  {conn.name} ({conn.marketplaceId})
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[180px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range (Traffic)</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRange)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {DATE_RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!selectedConnection ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-gray-400 mb-4">
            <BarChart3 className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select a store to view analytics</h3>
          <p className="text-gray-600">
            Choose a connected store from the dropdown above to see performance data
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Traffic Report Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Traffic Report</h2>
              {trafficLoading && <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />}
            </div>

            {trafficLoading && !traffic ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : traffic ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  icon={<Eye className="w-5 h-5 text-blue-600" />}
                  label="Total Impressions"
                  value={traffic.totalImpressions.toLocaleString()}
                  bgColor="bg-blue-50"
                />
                <StatCard
                  icon={<MousePointerClick className="w-5 h-5 text-green-600" />}
                  label="Total Clicks"
                  value={traffic.totalClicks.toLocaleString()}
                  bgColor="bg-green-50"
                />
                <StatCard
                  icon={<TrendingUp className="w-5 h-5 text-purple-600" />}
                  label="Click-Through Rate"
                  value={`${(traffic.clickThroughRate * 100).toFixed(2)}%`}
                  bgColor="bg-purple-50"
                />
                <StatCard
                  icon={<Eye className="w-5 h-5 text-orange-600" />}
                  label="Total Watchers"
                  value={traffic.totalWatchers.toLocaleString()}
                  bgColor="bg-orange-50"
                />
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500">
                No traffic data available for this store
              </div>
            )}
          </section>

          {/* Seller Standards Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-5 h-5 text-yellow-500" />
              <h2 className="text-xl font-semibold text-gray-900">Seller Standards</h2>
              {sellerLoading && <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />}
            </div>

            {sellerLoading && !sellerStandards ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : sellerStandards ? (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                  <div className="flex-shrink-0">
                    <p className="text-sm font-medium text-gray-500 mb-1">Seller Level</p>
                    <SellerLevelBadge level={sellerStandards.level} />
                  </div>

                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-500 mb-3">Rating Breakdown</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">
                          {sellerStandards.ratingBreakdown.positive}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Positive</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-500">
                          {sellerStandards.ratingBreakdown.neutral}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Neutral</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-red-600">
                          {sellerStandards.ratingBreakdown.negative}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Negative</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500">
                No seller standards data available for this store
              </div>
            )}
          </section>

          {/* Customer Service Metrics Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-indigo-600" />
              <h2 className="text-xl font-semibold text-gray-900">Customer Service Metrics</h2>
              {serviceLoading && <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />}
            </div>

            {serviceLoading && !customerService ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : customerService ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard
                  icon={<Clock className="w-5 h-5 text-indigo-600" />}
                  label="Avg Response Time"
                  value={`${customerService.responseTimeHours.toFixed(1)} hrs`}
                  bgColor="bg-indigo-50"
                />
                <StatCard
                  icon={<BarChart3 className="w-5 h-5 text-green-600" />}
                  label="Resolution Rate"
                  value={`${(customerService.resolutionRate * 100).toFixed(1)}%`}
                  bgColor="bg-green-50"
                />
                <StatCard
                  icon={<BarChart3 className="w-5 h-5 text-yellow-600" />}
                  label="Cases Open"
                  value={customerService.casesOpen.toLocaleString()}
                  bgColor="bg-yellow-50"
                />
                <StatCard
                  icon={<BarChart3 className="w-5 h-5 text-teal-600" />}
                  label="Cases Closed"
                  value={customerService.casesClosed.toLocaleString()}
                  bgColor="bg-teal-50"
                />
                <StatCard
                  icon={<TrendingUp className="w-5 h-5 text-red-600" />}
                  label="Late Shipment Rate"
                  value={`${(customerService.lateShipmentRate * 100).toFixed(1)}%`}
                  bgColor="bg-red-50"
                />
                <StatCard
                  icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
                  label="On-Time Delivery"
                  value={`${(customerService.onTimeDeliveryRate * 100).toFixed(1)}%`}
                  bgColor="bg-emerald-50"
                />
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500">
                No customer service data available for this store
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  bgColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  bgColor: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-lg transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${bgColor}`}>{icon}</div>
        <span className="text-sm font-medium text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function SellerLevelBadge({ level }: { level: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    TOP_RATED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Top Rated' },
    ABOVE_STANDARD: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Above Standard' },
    STANDARD: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Standard' },
    BELOW_STANDARD: { bg: 'bg-red-100', text: 'text-red-800', label: 'Below Standard' },
  };

  const c = config[level] || { bg: 'bg-gray-100', text: 'text-gray-800', label: level };

  return (
    <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold ${c.bg} ${c.text}`}>
      <Star className="w-4 h-4 mr-1.5" />
      {c.label}
    </span>
  );
}

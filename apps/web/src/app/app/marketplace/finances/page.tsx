'use client';

import { useState, useEffect } from 'react';
import { toast } from '@platform/ui';
import {
  DollarSign,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  RefreshCw,
} from 'lucide-react';
import { unwrapJson } from '@/lib/admin-fetch';

interface Connection {
  id: string;
  name: string;
  platform: string;
  marketplaceId: string;
  isConnected: boolean;
}

interface SellerFunds {
  availableFunds: number;
  processingFunds: number;
  onHoldFunds: number;
  totalFunds: number;
  currency: string;
}

interface Payout {
  payoutId: string;
  payoutDate: string;
  amount: number;
  currency: string;
  status: string;
  payoutInstrument: string;
}

interface Transaction {
  transactionDate: string;
  transactionType: string;
  amount: number;
  currency: string;
  bookingEntry: string;
  orderId: string;
  description: string;
}

type ActiveTab = 'payouts' | 'transactions';

const formatCurrency = (amount: number | undefined | null, currency: string = 'USD'): string => {
  if (amount === undefined || amount === null) return '-';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(amount);
};

function PayoutStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    SUCCEEDED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Succeeded' },
    INITIATED: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Initiated' },
    RETRYABLE_FAILURE: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Retryable Failure' },
    TERMINAL_FAILURE: { bg: 'bg-red-100', text: 'text-red-800', label: 'Terminal Failure' },
    REVERSED: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Reversed' },
    PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
    FAILED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Failed' },
  };

  const c = config[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

function BookingEntryBadge({ entry }: { entry: string }) {
  if (entry === 'CREDIT') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <ArrowDownRight className="w-3 h-3" />
        Credit
      </span>
    );
  }
  if (entry === 'DEBIT') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
        <ArrowUpRight className="w-3 h-3" />
        Debit
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
      {entry}
    </span>
  );
}

export default function MarketplaceFinancesPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const [funds, setFunds] = useState<SellerFunds | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [fundsLoading, setFundsLoading] = useState(false);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('payouts');

  useEffect(() => {
    loadConnections();
  }, []);

  useEffect(() => {
    if (selectedConnection) {
      loadFinanceData();
    } else {
      setFunds(null);
      setPayouts([]);
      setTransactions([]);
    }
  }, [selectedConnection]);

  const loadConnections = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/marketplace/connections', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = unwrapJson<Connection[]>(await res.json());
        setConnections(data);
        if (data.length > 0) {
          setSelectedConnection(data[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load connections:', error);
      toast({ title: 'Error', description: 'Failed to load connections', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadFinanceData = async () => {
    if (!selectedConnection) return;
    await Promise.all([loadFunds(), loadPayouts(), loadTransactions()]);
  };

  const loadFunds = async () => {
    setFundsLoading(true);
    try {
      const res = await fetch(
        `/api/v1/marketplace/finances/funds-summary?connectionId=${selectedConnection}`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = unwrapJson<SellerFunds>(await res.json());
        setFunds(data);
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || 'Failed to load seller funds', variant: 'destructive' });
        setFunds(null);
      }
    } catch (error) {
      console.error('Failed to load funds:', error);
      toast({ title: 'Error', description: 'Failed to load seller funds', variant: 'destructive' });
      setFunds(null);
    } finally {
      setFundsLoading(false);
    }
  };

  const loadPayouts = async () => {
    setPayoutsLoading(true);
    try {
      const res = await fetch(
        `/api/v1/marketplace/finances/payouts?connectionId=${selectedConnection}&limit=20`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = unwrapJson<Payout[]>(await res.json());
        setPayouts(data);
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || 'Failed to load payouts', variant: 'destructive' });
        setPayouts([]);
      }
    } catch (error) {
      console.error('Failed to load payouts:', error);
      toast({ title: 'Error', description: 'Failed to load payouts', variant: 'destructive' });
      setPayouts([]);
    } finally {
      setPayoutsLoading(false);
    }
  };

  const loadTransactions = async () => {
    setTransactionsLoading(true);
    try {
      const res = await fetch(
        `/api/v1/marketplace/finances/transactions?connectionId=${selectedConnection}&limit=20`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = unwrapJson<Transaction[]>(await res.json());
        setTransactions(data);
      } else {
        const error = unwrapJson(await res.json());
        toast({ title: 'Error', description: error.error || 'Failed to load transactions', variant: 'destructive' });
        setTransactions([]);
      }
    } catch (error) {
      console.error('Failed to load transactions:', error);
      toast({ title: 'Error', description: 'Failed to load transactions', variant: 'destructive' });
      setTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
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
          <h1 className="text-3xl font-bold text-gray-900">Marketplace Finances</h1>
          <p className="text-gray-600 mt-2">View seller funds, payouts, and transaction history</p>
        </div>
        <button
          onClick={loadFinanceData}
          disabled={!selectedConnection || fundsLoading || payoutsLoading || transactionsLoading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${fundsLoading || payoutsLoading || transactionsLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Connection Selector */}
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
        </div>
      </div>

      {!selectedConnection ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-gray-400 mb-4">
            <Wallet className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select a store</h3>
          <p className="text-gray-600">Choose a connected store above to view financial data</p>
        </div>
      ) : (
        <>
          {/* Seller Funds Summary */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Seller Funds
            </h2>
            {fundsLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : funds ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-500">Available Funds</span>
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <DollarSign className="w-4 h-4 text-green-600" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(funds.availableFunds, funds.currency)}
                  </p>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-500">Processing</span>
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <RefreshCw className="w-4 h-4 text-blue-600" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(funds.processingFunds, funds.currency)}
                  </p>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-500">On Hold</span>
                    <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                      <Wallet className="w-4 h-4 text-yellow-600" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(funds.onHoldFunds, funds.currency)}
                  </p>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-500">Total Funds</span>
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-purple-600" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(funds.totalFunds, funds.currency)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                <p className="text-gray-500">No funds data available for this store</p>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="flex gap-6">
              <button
                onClick={() => setActiveTab('payouts')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'payouts'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4" />
                  Payouts
                </span>
              </button>
              <button
                onClick={() => setActiveTab('transactions')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'transactions'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Transactions
                </span>
              </button>
            </nav>
          </div>

          {/* Payouts Tab */}
          {activeTab === 'payouts' && (
            <>
              {payoutsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : payouts.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <div className="text-gray-400 mb-4">
                    <ArrowUpRight className="w-16 h-16 mx-auto" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No payouts found</h3>
                  <p className="text-gray-600">No payout records available for the selected store</p>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Payout ID
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Payout Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Instrument
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {payouts.map((payout) => (
                          <tr key={payout.payoutId} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <span className="text-sm font-medium text-gray-900" title={payout.payoutId}>
                                {payout.payoutId.length > 20
                                  ? payout.payoutId.slice(0, 20) + '...'
                                  : payout.payoutId}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-600">
                                {new Date(payout.payoutDate).toLocaleDateString()}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm font-medium text-gray-900">
                                {formatCurrency(payout.amount, payout.currency)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <PayoutStatusBadge status={payout.status} />
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-600">{payout.payoutInstrument}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Transactions Tab */}
          {activeTab === 'transactions' && (
            <>
              {transactionsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <div className="text-gray-400 mb-4">
                    <CreditCard className="w-16 h-16 mx-auto" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions found</h3>
                  <p className="text-gray-600">No transaction records available for the selected store</p>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Booking Entry
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Order ID
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Description
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {transactions.map((txn, idx) => (
                          <tr key={`${txn.orderId}-${txn.transactionDate}-${idx}`} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-600">
                                {new Date(txn.transactionDate).toLocaleDateString()}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-900">{txn.transactionType}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-sm font-medium ${txn.bookingEntry === 'CREDIT' ? 'text-green-700' : 'text-red-700'}`}>
                                {txn.bookingEntry === 'CREDIT' ? '+' : '-'}
                                {formatCurrency(Math.abs(txn.amount), txn.currency)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <BookingEntryBadge entry={txn.bookingEntry} />
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-600" title={txn.orderId}>
                                {txn.orderId
                                  ? txn.orderId.length > 16
                                    ? txn.orderId.slice(0, 16) + '...'
                                    : txn.orderId
                                  : '-'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-600 max-w-[250px] truncate block" title={txn.description}>
                                {txn.description || '-'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

'use client';

import { CreditCard, Check, AlertCircle, TrendingUp, Calendar, Download } from 'lucide-react';

export function BillingTab() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Billing & Subscription</h2>
          <p className="text-[#999] text-sm mt-1">Manage your plan and payment methods</p>
        </div>
        <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors font-medium text-sm bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white">
          <Download className="h-4 w-4" />
          Download Invoice
        </button>
      </div>

      {/* Current Plan */}
      <div className="bg-[#1a1a1a] rounded-lg p-6 border border-[#2a2a2a] mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-white mb-1">Professional Plan</h3>
            <p className="text-[#999]">Your current subscription</p>
          </div>
          <span className="px-3 py-1 bg-green-500/10 text-green-500 text-sm font-medium rounded-full">
            Active
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <div>
            <p className="text-sm text-[#999] mb-1">Monthly Cost</p>
            <p className="text-2xl font-bold text-white">$99</p>
          </div>
          <div>
            <p className="text-sm text-[#999] mb-1">Next Billing Date</p>
            <p className="text-white flex items-center gap-1">
              <Calendar className="h-4 w-4 text-[#666]" />
              February 9, 2024
            </p>
          </div>
          <div>
            <p className="text-sm text-[#999] mb-1">Usage This Month</p>
            <p className="text-white flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-[#10a37f]" />
              12,450 items
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button className="px-4 py-2 bg-[#10a37f] hover:bg-[#0e8a65] text-white rounded-md transition-colors">
            Upgrade Plan
          </button>
          <button className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-md transition-colors">
            Change Plan
          </button>
        </div>
      </div>

      {/* Plan Features */}
      <div className="bg-[#1a1a1a] rounded-lg p-6 border border-[#2a2a2a] mb-6">
        <h3 className="text-lg font-medium text-white mb-4">Plan Features</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Check className="h-5 w-5 text-[#10a37f]" />
            <span className="text-[#999]">Up to 50,000 products</span>
          </div>
          <div className="flex items-center gap-3">
            <Check className="h-5 w-5 text-[#10a37f]" />
            <span className="text-[#999]">Unlimited AI content generation</span>
          </div>
          <div className="flex items-center gap-3">
            <Check className="h-5 w-5 text-[#10a37f]" />
            <span className="text-[#999]">5 team members</span>
          </div>
          <div className="flex items-center gap-3">
            <Check className="h-5 w-5 text-[#10a37f]" />
            <span className="text-[#999]">Priority support</span>
          </div>
          <div className="flex items-center gap-3">
            <Check className="h-5 w-5 text-[#10a37f]" />
            <span className="text-[#999]">Advanced analytics</span>
          </div>
        </div>
      </div>

      {/* Payment Method */}
      <div className="bg-[#1a1a1a] rounded-lg p-6 border border-[#2a2a2a] mb-6">
        <h3 className="text-lg font-medium text-white mb-4">Payment Method</h3>
        <div className="flex items-center justify-between p-4 bg-[#0a0a0a] rounded-lg border border-[#2a2a2a]">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-[#666]" />
            <div>
              <p className="text-white">•••• •••• •••• 4242</p>
              <p className="text-sm text-[#999]">Expires 12/24</p>
            </div>
          </div>
          <button className="text-sm text-[#10a37f] hover:text-[#0e8a65] transition-colors">
            Update
          </button>
        </div>
      </div>

      {/* Billing History */}
      <div className="bg-[#1a1a1a] rounded-lg p-6 border border-[#2a2a2a]">
        <h3 className="text-lg font-medium text-white mb-4">Billing History</h3>
        <div className="space-y-3">
          {[
            { date: 'Jan 9, 2024', amount: '$99.00', status: 'Paid' },
            { date: 'Dec 9, 2023', amount: '$99.00', status: 'Paid' },
            { date: 'Nov 9, 2023', amount: '$99.00', status: 'Paid' },
          ].map((invoice, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-3 border-b border-[#2a2a2a] last:border-0"
            >
              <div>
                <p className="text-white">{invoice.date}</p>
                <p className="text-sm text-[#999]">Professional Plan</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-white">{invoice.amount}</span>
                <span className="px-2 py-0.5 bg-green-500/10 text-green-500 text-xs font-medium rounded">
                  {invoice.status}
                </span>
                <button className="text-sm text-[#10a37f] hover:text-[#0e8a65] transition-colors">
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cancel Subscription */}
      <div className="mt-6 p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
          <div className="flex-1">
            <p className="text-white font-medium">Need to cancel?</p>
            <p className="text-sm text-[#999] mt-1">
              You can cancel your subscription at any time. Your access will continue until the end
              of the current billing period.
            </p>
            <button className="mt-3 text-sm text-red-500 hover:text-red-400 transition-colors">
              Cancel Subscription
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

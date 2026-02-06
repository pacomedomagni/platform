'use client';

import { motion } from 'framer-motion';
import { Check, Star, Zap } from 'lucide-react';
import { ButtonLink } from '@/app/storefront/_components/button-link';

const tiers = [
  {
    name: 'Starter',
    id: 'starter',
    price: '$49',
    description: 'Perfect for small businesses just getting started',
    features: [
      'Up to 500 products',
      '1,000 orders per month',
      'Single store location',
      'Email support',
      'Basic analytics',
      'Stripe integration',
      'Customer portal',
      '5GB storage',
    ],
    cta: 'Start Free Trial',
    featured: false,
    gradient: 'from-blue-600 to-blue-700',
  },
  {
    name: 'Professional',
    id: 'professional',
    price: '$149',
    description: 'For growing teams with advanced needs',
    features: [
      'Unlimited products',
      'Unlimited orders',
      'Up to 5 store locations',
      'Priority support',
      'Advanced analytics & reports',
      'Stripe integration',
      'Custom branding',
      '50GB storage',
      'Batch & serial tracking',
      'Email automation',
      'API access',
    ],
    cta: 'Start Free Trial',
    featured: true,
    gradient: 'from-purple-600 to-pink-600',
  },
  {
    name: 'Enterprise',
    id: 'enterprise',
    price: 'Custom',
    description: 'Custom solutions for large organizations',
    features: [
      'Everything in Professional',
      'Unlimited locations',
      'Dedicated support manager',
      'Custom integrations',
      'SLA guarantee',
      'Advanced security',
      'Custom workflows',
      'Unlimited storage',
      'White-label options',
      'Training & onboarding',
    ],
    cta: 'Contact Sales',
    featured: false,
    gradient: 'from-slate-700 to-slate-800',
  },
];

export function PricingTable() {
  return (
    <section className="bg-slate-50 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-base font-semibold leading-7 text-blue-600">Pricing</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Choose the perfect plan for your business
          </p>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            14-day free trial, no credit card required. Cancel anytime.
          </p>
        </motion.div>

        {/* Pricing cards */}
        <div className="mx-auto mt-16 grid max-w-7xl grid-cols-1 gap-8 lg:grid-cols-3">
          {tiers.map((tier, index) => (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ delay: index * 0.1, duration: 0.6 }}
              className={`relative flex flex-col overflow-hidden rounded-3xl ${
                tier.featured
                  ? 'scale-105 border-2 border-purple-600 shadow-2xl shadow-purple-600/20'
                  : 'border border-slate-200 shadow-lg'
              } bg-white`}
            >
              {/* Popular badge */}
              {tier.featured && (
                <div className="absolute right-0 top-0 z-10">
                  <div className="flex items-center gap-1 rounded-bl-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-xs font-semibold text-white">
                    <Star className="h-4 w-4 fill-current" />
                    Most Popular
                  </div>
                </div>
              )}

              <div className="flex flex-1 flex-col p-8">
                {/* Tier name and icon */}
                <div className="mb-6">
                  <div
                    className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${tier.gradient} shadow-lg`}
                  >
                    <Zap className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="mt-4 text-2xl font-bold text-slate-900">{tier.name}</h3>
                  <p className="mt-2 text-sm text-slate-600">{tier.description}</p>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline">
                    <span className="text-5xl font-bold tracking-tight text-slate-900">{tier.price}</span>
                    {tier.price !== 'Custom' && <span className="ml-2 text-lg text-slate-600">/month</span>}
                  </div>
                  {tier.price !== 'Custom' && <p className="mt-2 text-sm text-slate-600">Billed monthly</p>}
                </div>

                {/* Features */}
                <ul className="mb-8 flex-1 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${tier.gradient}`}
                      >
                        <Check className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-sm text-slate-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA button */}
                <ButtonLink
                  href={tier.price === 'Custom' ? '/storefront/account/register' : '/storefront/account/register'}
                  className={`w-full py-6 text-base font-semibold ${
                    tier.featured
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-600/30 hover:shadow-xl'
                      : 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {tier.cta}
                </ButtonLink>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Additional info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mt-16 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="text-center lg:text-left">
              <h4 className="text-lg font-semibold text-slate-900">All plans include</h4>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li className="flex items-center justify-center gap-2 lg:justify-start">
                  <Check className="h-4 w-4 text-green-600" />
                  SSL certificate
                </li>
                <li className="flex items-center justify-center gap-2 lg:justify-start">
                  <Check className="h-4 w-4 text-green-600" />
                  Daily backups
                </li>
                <li className="flex items-center justify-center gap-2 lg:justify-start">
                  <Check className="h-4 w-4 text-green-600" />
                  WCAG AA accessibility
                </li>
              </ul>
            </div>
            <div className="text-center lg:text-left">
              <h4 className="text-lg font-semibold text-slate-900">Need more?</h4>
              <p className="mt-4 text-sm text-slate-600">
                Contact our sales team for custom quotes, volume discounts, and enterprise features tailored to your
                needs.
              </p>
            </div>
            <div className="text-center lg:text-left">
              <h4 className="text-lg font-semibold text-slate-900">Money-back guarantee</h4>
              <p className="mt-4 text-sm text-slate-600">
                Try NoSlag risk-free for 14 days. If you are not satisfied, we will provide a full refund—no questions
                asked.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Comparison table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-16"
        >
          <h3 className="text-center text-2xl font-bold text-slate-900">Compare plans</h3>
          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Feature</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-slate-900">Starter</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-slate-900">Professional</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-slate-900">Enterprise</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="px-6 py-4 text-sm text-slate-700">Products</td>
                    <td className="px-6 py-4 text-center text-sm text-slate-600">500</td>
                    <td className="px-6 py-4 text-center text-sm text-slate-600">Unlimited</td>
                    <td className="px-6 py-4 text-center text-sm text-slate-600">Unlimited</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm text-slate-700">Orders per month</td>
                    <td className="px-6 py-4 text-center text-sm text-slate-600">1,000</td>
                    <td className="px-6 py-4 text-center text-sm text-slate-600">Unlimited</td>
                    <td className="px-6 py-4 text-center text-sm text-slate-600">Unlimited</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm text-slate-700">Store locations</td>
                    <td className="px-6 py-4 text-center text-sm text-slate-600">1</td>
                    <td className="px-6 py-4 text-center text-sm text-slate-600">5</td>
                    <td className="px-6 py-4 text-center text-sm text-slate-600">Unlimited</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm text-slate-700">API access</td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-slate-400">-</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Check className="mx-auto h-5 w-5 text-green-600" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Check className="mx-auto h-5 w-5 text-green-600" />
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm text-slate-700">Priority support</td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-slate-400">-</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Check className="mx-auto h-5 w-5 text-green-600" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Check className="mx-auto h-5 w-5 text-green-600" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

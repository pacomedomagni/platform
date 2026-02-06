'use client';

import { motion } from 'framer-motion';
import {
  Building2,
  Package,
  ShoppingCart,
  Store,
  CreditCard,
  Mail,
  BarChart3,
  Eye,
} from 'lucide-react';

const features = [
  {
    icon: Building2,
    title: 'Multi-Tenant Architecture',
    description: 'Serve multiple businesses from one platform. Isolated data, shared infrastructure, infinite scalability.',
    gradient: 'from-blue-500 to-blue-600',
  },
  {
    icon: Package,
    title: 'Inventory Management',
    description: 'Real-time stock tracking with batch & serial number support. Multi-location warehousing with FIFO costing.',
    gradient: 'from-purple-500 to-purple-600',
  },
  {
    icon: ShoppingCart,
    title: 'Order Processing',
    description: 'Automated workflows from cart to delivery. Order tracking, fulfillment management, and accounting integration.',
    gradient: 'from-pink-500 to-pink-600',
  },
  {
    icon: Store,
    title: 'Customer Portal',
    description: 'Beautiful storefront with product variants, customer reviews, and real-time inventory synchronization.',
    gradient: 'from-indigo-500 to-indigo-600',
  },
  {
    icon: CreditCard,
    title: 'Payment Processing',
    description: 'Stripe integration with secure checkout. Support for multiple payment methods and automatic receipt generation.',
    gradient: 'from-cyan-500 to-cyan-600',
  },
  {
    icon: Mail,
    title: 'Email Automation',
    description: 'Email verification, order receipts, abandoned cart recovery. Customizable templates and notification preferences.',
    gradient: 'from-teal-500 to-teal-600',
  },
  {
    icon: BarChart3,
    title: 'Admin Dashboard',
    description: 'Comprehensive reporting and analytics. Track sales, inventory levels, customer behavior, and financial metrics.',
    gradient: 'from-orange-500 to-orange-600',
  },
  {
    icon: Eye,
    title: 'Accessibility First',
    description: 'WCAG 2.1 AA compliant out of the box. Keyboard navigation, screen reader support, high contrast modes.',
    gradient: 'from-emerald-500 to-emerald-600',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
};

export function FeaturesGrid() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-base font-semibold leading-7 text-blue-600">Everything You Need</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Enterprise features for modern commerce
          </p>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            Built from the ground up to handle complex e-commerce operations at scale. No compromises, no limitations.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="mx-auto mt-16 grid max-w-7xl grid-cols-1 gap-8 sm:mt-20 md:grid-cols-2 lg:grid-cols-3 lg:gap-10"
        >
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                variants={itemVariants}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/50"
              >
                {/* Gradient background on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                <div className="relative">
                  <div
                    className={`inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${feature.gradient} shadow-lg transition-transform group-hover:scale-110`}
                  >
                    <Icon className="h-7 w-7 text-white" />
                  </div>

                  <h3 className="mt-6 text-xl font-semibold text-slate-900">{feature.title}</h3>
                  <p className="mt-3 text-base leading-7 text-slate-600">{feature.description}</p>

                  {/* Decorative element */}
                  <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 opacity-0 blur-2xl transition-opacity group-hover:opacity-30" />
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Additional features callout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mt-16 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-8 sm:p-12"
        >
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="text-center lg:text-left">
              <p className="text-3xl font-bold text-slate-900">50+</p>
              <p className="mt-2 text-sm text-slate-600">Built-in features ready to use</p>
            </div>
            <div className="text-center lg:text-left">
              <p className="text-3xl font-bold text-slate-900">24/7</p>
              <p className="mt-2 text-sm text-slate-600">Expert support and monitoring</p>
            </div>
            <div className="text-center lg:text-left">
              <p className="text-3xl font-bold text-slate-900">99.9%</p>
              <p className="mt-2 text-sm text-slate-600">Guaranteed uptime SLA</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

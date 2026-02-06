'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

const faqs = [
  {
    question: 'How long does setup take?',
    answer:
      'Most businesses are up and running within 30 minutes. Our onboarding wizard guides you through account setup, product imports, payment configuration, and branding customization. For more complex migrations, our support team can help you complete setup within 1-2 business days.',
  },
  {
    question: 'Do I need technical knowledge to use NoSlag?',
    answer:
      'No technical knowledge is required. NoSlag is designed to be user-friendly and intuitive. We provide a visual dashboard, drag-and-drop interfaces, and step-by-step guides. If you can use a spreadsheet, you can use NoSlag. For advanced customizations, our developer-friendly API is available.',
  },
  {
    question: 'Can I migrate existing data from another platform?',
    answer:
      'Yes! We support data imports from CSV files, Excel spreadsheets, and direct migrations from popular platforms like Shopify, WooCommerce, and Magento. Our import tool handles products, customers, orders, and inventory. Professional and Enterprise plans include dedicated migration assistance.',
  },
  {
    question: 'What payment methods are supported?',
    answer:
      'NoSlag integrates with Stripe for payment processing, supporting all major credit cards, debit cards, Apple Pay, Google Pay, and ACH bank transfers. We handle secure checkout, PCI compliance, and automatic receipt generation. Additional payment gateways can be integrated on Enterprise plans.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Absolutely. NoSlag is SOC 2 Type II compliant with enterprise-grade security. We use AES-256 encryption for data at rest, TLS 1.3 for data in transit, and maintain daily encrypted backups. Our infrastructure is hosted on AWS with 99.9% uptime SLA. We never share your data with third parties.',
  },
  {
    question: 'Do you offer support?',
    answer:
      'Yes! All plans include email support with response times under 24 hours. Professional plans include priority support with 4-hour response times. Enterprise plans get a dedicated support manager with phone and video call support. We also have extensive documentation, video tutorials, and community forums.',
  },
  {
    question: 'What happens after the free trial?',
    answer:
      'Your 14-day free trial includes full access to all features in your chosen plan. No credit card is required to start. At the end of the trial, you can choose to continue with a paid subscription or your account will be paused. Your data is preserved for 30 days in case you decide to reactivate.',
  },
  {
    question: 'Can I change plans later?',
    answer:
      'Yes, you can upgrade or downgrade your plan at any time. When upgrading, new features are available immediately. When downgrading, changes take effect at the end of your current billing cycle. We prorate charges when upgrading mid-cycle to ensure fair billing.',
  },
];

export function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-base font-semibold leading-7 text-blue-600">FAQ</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Frequently asked questions
          </p>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            Have a different question? Contact our support team and we will get back to you within 24 hours.
          </p>
        </motion.div>

        {/* FAQ accordion */}
        <div className="mx-auto mt-16 max-w-3xl">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ delay: index * 0.05, duration: 0.4 }}
              className="mb-4"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              >
                <span className="pr-6 text-lg font-semibold text-slate-900">{faq.question}</span>
                <motion.div
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                  className="shrink-0"
                >
                  <ChevronDown className="h-6 w-6 text-slate-600" />
                </motion.div>
              </button>

              <AnimatePresence initial={false}>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-6 pt-4 text-base leading-7 text-slate-600">{faq.answer}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {/* Contact support CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mt-16 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-purple-50 p-8 text-center"
        >
          <h3 className="text-xl font-semibold text-slate-900">Still have questions?</h3>
          <p className="mt-2 text-slate-600">
            Our support team is here to help. Get in touch and we will respond within 24 hours.
          </p>
          <button className="mt-6 rounded-lg border border-blue-600 bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-600/30 transition-all hover:bg-blue-700 hover:shadow-xl">
            Contact Support
          </button>
        </motion.div>
      </div>
    </section>
  );
}

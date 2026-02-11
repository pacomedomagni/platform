'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Calendar } from 'lucide-react';
import { ButtonLink } from '@/app/storefront/_components/button-link';

export function CTASection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-blue-900 via-purple-900 to-slate-900 py-20 sm:py-28">
      {/* Animated background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-600/30 via-purple-600/20 to-transparent" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Ready to Transform Your E-Commerce?
          </h2>
          <p className="mt-6 text-lg leading-8 text-slate-300 sm:text-xl">
            Join thousands of businesses already using NoSlag to power their online stores. Start your free trial
            today—no credit card required.
          </p>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center"
          >
            <ButtonLink
              href="/signup"
              className="group bg-white px-8 py-6 text-base font-semibold text-slate-900 shadow-xl hover:bg-slate-50"
            >
              Start Free Trial
              <ArrowRight className="ml-2 inline h-5 w-5 transition-transform group-hover:translate-x-1" />
            </ButtonLink>
            <button className="group inline-flex items-center justify-center gap-2 rounded-lg border-2 border-white/30 bg-white/10 px-8 py-6 text-base font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30">
              <Calendar className="h-5 w-5" />
              Schedule Demo
            </button>
          </motion.div>

          {/* Trust indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-slate-400"
          >
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              14-day free trial
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              No credit card required
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Cancel anytime
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

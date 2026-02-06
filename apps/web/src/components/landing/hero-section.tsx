'use client';

import { motion } from 'framer-motion';
import { Play, ShieldCheck, Award, Zap } from 'lucide-react';
import { ButtonLink } from '@/app/storefront/_components/button-link';
import { Badge } from '@platform/ui';
import { useState } from 'react';

export function HeroSection() {
  const [showVideoModal, setShowVideoModal] = useState(false);

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600/20 via-purple-600/20 to-transparent opacity-50" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-purple-600/20 via-blue-600/20 to-transparent opacity-50" />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

      <div className="relative mx-auto max-w-7xl px-6 py-20 sm:py-28 lg:px-8 lg:py-32">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left column - Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col justify-center"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <Badge variant="outline" className="mb-6 border-blue-400/30 bg-blue-500/10 text-blue-200 backdrop-blur-sm">
                Enterprise E-Commerce Platform
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl"
            >
              Build Your E-Commerce{' '}
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Empire
              </span>{' '}
              with NoSlag
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="mt-6 text-lg leading-8 text-slate-300 sm:text-xl"
            >
              Enterprise-grade multi-tenant platform with built-in inventory, orders, payments, and customer management.
              Everything you need to launch and scale your e-commerce business.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center"
            >
              <ButtonLink
                href="/storefront/account/register"
                className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6 text-base font-semibold text-white shadow-xl shadow-blue-900/50 hover:shadow-2xl hover:shadow-blue-900/60"
              >
                Start Free Trial
              </ButtonLink>
              <button
                onClick={() => setShowVideoModal(true)}
                className="group inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-8 py-6 text-base font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                <Play className="h-5 w-5 transition-transform group-hover:scale-110" />
                Watch Demo
              </button>
            </motion.div>

            {/* Trust badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.6 }}
              className="mt-12 grid grid-cols-3 gap-6"
            >
              <div className="flex flex-col items-center rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <ShieldCheck className="h-6 w-6 text-blue-400" />
                <p className="mt-2 text-xs font-medium text-slate-300">SOC 2 Compliant</p>
              </div>
              <div className="flex flex-col items-center rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <Award className="h-6 w-6 text-purple-400" />
                <p className="mt-2 text-xs font-medium text-slate-300">WCAG AA</p>
              </div>
              <div className="flex flex-col items-center rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <Zap className="h-6 w-6 text-pink-400" />
                <p className="mt-2 text-xs font-medium text-slate-300">99.9% Uptime</p>
              </div>
            </motion.div>
          </motion.div>

          {/* Right column - Dashboard preview */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="relative flex items-center justify-center"
          >
            <div className="relative w-full">
              {/* Glow effect */}
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-blue-600 to-purple-600 opacity-20 blur-3xl" />

              {/* Dashboard mockup */}
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl">
                <div className="border-b border-white/10 bg-slate-900/50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <div className="h-3 w-3 rounded-full bg-yellow-500" />
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                  </div>
                </div>
                <div className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="h-8 w-32 rounded-md bg-gradient-to-r from-blue-600 to-purple-600" />
                    <div className="h-8 w-24 rounded-md bg-slate-700" />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2 rounded-lg bg-slate-800/50 p-4">
                      <div className="h-4 w-20 rounded bg-slate-700" />
                      <div className="h-8 w-24 rounded bg-gradient-to-r from-blue-500 to-blue-600" />
                    </div>
                    <div className="space-y-2 rounded-lg bg-slate-800/50 p-4">
                      <div className="h-4 w-20 rounded bg-slate-700" />
                      <div className="h-8 w-24 rounded bg-gradient-to-r from-purple-500 to-purple-600" />
                    </div>
                    <div className="space-y-2 rounded-lg bg-slate-800/50 p-4">
                      <div className="h-4 w-20 rounded bg-slate-700" />
                      <div className="h-8 w-24 rounded bg-gradient-to-r from-pink-500 to-pink-600" />
                    </div>
                  </div>
                  <div className="mt-6 space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-800/30 p-3">
                        <div className="h-10 w-10 rounded-lg bg-slate-700" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-full rounded bg-slate-700" />
                          <div className="h-3 w-3/4 rounded bg-slate-700/50" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Video modal */}
      {showVideoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowVideoModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-4xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowVideoModal(false)}
              className="absolute -top-12 right-4 text-white hover:text-slate-300"
            >
              <span className="text-3xl">&times;</span>
            </button>
            <div className="aspect-video overflow-hidden rounded-xl bg-slate-900">
              <div className="flex h-full items-center justify-center text-white">
                <p className="text-lg">Demo video would be embedded here</p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </section>
  );
}

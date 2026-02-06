'use client';

import { motion } from 'framer-motion';
import { UserPlus, Settings, Rocket, ArrowRight } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: UserPlus,
    title: 'Sign Up',
    description: 'Create your account in 30 seconds. No credit card required for the 14-day free trial.',
    features: ['Email verification', 'Choose your subdomain', 'Select your plan'],
    gradient: 'from-blue-600 to-blue-700',
  },
  {
    number: '02',
    icon: Settings,
    title: 'Configure',
    description: 'Add products, set up payments with Stripe, and customize your branding to match your business.',
    features: ['Import products', 'Connect payment gateway', 'Customize theme'],
    gradient: 'from-purple-600 to-purple-700',
  },
  {
    number: '03',
    icon: Rocket,
    title: 'Launch',
    description: 'Go live and start selling immediately. Your storefront and admin dashboard are ready to use.',
    features: ['Publish storefront', 'Accept orders', 'Track everything'],
    gradient: 'from-pink-600 to-pink-700',
  },
];

export function HowItWorks() {
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
          <h2 className="text-base font-semibold leading-7 text-blue-600">Simple Process</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Launch in 3 easy steps
          </p>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            Get your e-commerce business up and running in minutes, not weeks. No technical knowledge required.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="mx-auto mt-16 max-w-6xl">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.number}>
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ delay: index * 0.2, duration: 0.6 }}
                  className="relative grid gap-8 lg:grid-cols-2 lg:items-center"
                >
                  {/* Left side - Content */}
                  <div className={`order-2 ${index % 2 === 1 ? 'lg:order-1' : ''}`}>
                    <div className="relative">
                      {/* Number badge */}
                      <div className="inline-flex items-center gap-3">
                        <div
                          className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${step.gradient} shadow-lg`}
                        >
                          <span className="text-2xl font-bold text-white">{step.number}</span>
                        </div>
                        <h3 className="text-3xl font-bold text-slate-900">{step.title}</h3>
                      </div>

                      <p className="mt-6 text-lg leading-8 text-slate-600">{step.description}</p>

                      {/* Features list */}
                      <ul className="mt-6 space-y-3">
                        {step.features.map((feature) => (
                          <li key={feature} className="flex items-center gap-3 text-slate-700">
                            <div className={`h-2 w-2 rounded-full bg-gradient-to-r ${step.gradient}`} />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Right side - Visual */}
                  <div className={`order-1 ${index % 2 === 1 ? 'lg:order-2' : ''}`}>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.2 + 0.3, duration: 0.6 }}
                      className="relative"
                    >
                      {/* Glow effect */}
                      <div
                        className={`absolute -inset-4 rounded-3xl bg-gradient-to-r ${step.gradient} opacity-10 blur-3xl`}
                      />

                      {/* Icon card */}
                      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-12 shadow-lg">
                        <div
                          className={`mx-auto flex h-32 w-32 items-center justify-center rounded-3xl bg-gradient-to-br ${step.gradient} shadow-2xl`}
                        >
                          <Icon className="h-16 w-16 text-white" />
                        </div>

                        {/* Decorative elements */}
                        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 opacity-30 blur-3xl" />
                        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 opacity-30 blur-3xl" />
                      </div>
                    </motion.div>
                  </div>
                </motion.div>

                {/* Arrow connector (except after last step) */}
                {index < steps.length - 1 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.2 + 0.5, duration: 0.4 }}
                    className="my-12 flex justify-center"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200">
                      <ArrowRight className="h-6 w-6 rotate-90 text-slate-600 lg:rotate-0" />
                    </div>
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>

        {/* CTA at the bottom */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="mt-16 text-center"
        >
          <p className="text-lg font-semibold text-slate-900">
            Ready to get started?{' '}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Join thousands of businesses
            </span>{' '}
            already using NoSlag.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

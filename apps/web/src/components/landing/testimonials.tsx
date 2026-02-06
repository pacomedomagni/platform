'use client';

import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';

const testimonials = [
  {
    quote:
      'NoSlag transformed our operations. We went from managing inventory in spreadsheets to a fully automated system in just 2 weeks. Sales increased 40% in the first quarter.',
    author: 'Sarah Johnson',
    role: 'CEO',
    company: 'TechGear Store',
    avatar: 'SJ',
    rating: 5,
  },
  {
    quote:
      'The multi-tenant architecture is brilliant. We manage 5 different brands from one dashboard. The cost savings and efficiency gains are incredible.',
    author: 'Michael Chen',
    role: 'Operations Director',
    company: 'Retail Ventures',
    avatar: 'MC',
    rating: 5,
  },
  {
    quote:
      'Best e-commerce platform we have used. The accessibility features are top-notch, and customer support is incredibly responsive. Highly recommend for any serious business.',
    author: 'Emily Rodriguez',
    role: 'Founder',
    company: 'GreenLife Organics',
    avatar: 'ER',
    rating: 5,
  },
];

const companyLogos = [
  { name: 'TechGear', color: 'blue' },
  { name: 'Retail Co', color: 'purple' },
  { name: 'GreenLife', color: 'emerald' },
  { name: 'StyleHub', color: 'pink' },
  { name: 'FreshMart', color: 'orange' },
  { name: 'UrbanWear', color: 'indigo' },
];

const stats = [
  { value: '10,000+', label: 'Products Managed' },
  { value: '50,000+', label: 'Orders Processed' },
  { value: '99.9%', label: 'Uptime' },
  { value: '4.9/5', label: 'Customer Rating' },
];

export function Testimonials() {
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
          <h2 className="text-base font-semibold leading-7 text-blue-600">Testimonials</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Loved by businesses worldwide
          </p>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            Join thousands of companies that trust NoSlag to power their e-commerce operations.
          </p>
        </motion.div>

        {/* Testimonial cards */}
        <div className="mx-auto mt-16 grid max-w-7xl grid-cols-1 gap-8 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ delay: index * 0.1, duration: 0.6 }}
              className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-sm hover:shadow-lg"
            >
              {/* Quote icon */}
              <Quote className="absolute -right-4 -top-4 h-24 w-24 text-slate-100" />

              <div className="relative">
                {/* Star rating */}
                <div className="flex gap-1">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>

                {/* Quote */}
                <p className="mt-4 text-base leading-7 text-slate-700">{testimonial.quote}</p>

                {/* Author */}
                <div className="mt-6 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-sm font-semibold text-white">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{testimonial.author}</p>
                    <p className="text-sm text-slate-600">
                      {testimonial.role}, {testimonial.company}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Company logos */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mt-20"
        >
          <p className="text-center text-sm font-semibold text-slate-600">Trusted by leading brands</p>
          <div className="mt-8 grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-6">
            {companyLogos.map((logo, index) => (
              <motion.div
                key={logo.name}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05, duration: 0.4 }}
                className="flex items-center justify-center"
              >
                <div className="group flex h-20 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md">
                  <div
                    className={`text-lg font-bold text-${logo.color}-600 transition-transform group-hover:scale-110`}
                  >
                    {logo.name}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Stats counter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mt-20 grid grid-cols-2 gap-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm md:grid-cols-4 lg:p-12"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 + index * 0.1, duration: 0.4 }}
              className="text-center"
            >
              <p className="text-3xl font-bold text-slate-900 sm:text-4xl">{stat.value}</p>
              <p className="mt-2 text-sm text-slate-600">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

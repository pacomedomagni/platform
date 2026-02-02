'use client';
import { Card, Button, Badge } from '@noslag/ui';
import { ArrowUpRight, DollarSign, Users, Activity, ShoppingCart } from 'lucide-react';

export default function Dashboard() {
  const stats = [
    { label: 'Total Revenue', value: '$45,231.89', change: '+20.1% from last month', icon: DollarSign },
    { label: 'Active Users', value: '+2350', change: '+180.1% from last month', icon: Users },
    { label: 'Sales', value: '+12,234', change: '+19% from last month', icon: ShoppingCart },
    { label: 'Active Now', value: '+573', change: '+201 since last hour', icon: Activity },
  ];

  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-slate-500">Overview of your system performance.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <span className="text-sm font-medium text-slate-500">
                {stat.label}
              </span>
              <stat.icon className="h-4 w-4 text-slate-500" />
            </div>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-slate-500 mt-1">
              {stat.change}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 p-6">
          <div className="mb-4">
            <h3 className="text-lg font-medium leading-none">Overview</h3>
          </div>
          <div className="h-[300px] w-full bg-slate-100 dark:bg-slate-800 rounded-md flex items-center justify-center text-slate-400">
            [Chart Placeholder]
          </div>
        </Card>
        <Card className="col-span-3 p-6">
           <div className="mb-4">
            <h3 className="text-lg font-medium leading-none">Recent Activity</h3>
            <p className="text-sm text-slate-500">You made 265 sales this month.</p>
          </div>
           <div className="space-y-8">
             {[1,2,3,4,5].map(i => (
                <div key={i} className="flex items-center">
                   <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700">
                      U{i}
                   </div>
                   <div className="ml-4 space-y-1">
                     <p className="text-sm font-medium leading-none">User Name {i}</p>
                     <p className="text-sm text-slate-500">user{i}@example.com</p>
                   </div>
                   <div className="ml-auto font-medium">+$1,999.00</div>
                </div>
             ))}
           </div>
        </Card>
      </div>
    </div>
  );
}

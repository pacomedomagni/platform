/**
 * Customer Login Page
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Input, Label, Button } from '@noslag/ui';
import { useAuthStore } from '../../../../lib/auth-store';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    
    try {
      await login(email, password);
      router.push('/storefront/account');
    } catch {
      // Error is handled by the store
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-6 py-20">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-semibold text-slate-900">Welcome back</h1>
        <p className="text-sm text-slate-500 mt-2">Sign in to your account</p>
      </div>

      <Card className="border-slate-200/70 bg-white p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/storefront/account/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="h-11"
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 text-white"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          Don't have an account?{' '}
          <Link href="/storefront/account/register" className="text-blue-600 hover:text-blue-500 font-semibold">
            Create one
          </Link>
        </div>
      </Card>
    </div>
  );
}

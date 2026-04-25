'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input, Card, Label } from '@platform/ui';
import { Loader2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import api from '../../lib/api';

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get('redirect');
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;
        setLoading(true);
        setError('');
        try {
            const res = await api.post('/auth/login', { email, password });
            const { access_token, refresh_token, user } = res.data;

            localStorage.setItem('access_token', access_token);
            if (refresh_token) {
              localStorage.setItem('refresh_token', refresh_token);
            }
            localStorage.setItem('user', JSON.stringify(user));
            if (user?.tenantId) {
                localStorage.setItem('tenantId', user.tenantId);
            }

            router.replace(redirectTo || '/app');
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
            <div className="w-full max-w-md space-y-8 relative">

                {/* Logo / Brand */}
                <div className="flex flex-col items-center justify-center text-center space-y-2">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-600 via-blue-500 to-amber-400 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                         <ShieldCheck className="h-7 w-7" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                            NoSlag
                        </h2>
                        <p className="text-slate-500 mt-2">
                            Sign in to your store
                        </p>
                    </div>
                </div>

                <Card className="p-8 border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900">
                    <form onSubmit={handleLogin} className="space-y-6" noValidate>
                        {error && (
                            <div role="alert" aria-live="assertive" className="p-3 text-sm text-red-500 bg-red-50 rounded-md border border-red-100">
                                {error}
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="login-email">Email address</Label>
                            <Input
                                id="login-email"
                                name="email"
                                type="email"
                                inputMode="email"
                                autoComplete="email"
                                placeholder="name@company.com"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="h-11"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="login-password">Password</Label>
                                <Link href="/forgot-password" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                                    Forgot password?
                                </Link>
                            </div>
                            <div className="relative">
                                <Input
                                    id="login-password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="h-11 pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <Button type="submit" aria-busy={loading} className="w-full h-11 text-base bg-gradient-to-r from-indigo-600 via-blue-600 to-amber-400 text-white shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...
                                </>
                            ) : (
                                'Sign in'
                            )}
                        </Button>
                    </form>

                    <div className="mt-6 text-center text-sm text-slate-500">
                        Don&apos;t have an account?{' '}
                        <Link href="/signup" className="font-medium text-indigo-600 hover:text-indigo-500">
                            Start free trial
                        </Link>
                    </div>
                </Card>

                <p className="text-center text-xs text-slate-400">
                    &copy; 2026 NoSlag Inc. All rights reserved.
                </p>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense>
            <LoginForm />
        </Suspense>
    );
}

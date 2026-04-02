import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { sanitizeErrorMessage } from '@/lib/security';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { authError } = useAuth();

    // Show error passed from ProtectedRoute or AuthContext
    const locationError = (location.state as any)?.error as string | undefined;

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                throw error;
            }

            if (!data.user) {
                throw new Error("No user returned from login");
            }

            toast.success('Logged in successfully');
            navigate('/');
        } catch (error: any) {
            toast.error(sanitizeErrorMessage(error, 'Error logging in'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-muted/40 px-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1 flex flex-col items-center">
                    <img
                        src="/DAP-Logo-Ver03.png"
                        alt="DAP Logo"
                        className="h-[6rem] w-auto mb-2"
                    />
                    <CardTitle className="text-2xl font-normal text-center text-[#fea106]">DAP CaseView</CardTitle>

                </CardHeader>
                <form onSubmit={handleLogin}>
                    <CardContent className="space-y-4">
                        {(authError || locationError) && (
                            <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <span>{authError || locationError}</span>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="m@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                    )}
                                    <span className="sr-only">
                                        {showPassword ? "Hide password" : "Show password"}
                                    </span>
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-3">
                        <Button className="w-full" type="submit" disabled={loading}>
                            {loading ? 'Logging in...' : 'Login'}
                        </Button>
                        <p className="text-sm text-muted-foreground text-center">
                            Need an account? Contact your system Administrator
                        </p>
                    </CardFooter>
                </form>
            </Card>
            <div className="mt-6 flex flex-col items-center gap-1">
                <img
                    src="/VENTURA-CANADA-INC-white-cc55ff.svg"
                    alt="Ventura Canada Inc."
                    className="h-7 object-contain"
                />
                <p className="text-[10px] text-muted-foreground">
                    Powered by Ventura Canada Inc.
                </p>
            </div>
        </div>
    );
};

export default Login;

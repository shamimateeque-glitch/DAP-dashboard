import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { session, appUser, loading, authError, signOut } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!session) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Session exists but no app user profile loaded — show error
    if (!appUser) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-muted/40 px-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="space-y-1 text-center">
                        <div className="flex justify-center mb-2">
                            <AlertCircle className="h-10 w-10 text-destructive" />
                        </div>
                        <CardTitle className="text-xl">Account Issue</CardTitle>
                        <CardDescription>
                            {authError || 'Your user profile could not be loaded. Please contact an administrator.'}
                        </CardDescription>
                    </CardHeader>
                    <CardFooter className="flex justify-center">
                        <Button variant="outline" onClick={() => signOut()}>
                            Back to Login
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return <>{children}</>;
};

export default ProtectedRoute;

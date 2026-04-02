import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
                    <div className="max-w-md w-full p-8 rounded-xl bg-card border shadow-xl text-center space-y-6">
                        <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                            <AlertTriangle className="h-8 w-8" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold tracking-tight">Something went wrong</h2>
                            <p className="text-muted-foreground">
                                An unexpected error occurred. We've logged the details and will look into it.
                            </p>
                            {this.state.error && (
                                <div className="mt-4 p-3 bg-muted rounded text-xs font-mono text-left overflow-auto max-h-32 border">
                                    {this.state.error.message}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col gap-3">
                            <Button onClick={() => window.location.reload()} className="w-full">
                                <RefreshCcw className="mr-2 h-4 w-4" /> Try Refreshing
                            </Button>
                            <Button onClick={() => window.location.href = '/'} variant="outline" className="w-full">
                                <Home className="mr-2 h-4 w-4" /> Back to Dashboard
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;

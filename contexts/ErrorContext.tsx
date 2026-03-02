import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { QAQCIssue } from '@/types/qaqc';

export type ErrorSeverity = 'BLOCKER' | 'ERROR' | 'WARN' | 'INFO';

export interface ValidationErrorData {
    issues: QAQCIssue[];
    totalCount: number;
}

export interface ParsingErrorData {
    fileName: string;
    maxSizeMB: number;
    supportedFormats: string[];
}

export interface ErrorState {
    visible: boolean;
    severity: ErrorSeverity;
    title: string;
    message: string;
    details?: string;
    validationData?: ValidationErrorData;
    parsingData?: ParsingErrorData;
    onRetry?: () => void;
    primaryAction?: {
        label: string;
        onPress: () => void | Promise<void>;
        style?: 'default' | 'destructive';
    };
}

interface ErrorContextType {
    showError: (params: Omit<ErrorState, 'visible'>) => void;
    hideError: () => void;
    error: ErrorState | null;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export function ErrorProvider({ children }: { children: ReactNode }) {
    const [error, setError] = useState<ErrorState | null>(null);

    const showError = useCallback((params: Omit<ErrorState, 'visible'>) => {
        setError({ ...params, visible: true });
    }, []);

    const hideError = useCallback(() => {
        setError(null);
    }, []);

    return (
        <ErrorContext.Provider value={{ showError, hideError, error }}>
            {children}
        </ErrorContext.Provider>
    );
}

export function useError() {
    const context = useContext(ErrorContext);
    if (!context) {
        throw new Error('useError must be used within an ErrorProvider');
    }
    return context;
}

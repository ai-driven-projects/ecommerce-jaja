export interface AuthLoginOverviewMetricsDTO {
    loginAttemptsCurrent7d: number;
    loginAttemptsPrevious7d: number;
    loginSuccessCurrent7d: number;
    loginFailureCurrent7d: number;
    loginFailuresLast24h: number;
    loginFailuresPrevious24h: number;
    activeUsersCurrent7d: number;
    criticalHighCurrent7d: number;
    criticalCriticalCurrent7d: number;
}


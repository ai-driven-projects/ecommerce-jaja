import { Result, UseCase } from "__SHARED_PACKAGE_NAME__";
import {
    AuthActivityRankingItemDTO,
    AuthAlertBoardItemDTO,
    AuthLatencyByWeekdayDTO,
    AuthLoginTimelinePointDTO,
    AuthTopFailedEmailDTO,
    FindAuthActivityRankingQuery,
    FindAuthAlertBoardQuery,
    FindAuthLatencyByWeekdayQuery,
    FindAuthLoginOverviewQuery,
    FindAuthLoginTimelineQuery,
    FindAuthTopFailedEmailsQuery,
} from "../../audit";

export interface GetAuthDashboardOverviewOut {
    login: {
        attempts: {
            total: number;
            previousTotal: number;
            variationPercent: number;
        };
        rate: {
            successPercent: number;
            failurePercent: number;
            successTotal: number;
            failureTotal: number;
        };
        last24hFailures: {
            total: number;
            previousTotal: number;
            deltaAbsolute: number;
        };
        activeUsers: {
            total: number;
        };
        criticalEvents: {
            total: number;
            high: number;
            critical: number;
        };
    };
    securityAccess: {
        loginTimelineByHour: AuthLoginTimelinePointDTO[];
        topFailedEmails: AuthTopFailedEmailDTO[];
        avgAuthLatencyByWeekday: AuthLatencyByWeekdayDTO[];
        alertBoard: Array<AuthAlertBoardItemDTO>;
    };
    administrativeActivity: {
        authActivityRanking: Array<AuthActivityRankingItemDTO>;
    };
}

export class GetAuthDashboardOverviewUseCase implements UseCase<
    void,
    GetAuthDashboardOverviewOut
> {
    constructor(
        private readonly findAuthLoginOverviewQuery: FindAuthLoginOverviewQuery,
        private readonly findAuthLoginTimelineQuery: FindAuthLoginTimelineQuery,
        private readonly findAuthTopFailedEmailsQuery: FindAuthTopFailedEmailsQuery,
        private readonly findAuthLatencyByWeekdayQuery: FindAuthLatencyByWeekdayQuery,
        private readonly findAuthAlertBoardQuery: FindAuthAlertBoardQuery,
        private readonly findAuthActivityRankingQuery: FindAuthActivityRankingQuery,
    ) {}

    async execute(): Promise<Result<GetAuthDashboardOverviewOut>> {
        return Result.tryAsync(async () => {
            const [
                overviewResult,
                timelineResult,
                topFailedEmailsResult,
                latencyResult,
                alertBoardResult,
                activityRankingResult,
            ] = await Promise.all([
                this.findAuthLoginOverviewQuery.execute(),
                this.findAuthLoginTimelineQuery.execute(),
                this.findAuthTopFailedEmailsQuery.execute(),
                this.findAuthLatencyByWeekdayQuery.execute(),
                this.findAuthAlertBoardQuery.execute(),
                this.findAuthActivityRankingQuery.execute(),
            ]);

            overviewResult.validator.throwsIfFailed();
            timelineResult.validator.throwsIfFailed();
            topFailedEmailsResult.validator.throwsIfFailed();
            latencyResult.validator.throwsIfFailed();
            alertBoardResult.validator.throwsIfFailed();
            activityRankingResult.validator.throwsIfFailed();

            const metrics = overviewResult.instance;

            return {
                login: {
                    attempts: this.buildLoginAttempts(
                        metrics.loginAttemptsCurrent7d,
                        metrics.loginAttemptsPrevious7d,
                    ),
                    rate: this.buildLoginRate(
                        metrics.loginSuccessCurrent7d,
                        metrics.loginFailureCurrent7d,
                    ),
                    last24hFailures: {
                        total: metrics.loginFailuresLast24h,
                        previousTotal: metrics.loginFailuresPrevious24h,
                        deltaAbsolute:
                            metrics.loginFailuresLast24h -
                            metrics.loginFailuresPrevious24h,
                    },
                    activeUsers: {
                        total: metrics.activeUsersCurrent7d,
                    },
                    criticalEvents: {
                        total:
                            metrics.criticalHighCurrent7d +
                            metrics.criticalCriticalCurrent7d,
                        high: metrics.criticalHighCurrent7d,
                        critical: metrics.criticalCriticalCurrent7d,
                    },
                },
                securityAccess: {
                    loginTimelineByHour: timelineResult.instance,
                    topFailedEmails: topFailedEmailsResult.instance,
                    avgAuthLatencyByWeekday: latencyResult.instance,
                    alertBoard: alertBoardResult.instance.map((item) => ({
                        severity: item.severity,
                        event: item.event,
                        detail: item.detail,
                        occurredAt: item.occurredAt,
                    })),
                },
                administrativeActivity: {
                    authActivityRanking: activityRankingResult.instance.map(
                        (item) => ({
                            user: item.user,
                            actions: item.actions,
                            lastActionAt: item.lastActionAt,
                        }),
                    ),
                },
            };
        });
    }

    private buildLoginAttempts(current: number, previous: number) {
        const variationPercent =
            previous > 0
                ? ((current - previous) / previous) * 100
                : current > 0
                  ? 100
                  : 0;

        return {
            total: current,
            previousTotal: previous,
            variationPercent: Number(variationPercent.toFixed(2)),
        };
    }

    private buildLoginRate(successTotal: number, failureTotal: number) {
        const total = successTotal + failureTotal;
        if (total === 0) {
            return {
                successPercent: 0,
                failurePercent: 0,
                successTotal,
                failureTotal,
            };
        }

        return {
            successPercent: Number(((successTotal / total) * 100).toFixed(2)),
            failurePercent: Number(((failureTotal / total) * 100).toFixed(2)),
            successTotal,
            failureTotal,
        };
    }
}

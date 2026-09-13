import { Result } from "__SHARED_PACKAGE_NAME__";
import { GetAuthDashboardOverviewUseCase } from "../../src/application/usecase/get-auth-dashboard-overview.usecase";
import {
    FindAuthLoginOverviewQuery,
    FindAuthLoginTimelineQuery,
    FindAuthTopFailedEmailsQuery,
    FindAuthLatencyByWeekdayQuery,
    FindAuthAlertBoardQuery,
    FindAuthActivityRankingQuery,
    AuthLoginOverviewMetricsDTO,
} from "../../src/audit";

const mockOverviewQuery: jest.Mocked<FindAuthLoginOverviewQuery> = {
    execute: jest.fn(),
};
const mockTimelineQuery: jest.Mocked<FindAuthLoginTimelineQuery> = {
    execute: jest.fn(),
};
const mockTopFailedQuery: jest.Mocked<FindAuthTopFailedEmailsQuery> = {
    execute: jest.fn(),
};
const mockLatencyQuery: jest.Mocked<FindAuthLatencyByWeekdayQuery> = {
    execute: jest.fn(),
};
const mockAlertBoardQuery: jest.Mocked<FindAuthAlertBoardQuery> = {
    execute: jest.fn(),
};
const mockActivityRankingQuery: jest.Mocked<FindAuthActivityRankingQuery> = {
    execute: jest.fn(),
};

const overviewMetrics: AuthLoginOverviewMetricsDTO = {
    loginAttemptsCurrent7d: 100,
    loginAttemptsPrevious7d: 80,
    loginSuccessCurrent7d: 90,
    loginFailureCurrent7d: 10,
    loginFailuresLast24h: 5,
    loginFailuresPrevious24h: 3,
    activeUsersCurrent7d: 40,
    criticalHighCurrent7d: 2,
    criticalCriticalCurrent7d: 1,
};

function setupSuccessMocks() {
    mockOverviewQuery.execute.mockResolvedValue(Result.ok(overviewMetrics));
    mockTimelineQuery.execute.mockResolvedValue(Result.ok([]));
    mockTopFailedQuery.execute.mockResolvedValue(Result.ok([]));
    mockLatencyQuery.execute.mockResolvedValue(Result.ok([]));
    mockAlertBoardQuery.execute.mockResolvedValue(Result.ok([]));
    mockActivityRankingQuery.execute.mockResolvedValue(Result.ok([]));
}

describe("GetAuthDashboardOverviewUseCase", () => {
    let useCase: GetAuthDashboardOverviewUseCase;

    beforeEach(() => {
        jest.clearAllMocks();
        useCase = new GetAuthDashboardOverviewUseCase(
            mockOverviewQuery,
            mockTimelineQuery,
            mockTopFailedQuery,
            mockLatencyQuery,
            mockAlertBoardQuery,
            mockActivityRankingQuery,
        );
    });

    it("should return structured overview on success", async () => {
        setupSuccessMocks();

        const result = await useCase.execute();

        expect(result.isOk).toBe(true);
        const out = result.instance;

        expect(out.login.attempts.total).toBe(100);
        expect(out.login.attempts.previousTotal).toBe(80);
        expect(out.login.attempts.variationPercent).toBe(25);

        expect(out.login.rate.successTotal).toBe(90);
        expect(out.login.rate.failureTotal).toBe(10);
        expect(out.login.rate.successPercent).toBe(90);
        expect(out.login.rate.failurePercent).toBe(10);

        expect(out.login.last24hFailures.total).toBe(5);
        expect(out.login.last24hFailures.deltaAbsolute).toBe(2);

        expect(out.login.activeUsers.total).toBe(40);
        expect(out.login.criticalEvents.total).toBe(3);
        expect(out.login.criticalEvents.high).toBe(2);
        expect(out.login.criticalEvents.critical).toBe(1);
    });

    it("should propagate failure when overviewQuery fails", async () => {
        setupSuccessMocks();
        mockOverviewQuery.execute.mockResolvedValue(
            Result.fail("OVERVIEW_ERROR"),
        );

        const result = await useCase.execute();

        expect(result.isFailure).toBe(true);
        expect(result.errors?.[0]).toBe("OVERVIEW_ERROR");
    });

    it("should propagate failure when timelineQuery fails", async () => {
        setupSuccessMocks();
        mockTimelineQuery.execute.mockResolvedValue(
            Result.fail("TIMELINE_ERROR"),
        );

        const result = await useCase.execute();

        expect(result.isFailure).toBe(true);
    });

    it("should propagate failure when topFailedEmailsQuery fails", async () => {
        setupSuccessMocks();
        mockTopFailedQuery.execute.mockResolvedValue(
            Result.fail("TOP_FAILED_ERROR"),
        );

        const result = await useCase.execute();

        expect(result.isFailure).toBe(true);
    });

    it("should propagate failure when latencyQuery fails", async () => {
        setupSuccessMocks();
        mockLatencyQuery.execute.mockResolvedValue(
            Result.fail("LATENCY_ERROR"),
        );

        const result = await useCase.execute();

        expect(result.isFailure).toBe(true);
    });

    it("should propagate failure when alertBoardQuery fails", async () => {
        setupSuccessMocks();
        mockAlertBoardQuery.execute.mockResolvedValue(
            Result.fail("ALERT_ERROR"),
        );

        const result = await useCase.execute();

        expect(result.isFailure).toBe(true);
    });

    it("should propagate failure when activityRankingQuery fails", async () => {
        setupSuccessMocks();
        mockActivityRankingQuery.execute.mockResolvedValue(
            Result.fail("RANKING_ERROR"),
        );

        const result = await useCase.execute();

        expect(result.isFailure).toBe(true);
    });

    it("should compute variationPercent as 100 when previous is 0 and current > 0", async () => {
        setupSuccessMocks();
        mockOverviewQuery.execute.mockResolvedValue(
            Result.ok({
                ...overviewMetrics,
                loginAttemptsCurrent7d: 50,
                loginAttemptsPrevious7d: 0,
            }),
        );

        const result = await useCase.execute();

        expect(result.isOk).toBe(true);
        expect(result.instance.login.attempts.variationPercent).toBe(100);
    });

    it("should compute variationPercent as 0 when both current and previous are 0", async () => {
        setupSuccessMocks();
        mockOverviewQuery.execute.mockResolvedValue(
            Result.ok({
                ...overviewMetrics,
                loginAttemptsCurrent7d: 0,
                loginAttemptsPrevious7d: 0,
            }),
        );

        const result = await useCase.execute();

        expect(result.isOk).toBe(true);
        expect(result.instance.login.attempts.variationPercent).toBe(0);
    });

    it("should return zero percents when total logins is 0", async () => {
        setupSuccessMocks();
        mockOverviewQuery.execute.mockResolvedValue(
            Result.ok({
                ...overviewMetrics,
                loginSuccessCurrent7d: 0,
                loginFailureCurrent7d: 0,
            }),
        );

        const result = await useCase.execute();

        expect(result.isOk).toBe(true);
        expect(result.instance.login.rate.successPercent).toBe(0);
        expect(result.instance.login.rate.failurePercent).toBe(0);
    });

    it("should map alertBoard and activityRanking items correctly", async () => {
        setupSuccessMocks();
        mockAlertBoardQuery.execute.mockResolvedValue(
            Result.ok([
                {
                    severity: "HIGH",
                    event: "BruteForce",
                    detail: "5 failures",
                    occurredAt: new Date("2024-01-01"),
                },
            ]),
        );
        mockActivityRankingQuery.execute.mockResolvedValue(
            Result.ok([
                {
                    user: "admin@example.com",
                    actions: 42,
                    lastActionAt: new Date("2024-01-01"),
                },
            ]),
        );

        const result = await useCase.execute();

        expect(result.isOk).toBe(true);
        expect(result.instance.securityAccess.alertBoard[0].event).toBe(
            "BruteForce",
        );
        expect(
            result.instance.administrativeActivity.authActivityRanking[0].user,
        ).toBe("admin@example.com");
        expect(
            result.instance.administrativeActivity.authActivityRanking[0]
                .actions,
        ).toBe(42);
    });
});

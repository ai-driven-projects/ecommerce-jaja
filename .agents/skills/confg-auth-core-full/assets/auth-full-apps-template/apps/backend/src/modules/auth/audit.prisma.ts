import { Injectable } from '@nestjs/common';
import {
  Audit,
  AuditRepository,
  FindAuthActivityRankingQuery,
  AuthActivityRankingItemDTO,
  FindAuthAlertBoardQuery,
  AuthAlertBoardItemDTO,
  FindAuthLatencyByWeekdayQuery,
  AuthLatencyByWeekdayDTO,
  FindAuthLoginOverviewQuery,
  AuthLoginOverviewMetricsDTO,
  FindAuthLoginTimelineQuery,
  AuthLoginTimelinePointDTO,
  FindAuthTopFailedEmailsQuery,
  AuthTopFailedEmailDTO,
} from '__AUTH_PACKAGE_NAME__';
import { Result, TransactionContext } from '__SHARED_PACKAGE_NAME__';
import { PrismaService } from 'src/db/prisma.service';
import { resolvePrismaExecutor } from 'src/db/prisma-transaction.context';

@Injectable()
export class AuditPrisma implements AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly authEndpointPrefixes = ['/auth', '/roles'];

  readonly findAuthLoginOverviewQuery: FindAuthLoginOverviewQuery = {
    execute: async (): Promise<Result<AuthLoginOverviewMetricsDTO>> => {
      try {
        const now = new Date();
        const dayMs = 24 * 60 * 60 * 1000;

        const currentFrom = new Date(now.getTime() - 7 * dayMs);
        const previousFrom = new Date(currentFrom.getTime() - 7 * dayMs);
        const previousTo = new Date(currentFrom.getTime());
        const last24hFrom = new Date(now.getTime() - dayMs);
        const previous24hFrom = new Date(now.getTime() - 2 * dayMs);

        type OverviewRow = {
          login_attempts_current_7d: bigint | number | string | null;
          login_attempts_previous_7d: bigint | number | string | null;
          login_success_current_7d: bigint | number | string | null;
          login_failure_current_7d: bigint | number | string | null;
          login_failures_last_24h: bigint | number | string | null;
          login_failures_previous_24h: bigint | number | string | null;
          active_users_current_7d: bigint | number | string | null;
          critical_high_current_7d: bigint | number | string | null;
          critical_critical_current_7d: bigint | number | string | null;
        };

        const rows = await this.prisma.client.$queryRaw<OverviewRow[]>`
          WITH base_events AS (
            SELECT
              "type",
              "occurred_at",
              "method",
              "endpoint",
              "user_id",
              "criticality",
              "status_code"
            FROM "audit_events"
            WHERE "occurred_at" >= ${previousFrom}
              AND "occurred_at" <= ${now}
              AND (
                "endpoint" LIKE '/auth%'
                OR "endpoint" LIKE '/roles%'
              )
          ),
          login_events AS (
            SELECT *
            FROM base_events
            WHERE "type" = 'auth_login_attempt'
               OR ("endpoint" = '/auth/login' AND UPPER("method") = 'POST')
          )
          SELECT
            login_metrics.login_attempts_current_7d,
            login_metrics.login_attempts_previous_7d,
            login_metrics.login_success_current_7d,
            login_metrics.login_failure_current_7d,
            login_metrics.login_failures_last_24h,
            login_metrics.login_failures_previous_24h,
            base_metrics.active_users_current_7d,
            base_metrics.critical_high_current_7d,
            base_metrics.critical_critical_current_7d
          FROM (
            SELECT
              COUNT(*) FILTER (
                WHERE "occurred_at" >= ${currentFrom} AND "occurred_at" <= ${now}
              ) AS login_attempts_current_7d,
              COUNT(*) FILTER (
                WHERE "occurred_at" >= ${previousFrom} AND "occurred_at" < ${previousTo}
              ) AS login_attempts_previous_7d,
              COUNT(*) FILTER (
                WHERE "occurred_at" >= ${currentFrom}
                  AND "occurred_at" <= ${now}
                  AND "status_code" >= 200
                  AND "status_code" < 300
              ) AS login_success_current_7d,
              COUNT(*) FILTER (
                WHERE "occurred_at" >= ${currentFrom}
                  AND "occurred_at" <= ${now}
                  AND "status_code" >= 400
              ) AS login_failure_current_7d,
              COUNT(*) FILTER (
                WHERE "occurred_at" >= ${last24hFrom}
                  AND "occurred_at" <= ${now}
                  AND "status_code" >= 400
              ) AS login_failures_last_24h,
              COUNT(*) FILTER (
                WHERE "occurred_at" >= ${previous24hFrom}
                  AND "occurred_at" < ${last24hFrom}
                  AND "status_code" >= 400
              ) AS login_failures_previous_24h
            FROM login_events
          ) AS login_metrics
          CROSS JOIN (
            SELECT
              COUNT(DISTINCT "user_id") FILTER (
                WHERE "occurred_at" >= ${currentFrom}
                  AND "occurred_at" <= ${now}
                  AND "user_id" IS NOT NULL
              ) AS active_users_current_7d,
              COUNT(*) FILTER (
                WHERE "occurred_at" >= ${currentFrom}
                  AND "occurred_at" <= ${now}
                  AND "criticality" = 'HIGH'
              ) AS critical_high_current_7d,
              COUNT(*) FILTER (
                WHERE "occurred_at" >= ${currentFrom}
                  AND "occurred_at" <= ${now}
                  AND "criticality" = 'CRITICAL'
              ) AS critical_critical_current_7d
            FROM base_events
          ) AS base_metrics
        `;

        const row = rows[0];

        const toNumber = (value: bigint | number | string | null | undefined) =>
          Number(value ?? 0);

        return Result.ok({
          loginAttemptsCurrent7d: toNumber(row?.login_attempts_current_7d),
          loginAttemptsPrevious7d: toNumber(row?.login_attempts_previous_7d),
          loginSuccessCurrent7d: toNumber(row?.login_success_current_7d),
          loginFailureCurrent7d: toNumber(row?.login_failure_current_7d),
          loginFailuresLast24h: toNumber(row?.login_failures_last_24h),
          loginFailuresPrevious24h: toNumber(row?.login_failures_previous_24h),
          activeUsersCurrent7d: toNumber(row?.active_users_current_7d),
          criticalHighCurrent7d: toNumber(row?.critical_high_current_7d),
          criticalCriticalCurrent7d: toNumber(
            row?.critical_critical_current_7d,
          ),
        });
      } catch (error) {
        return Result.fail(error);
      }
    },
  };

  readonly findAuthLoginTimelineQuery: FindAuthLoginTimelineQuery = {
    execute: async (): Promise<Result<AuthLoginTimelinePointDTO[]>> => {
      try {
        const now = new Date();
        const currentFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        type TimelineRow = {
          hour: number | string;
          success: bigint | number | string | null;
          failure: bigint | number | string | null;
          total: bigint | number | string | null;
        };

        const rows = await this.prisma.client.$queryRaw<TimelineRow[]>`
          WITH base_events AS (
            SELECT "occurred_at", "method", "endpoint", "type", "status_code"
            FROM "audit_events"
            WHERE "occurred_at" >= ${currentFrom}
              AND "occurred_at" <= ${now}
              AND (
                "endpoint" LIKE '/auth%'
                OR "endpoint" LIKE '/roles%'
              )
          ),
          login_events AS (
            SELECT *
            FROM base_events
            WHERE "type" = 'auth_login_attempt'
               OR ("endpoint" = '/auth/login' AND UPPER("method") = 'POST')
          )
          SELECT
            EXTRACT(HOUR FROM "occurred_at" AT TIME ZONE 'UTC')::int AS hour,
            COUNT(*) FILTER (
              WHERE "status_code" >= 200 AND "status_code" < 300
            ) AS success,
            COUNT(*) FILTER (
              WHERE "status_code" >= 400
            ) AS failure,
            COUNT(*) AS total
          FROM login_events
          GROUP BY 1
          ORDER BY 1
        `;

        const byHour = new Map<number, AuthLoginTimelinePointDTO>();
        for (const row of rows) {
          const hour = Number(row.hour);
          byHour.set(hour, {
            hour,
            success: Number(row.success ?? 0),
            failure: Number(row.failure ?? 0),
            total: Number(row.total ?? 0),
          });
        }

        const timeline = Array.from({ length: 24 }, (_, hour) => {
          return (
            byHour.get(hour) ?? {
              hour,
              success: 0,
              failure: 0,
              total: 0,
            }
          );
        });

        return Result.ok(timeline);
      } catch (error) {
        return Result.fail(error);
      }
    },
  };

  readonly findAuthTopFailedEmailsQuery: FindAuthTopFailedEmailsQuery = {
    execute: async (): Promise<Result<AuthTopFailedEmailDTO[]>> => {
      try {
        const now = new Date();
        const currentFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        type TopEmailRow = {
          email: string;
          failures: bigint | number | string | null;
        };

        const rows = await this.prisma.client.$queryRaw<TopEmailRow[]>`
          WITH base_events AS (
            SELECT "occurred_at", "method", "endpoint", "type", "status_code", "user_email"
            FROM "audit_events"
            WHERE "occurred_at" >= ${currentFrom}
              AND "occurred_at" <= ${now}
              AND (
                "endpoint" LIKE '/auth%'
                OR "endpoint" LIKE '/roles%'
              )
          ),
          login_events AS (
            SELECT *
            FROM base_events
            WHERE "type" = 'auth_login_attempt'
               OR ("endpoint" = '/auth/login' AND UPPER("method") = 'POST')
          )
          SELECT
            LOWER("user_email") AS email,
            COUNT(*) AS failures
          FROM login_events
          WHERE "status_code" >= 400
            AND "user_email" IS NOT NULL
          GROUP BY 1
          ORDER BY failures DESC, email ASC
          LIMIT 5
        `;

        return Result.ok(
          rows.map((row) => ({
            email: row.email,
            failures: Number(row.failures ?? 0),
          })),
        );
      } catch (error) {
        return Result.fail(error);
      }
    },
  };

  readonly findAuthLatencyByWeekdayQuery: FindAuthLatencyByWeekdayQuery = {
    execute: async (): Promise<Result<AuthLatencyByWeekdayDTO[]>> => {
      try {
        const now = new Date();
        const currentFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        type LatencyRow = {
          weekday: number | string;
          avg_duration_ms: number | string | null;
          period_avg_duration_ms: number | string | null;
        };

        const rows = await this.prisma.client.$queryRaw<LatencyRow[]>`
          WITH scoped AS (
            SELECT "occurred_at", "duration_ms"
            FROM "audit_events"
            WHERE "occurred_at" >= ${currentFrom}
              AND "occurred_at" <= ${now}
              AND (
                "endpoint" LIKE '/auth%'
                OR "endpoint" LIKE '/roles%'
              )
          ),
          by_weekday AS (
            SELECT
              EXTRACT(DOW FROM "occurred_at" AT TIME ZONE 'UTC')::int AS weekday,
              AVG("duration_ms")::numeric AS avg_duration_ms
            FROM scoped
            GROUP BY 1
          ),
          period AS (
            SELECT AVG("duration_ms")::numeric AS period_avg_duration_ms
            FROM scoped
          )
          SELECT
            by_weekday.weekday,
            by_weekday.avg_duration_ms,
            period.period_avg_duration_ms
          FROM by_weekday
          CROSS JOIN period
          ORDER BY by_weekday.weekday
        `;

        const byWeekday = new Map<number, AuthLatencyByWeekdayDTO>();
        for (const row of rows) {
          const weekday = Number(row.weekday);
          byWeekday.set(weekday, {
            weekday,
            avgDurationMs: Number(Number(row.avg_duration_ms ?? 0).toFixed(2)),
            periodAvgDurationMs: Number(
              Number(row.period_avg_duration_ms ?? 0).toFixed(2),
            ),
          });
        }

        const periodAvgDurationMs =
          rows.length > 0
            ? Number(Number(rows[0]?.period_avg_duration_ms ?? 0).toFixed(2))
            : 0;

        const complete = Array.from({ length: 7 }, (_, weekday) => {
          return (
            byWeekday.get(weekday) ?? {
              weekday,
              avgDurationMs: 0,
              periodAvgDurationMs,
            }
          );
        });

        return Result.ok(complete);
      } catch (error) {
        return Result.fail(error);
      }
    },
  };

  readonly findAuthAlertBoardQuery: FindAuthAlertBoardQuery = {
    execute: async (): Promise<Result<AuthAlertBoardItemDTO[]>> => {
      try {
        const now = new Date();
        const currentFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        type AlertRow = {
          severity: 'HIGH' | 'CRITICAL';
          event: string;
          detail: string;
          occurred_at: Date | string;
        };

        const rows = await this.prisma.client.$queryRaw<AlertRow[]>`
          SELECT
            "criticality"::text AS severity,
            UPPER("method") || ' ' || "endpoint" AS event,
            COALESCE("status_code"::text, 'N/A') || ' - ' || COALESCE("user_email", 'anonymous') AS detail,
            "occurred_at"
          FROM "audit_events"
          WHERE "occurred_at" >= ${currentFrom}
            AND "occurred_at" <= ${now}
            AND (
              "endpoint" LIKE '/auth%'
              OR "endpoint" LIKE '/roles%'
            )
            AND "criticality" IN ('HIGH', 'CRITICAL')
          ORDER BY "occurred_at" DESC
          LIMIT 6
        `;

        return Result.ok(
          rows.map((row) => ({
            severity: row.severity,
            event: row.event,
            detail: row.detail,
            occurredAt: new Date(row.occurred_at),
          })),
        );
      } catch (error) {
        return Result.fail(error);
      }
    },
  };

  readonly findAuthActivityRankingQuery: FindAuthActivityRankingQuery = {
    execute: async (): Promise<Result<AuthActivityRankingItemDTO[]>> => {
      try {
        const now = new Date();
        const currentFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        type ActivityRow = {
          user: string;
          actions: bigint | number | string | null;
          last_action_at: Date | string;
        };

        const rows = await this.prisma.client.$queryRaw<ActivityRow[]>`
          SELECT
            LOWER(COALESCE("user_email", 'anonymous')) AS user,
            COUNT(*) AS actions,
            MAX("occurred_at") AS last_action_at
          FROM "audit_events"
          WHERE "occurred_at" >= ${currentFrom}
            AND "occurred_at" <= ${now}
            AND (
              "endpoint" LIKE '/auth%'
              OR "endpoint" LIKE '/roles%'
            )
          GROUP BY 1
          ORDER BY actions DESC, last_action_at DESC, user ASC
          LIMIT 10
        `;

        return Result.ok(
          rows.map((row) => ({
            user: row.user,
            actions: Number(row.actions ?? 0),
            lastActionAt: new Date(row.last_action_at),
          })),
        );
      } catch (error) {
        return Result.fail(error);
      }
    },
  };

  async create(entity: Audit, tx?: TransactionContext): Promise<Result<void>> {
    const client = resolvePrismaExecutor(tx, this.prisma.client);
    try {
      await client.$executeRaw`
        INSERT INTO "audit_events" (
          "id",
          "type",
          "occurred_at",
          "method",
          "endpoint",
          "user_id",
          "user_email",
          "permission_id",
          "permission_alias",
          "action",
          "criticality",
          "status_code",
          "duration_ms"
        ) VALUES (
          ${entity.id},
          ${entity.type},
          ${entity.occurredAt},
          ${entity.method},
          ${entity.endpoint},
          ${entity.userId ?? null},
          ${entity.userEmail ?? null},
          ${entity.permissionId ?? null},
          ${entity.permissionAlias ?? null},
          ${entity.action},
          ${entity.criticality},
          ${entity.statusCode ?? null},
          ${Math.max(0, Math.round(entity.durationMs))}
        )
      `;

      return Result.ok();
    } catch (error) {
      return Result.fail(error);
    }
  }
}

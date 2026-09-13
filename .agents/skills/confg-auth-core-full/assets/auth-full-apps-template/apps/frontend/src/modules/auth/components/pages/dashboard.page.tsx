"use client";

import React from "react";
import {
    Breadcrumb,
    Loading,
    PageHeader,
} from "@/shared";
import {
    ArrowPathIcon,
    CalendarDaysIcon,
} from "@heroicons/react/24/outline";
import { useAuthOverview } from "../../data";

function formatHour(hour: number) {
    return `${hour.toString().padStart(2, "0")}h`;
}

function weekdayName(weekday: number) {
    const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return days[weekday] ?? `D${weekday}`;
}

export function Dashboard() {
    const { overview, isLoading, refetch } = useAuthOverview();

    if (isLoading || !overview) {
        return <Loading />;
    }

    const { login, securityAccess, administrativeActivity } = overview;
    const attemptsVar = login.attempts.variationPercent;
    const failuresDelta = login.last24hFailures.deltaAbsolute;

    return (
        <div className="flex flex-col gap-6 p-4 sm:p-7">
            <PageHeader
                title="Dashboard de Autenticação"
                subtitle="Módulo de Auth · Últimos 7 dias"
                breadcrumb={
                    <Breadcrumb
                        items={[
                            { name: "Módulo", href: "/admin/auth", current: false },
                            { name: "Auth", href: "/admin/auth", current: false },
                            { name: "Dashboard", href: "/admin/auth", current: true },
                        ]}
                    />
                }
                actions={
                    <>
                        <button className="flex items-center gap-2 rounded-lg border border-border-card bg-bg-card px-4 py-2.5 text-[13px] font-medium text-text-secondary">
                            <CalendarDaysIcon className="size-4" />
                            Últimos 7 dias
                        </button>
                        <button
                            onClick={refetch}
                            className="flex items-center justify-center size-10 rounded-full bg-linear-to-r from-[#2563EB] to-[#4F46E5] text-text-on-accent hover:brightness-110 transition-all cursor-pointer"
                        >
                            <ArrowPathIcon className="size-4" />
                        </button>
                    </>
                }
            />

            <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-4">KPIs de Topo</p>
                <div className="grid gap-4 lg:grid-cols-5">
                    <div className="rounded-2xl bg-[#6FCFBE] border border-[#5AB8A8] p-5 flex flex-col gap-2.5">
                        <span className="text-xs font-semibold text-[#1A6156]">Tentativas de Login</span>
                        <span className="font-heading text-[34px] font-bold text-[#1A6156] leading-tight">
                            {login.attempts.total.toLocaleString("pt-BR")}
                        </span>
                        <span className="text-[11px] font-medium text-[#1A6156CC]">Últimos 7 dias</span>
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#1A615633] border border-[#1A615655] px-2.5 py-1 w-fit mt-auto">
                            <span className="text-[10px] font-bold text-[#1A6156]">
                                {attemptsVar >= 0 ? "↑" : "↓"} {attemptsVar >= 0 ? "+" : ""}{attemptsVar.toFixed(0)}% vs semana anterior
                            </span>
                        </div>
                    </div>

                    <div className="rounded-2xl bg-[#6F98E6] border border-[#5F84CA] p-5 flex flex-col gap-2.5">
                        <span className="text-xs font-semibold text-[#25508F]">Taxa de Sucesso</span>
                        <span className="font-heading text-[34px] font-bold text-[#25508F] leading-tight">
                            {login.rate.successPercent.toFixed(0)}%
                        </span>
                        <span className="text-[11px] font-medium text-[#25508FCC]">
                            {login.rate.successTotal} sucessos · {login.rate.failureTotal} falhas
                        </span>
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#25508F33] border border-[#25508F55] px-2.5 py-1 w-fit mt-auto">
                            <span className="text-[10px] font-bold text-[#25508F]">
                                Taxa de acerto no período
                            </span>
                        </div>
                    </div>

                    <div className="rounded-2xl bg-[#E6C983] border border-[#C8AA64] p-5 flex flex-col gap-2.5">
                        <span className="text-xs font-semibold text-[#7A5C19]">Falhas nas Últimas 24h</span>
                        <span className="font-heading text-[34px] font-bold text-[#7A5C19] leading-tight">
                            {login.last24hFailures.total}
                        </span>
                        <span className="text-[11px] font-medium text-[#7A5C19CC]">Falhas de login · 24h</span>
                        <div className="inline-flex items-center rounded-full bg-[#7A5C1933] border border-[#7A5C1955] px-2.5 py-1 w-fit mt-auto">
                            <span className="text-[10px] font-bold text-[#7A5C19]">
                                {failuresDelta >= 0 ? "+" : ""}{failuresDelta} vs dia anterior
                            </span>
                        </div>
                    </div>

                    <div className="rounded-2xl bg-[#E5966B] border border-[#C97B52] p-5 flex flex-col gap-2.5">
                        <span className="text-xs font-semibold text-[#7D4325]">Usuários Ativos</span>
                        <span className="font-heading text-[34px] font-bold text-[#7D4325] leading-tight">
                            {login.activeUsers.total}
                        </span>
                        <span className="text-[11px] font-medium text-[#7D4325CC]">Usuários distintos no período</span>
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#7D432533] border border-[#7D432555] px-2.5 py-1 w-fit mt-auto">
                            <span className="text-[10px] font-bold text-[#7D4325]">
                                {login.activeUsers.total} user_id distintos
                            </span>
                        </div>
                    </div>

                    <div className="rounded-2xl bg-[#B8A0E8] border border-[#9D86D0] p-5 flex flex-col gap-2.5">
                        <span className="text-xs font-semibold text-[#4A3278]">Eventos Críticos</span>
                        <span className="font-heading text-[34px] font-bold text-[#4A3278] leading-tight">
                            {login.criticalEvents.total}
                        </span>
                        <span className="text-[11px] font-medium text-[#4A3278CC]">Eventos de alta criticidade</span>
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#4A327833] border border-[#4A327855] px-2.5 py-1 w-fit mt-auto">
                            <span className="text-[10px] font-bold text-[#4A3278]">
                                {login.criticalEvents.high + login.criticalEvents.critical} no período
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-4">SEGURANÇA E ACESSO</p>
                <div className="flex flex-col gap-4 xl:flex-row">
                    <div className="w-full rounded-2xl border border-border-card bg-bg-card p-5 xl:w-[700px] xl:shrink-0">
                        <div className="flex items-center justify-between mb-2.5">
                            <h3 className="font-heading text-[15px] font-bold text-text-primary">Linha do Tempo de Login</h3>
                            <div className="flex items-center gap-3.5">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-0.5 rounded bg-[#22d3ee]" />
                                    <span className="text-[10px] text-text-muted">Sucesso</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-0.5 rounded bg-[#f43f5e]" />
                                    <span className="text-[10px] text-text-muted">Falha</span>
                                </div>
                            </div>
                        </div>
                        <div className="h-[240px] rounded-xl border border-border-card bg-bg-card-hover p-3">
                            <div className="relative h-full flex-1 overflow-hidden rounded-lg bg-bg-page/65">
                                {securityAccess.loginTimelineByHour.length > 0 ? (
                                    <svg className="w-full h-full" viewBox="0 0 660 180" preserveAspectRatio="none">
                                        <polyline
                                            fill="none" stroke="#22d3ee" strokeWidth="2"
                                            points={securityAccess.loginTimelineByHour.map((p, i) => {
                                                const x = (i / Math.max(securityAccess.loginTimelineByHour.length - 1, 1)) * 640 + 10;
                                                const maxVal = Math.max(...securityAccess.loginTimelineByHour.map(h => h.total), 1);
                                                const y = 170 - (p.success / maxVal) * 160;
                                                return `${x},${y}`;
                                            }).join(" ")}
                                        />
                                        <polyline
                                            fill="none" stroke="#f43f5e" strokeWidth="2"
                                            points={securityAccess.loginTimelineByHour.map((p, i) => {
                                                const x = (i / Math.max(securityAccess.loginTimelineByHour.length - 1, 1)) * 640 + 10;
                                                const maxVal = Math.max(...securityAccess.loginTimelineByHour.map(h => h.total), 1);
                                                const y = 170 - (p.failure / maxVal) * 160;
                                                return `${x},${y}`;
                                            }).join(" ")}
                                        />
                                    </svg>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-text-muted text-sm">Sem dados</div>
                                )}
                            </div>
                            <div className="flex justify-between mt-4 px-1">
                                {securityAccess.loginTimelineByHour.filter((_, i) => i % Math.ceil(securityAccess.loginTimelineByHour.length / 6) === 0).map((p) => (
                                    <span key={p.hour} className="text-[10px] text-text-muted">{formatHour(p.hour)}</span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex min-h-[260px] flex-1 flex-col rounded-2xl border border-border-card bg-bg-card p-5 xl:h-[320px]">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-heading text-[15px] font-bold text-text-primary">Top E-mails com Falha</h3>
                        </div>
                        <span className="text-[11px] font-medium text-text-muted mb-3">Falhas em /auth/login</span>
                        <div className="flex flex-col gap-2 flex-1 justify-between">
                            {securityAccess.topFailedEmails.length > 0 ? (
                                securityAccess.topFailedEmails.slice(0, 5).map((item) => {
                                    const max = Math.max(...securityAccess.topFailedEmails.map(e => e.failures), 1);
                                    return (
                                        <div key={item.email} className="flex items-center gap-2">
                                            <span className="text-[11px] text-text-muted truncate w-24 shrink-0 sm:w-[120px]">{item.email}</span>
                                            <div className="h-5 flex-1 overflow-hidden rounded bg-bg-input">
                                                <div className="h-full rounded bg-[#3B82F6]" style={{ width: `${(item.failures / max) * 100}%` }} />
                                            </div>
                                            <span className="text-[11px] font-bold text-text-secondary w-6 text-right">{item.failures}</span>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="flex items-center justify-center h-full text-text-muted text-sm">Nenhuma falha</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-border-card bg-bg-card p-5">
                    <h3 className="font-heading text-[15px] font-bold text-text-primary mb-1">Latência Média de Auth</h3>
                    <p className="text-[11px] font-medium text-text-muted mb-3">Média (ms) vs referência</p>
                    <div className="h-[210px] rounded-xl border border-border-card bg-bg-card-hover p-3">
                        <div className="relative h-full flex-1 overflow-hidden rounded-lg bg-bg-page/65">
                            {securityAccess.avgAuthLatencyByWeekday.length > 0 ? (
                                <svg className="w-full h-full" viewBox="0 0 500 150" preserveAspectRatio="none">
                                    <line x1="0" y1="75" x2="500" y2="75" stroke="var(--color-border-card)" strokeWidth="1" strokeDasharray="4" />
                                    {securityAccess.avgAuthLatencyByWeekday.map((item, i) => {
                                        const max = Math.max(...securityAccess.avgAuthLatencyByWeekday.map(d => d.avgDurationMs), 1);
                                        const barHeight = (item.avgDurationMs / max) * 120;
                                        const x = 20 + i * 68;
                                        return (
                                            <rect key={i} x={x} y={140 - barHeight} width="48" height={barHeight} rx="4"
                                                fill="url(#latGrad)" />
                                        );
                                    })}
                                    <defs>
                                        <linearGradient id="latGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#818cf8" />
                                            <stop offset="100%" stopColor="#6366f1" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            ) : (
                                <div className="flex items-center justify-center h-full text-text-muted text-sm">Sem dados</div>
                            )}
                        </div>
                        <div className="flex justify-between mt-2 px-1">
                            {securityAccess.avgAuthLatencyByWeekday.map((item) => (
                                <span key={item.weekday} className="text-[10px] text-text-muted">{weekdayName(item.weekday)}</span>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col rounded-2xl border border-border-card bg-bg-card p-5">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-heading text-[15px] font-bold text-text-primary">Mural de Alertas</h3>
                        <div className="flex items-center gap-1.5">
                            <div className="size-2 rounded-full bg-[#f43f5e] animate-pulse" />
                            <span className="text-[10px] font-semibold text-[#f43f5e]">ao vivo</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-1">
                        {securityAccess.alertBoard.length > 0 ? (
                            securityAccess.alertBoard.slice(0, 6).map((alert, i) => (
                                <div key={i} className={`flex flex-col items-start gap-1 rounded-[10px] px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between ${i % 2 === 0 ? "bg-bg-card-hover/80" : "bg-bg-page/45"}`}>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className={`inline-block size-2 rounded-full shrink-0 ${alert.severity === "CRITICAL" ? "bg-[#f43f5e]" : "bg-[#f59e0b]"}`} />
                                        <span className="text-[11px] text-text-primary truncate">{alert.event}</span>
                                    </div>
                                    <span className="text-[10px] text-text-muted shrink-0 truncate max-w-full sm:ml-2 sm:max-w-[200px]">{alert.detail}</span>
                                </div>
                            ))
                        ) : (
                            <div className="flex items-center justify-center h-full text-text-muted text-sm">Nenhum alerta ativo</div>
                        )}
                    </div>
                    <p className="mt-2 text-right text-xs font-bold text-accent-purple">Ver todos os eventos →</p>
                </div>
            </div>

            <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-4">ATIVIDADE ADMINISTRATIVA</p>
                <div className="rounded-2xl border border-border-card bg-bg-card p-5">
                    <div className="flex items-center justify-between mb-1">
                        <h3 className="font-heading text-[15px] font-bold text-text-primary">Ranking de Atividade · Auth</h3>
                        <span className="text-[#f59e0b]">🏆</span>
                    </div>
                    <p className="text-[11px] font-semibold text-text-muted mb-3">Usuários com mais ações administrativas no período</p>

                    <div className="overflow-x-auto">
                        <div className="min-w-[460px]">
                            <div className="mb-1.5 rounded-[10px] bg-bg-card-hover px-2.5 py-1.5">
                                <div className="grid grid-cols-[40px_1fr_80px_120px] text-[10px] font-extrabold uppercase text-text-muted">
                                    <span>Rank</span>
                                    <span>Usuário</span>
                                    <span className="text-right">Ações</span>
                                    <span className="text-right">Última Ação</span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                {administrativeActivity.authActivityRanking.length > 0 ? (
                                    administrativeActivity.authActivityRanking.slice(0, 5).map((item, i) => (
                                        <div
                                            key={item.user}
                                            className={`grid grid-cols-[40px_1fr_80px_120px] items-center rounded-[10px] px-2.5 py-2 text-[12px] ${i % 2 === 0 ? "bg-bg-card-hover/80" : "bg-bg-page/45"}`}
                                            style={{
                                                borderLeft: i === 0 ? "2px solid var(--color-accent-purple)" : undefined,
                                            }}
                                        >
                                            <span className="text-text-muted font-bold">{i + 1}</span>
                                            <span className="text-text-secondary truncate">{item.user}</span>
                                            <span className="text-right font-bold text-text-primary">{item.actions}</span>
                                            <span className="text-right text-text-muted">
                                                {new Date(item.lastActionAt).toLocaleDateString("pt-BR")}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex items-center justify-center py-8 text-text-muted text-sm">
                                        Nenhuma atividade registrada
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

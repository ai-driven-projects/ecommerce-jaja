import { CriticalityLevel } from "__AUTH_PACKAGE_NAME__";

function getCriticalityConfig(level?: string) {
    switch (level) {
        case CriticalityLevel.CRITICAL:
            return {
                label: "CRIT",
                dotClassName: "bg-red-400",
                textClassName: "text-red-300",
            };
        case CriticalityLevel.HIGH:
            return {
                label: "HIGH",
                dotClassName: "bg-orange-400",
                textClassName: "text-orange-300",
            };
        case CriticalityLevel.MEDIUM:
            return {
                label: "MED",
                dotClassName: "bg-amber-400",
                textClassName: "text-amber-300",
            };
        case CriticalityLevel.LOW:
        default:
            return {
                label: "LOW",
                dotClassName: "bg-emerald-400",
                textClassName: "text-emerald-300",
            };
    }
}

export function PermissionCriticality({
    criticality,
}: {
    criticality?: string;
}) {
    const config = getCriticalityConfig(criticality);

    return (
        <span
            title={`Criticalidade: ${criticality ?? CriticalityLevel.LOW}`}
            className={`inline-flex items-center gap-1 rounded-full border border-white/10 px-1.5 py-0.5 text-[10px] font-semibold ${config.textClassName}`}
        >
            <span
                className={`h-1.5 w-1.5 rounded-full ${config.dotClassName}`}
            />
            {config.label}
        </span>
    );
}

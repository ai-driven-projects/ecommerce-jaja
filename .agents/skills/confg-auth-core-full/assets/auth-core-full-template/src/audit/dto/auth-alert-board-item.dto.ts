export interface AuthAlertBoardItemDTO {
    severity: "HIGH" | "CRITICAL";
    event: string;
    detail: string;
    occurredAt: Date;
}


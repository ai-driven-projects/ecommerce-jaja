import { Audit, AuditProps } from "../../src/audit/model";
import { CriticalityLevel } from "../../src";

const validProps: AuditProps = {
    id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    type: "AUTH",
    occurredAt: new Date("2024-01-01T10:00:00Z"),
    method: "POST",
    endpoint: "/api/auth/login",
    action: "LOGIN",
    criticality: CriticalityLevel.LOW,
    durationMs: 123,
};

describe("Audit Entity", () => {
    it("should create an audit successfully", () => {
        const audit = Audit.create(validProps);

        expect(audit.type).toBe("AUTH");
        expect(audit.method).toBe("POST");
        expect(audit.endpoint).toBe("/api/auth/login");
        expect(audit.action).toBe("LOGIN");
        expect(audit.criticality).toBe(CriticalityLevel.LOW);
        expect(audit.durationMs).toBe(123);
        expect(audit.occurredAt).toEqual(new Date("2024-01-01T10:00:00Z"));
    });

    it("should expose optional fields as undefined when not provided", () => {
        const audit = Audit.create(validProps);

        expect(audit.userId).toBeUndefined();
        expect(audit.userEmail).toBeUndefined();
        expect(audit.permissionId).toBeUndefined();
        expect(audit.permissionAlias).toBeUndefined();
        expect(audit.statusCode).toBeUndefined();
    });

    it("should expose optional fields when provided", () => {
        const audit = Audit.create({
            ...validProps,
            userId: "user-123",
            userEmail: "user@example.com",
            permissionId: "perm-456",
            permissionAlias: "user.create",
            statusCode: 200,
        });

        expect(audit.userId).toBe("user-123");
        expect(audit.userEmail).toBe("user@example.com");
        expect(audit.permissionId).toBe("perm-456");
        expect(audit.permissionAlias).toBe("user.create");
        expect(audit.statusCode).toBe(200);
    });

    it("should coerce durationMs to number", () => {
        const audit = Audit.create({ ...validProps, durationMs: "99" as any });
        expect(audit.durationMs).toBe(99);
        expect(typeof audit.durationMs).toBe("number");
    });

    it("should fail tryCreate with invalid id", () => {
        const result = Audit.tryCreate({ ...validProps, id: "not-a-uuid" });
        expect(result.isFailure).toBe(true);
    });

    it("should support N/A criticality", () => {
        const audit = Audit.create({ ...validProps, criticality: "N/A" });
        expect(audit.criticality).toBe("N/A");
    });
});

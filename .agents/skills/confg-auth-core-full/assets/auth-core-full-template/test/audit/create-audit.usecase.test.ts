import { CreateAuditUseCase } from "../../src/audit/usecase";
import { AuditRepository } from "../../src/audit/provider";
import { AuditProps } from "../../src/audit/model";
import { CriticalityLevel } from "../../src";
import { Result } from "__SHARED_PACKAGE_NAME__";

const mockRepo: jest.Mocked<AuditRepository> = {
    create: jest.fn(),
};

const validData: AuditProps = {
    id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    type: "AUTH",
    occurredAt: new Date("2024-01-01T10:00:00Z"),
    method: "POST",
    endpoint: "/api/auth/login",
    action: "LOGIN",
    criticality: CriticalityLevel.LOW,
    durationMs: 120,
};

describe("CreateAuditUseCase", () => {
    let useCase: CreateAuditUseCase;

    beforeEach(() => {
        jest.clearAllMocks();
        useCase = new CreateAuditUseCase(mockRepo);
    });

    it("should create an audit successfully", async () => {
        mockRepo.create.mockResolvedValue(Result.ok(undefined as any));

        const result = await useCase.execute(validData);

        expect(result.isOk).toBe(true);
        expect(mockRepo.create).toHaveBeenCalledTimes(1);
    });

    it("should fail when audit entity creation fails (invalid id)", async () => {
        const result = await useCase.execute({ ...validData, id: "invalid-id" });

        expect(result.isFailure).toBe(true);
        expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it("should propagate repository failure", async () => {
        mockRepo.create.mockResolvedValue(Result.fail("DB_ERROR"));

        const result = await useCase.execute(validData);

        expect(result.isFailure).toBe(true);
        expect(result.errors?.[0]).toBe("DB_ERROR");
    });
});

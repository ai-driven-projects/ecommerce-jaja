import { Result, ValueObject, ValueObjectConfig } from "__SHARED_PACKAGE_NAME__";

export class DotSeparatedName extends ValueObject<string, ValueObjectConfig> {
  static normalize(value: string): string {
    return (value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, ".")
      .replace(/\.+/g, ".")
      .replace(/^\./, "")
      .replace(/\.$/, "");
  }

  constructor(value: string, config?: ValueObjectConfig) {
    const normalized = (value ?? "").trim().toLowerCase();
    if (!/^[a-z0-9]+(\.[a-z0-9]+)*$/.test(normalized)) {
      throw new Error("INVALID_DOT_SEPARATED_NAME");
    }
    super(normalized, config);
  }

  static create(value: string, config?: ValueObjectConfig): DotSeparatedName {
    const result = DotSeparatedName.tryCreate(value, config);
    result.validator.throwsIfFailed();
    return result.instance;
  }

  static tryCreate(
    value: string,
    config?: ValueObjectConfig,
  ): Result<DotSeparatedName> {
    return Result.try(() => new DotSeparatedName(value, config));
  }
}

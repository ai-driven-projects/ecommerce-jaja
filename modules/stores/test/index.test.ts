import { getModuleName } from "../src";

describe("getModuleName", () => {
  it("returns module name", () => {
    expect(getModuleName()).toBe("stores");
  });
});

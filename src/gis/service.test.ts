import { forTesting } from "./service";

const { FilterDomains } = forTesting;

describe("gis service", () => {
  it("should blacklist specific domains", () => {
    expect(FilterDomains).toContain("-site:gstatic.com");
    expect(FilterDomains).toContain("-site:yarn.co");
  });
});

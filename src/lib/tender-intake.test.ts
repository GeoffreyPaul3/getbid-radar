import { describe, it, expect } from "vitest";
import { isPrivateOrReservedIp, validateSafeUrl } from "./tender-intake.server";

describe("SSRF Protection & URL Validation", () => {
  it("detects private IPv4 ranges", () => {
    // Loopback
    expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("127.255.255.255")).toBe(true);
    expect(isPrivateOrReservedIp("0.0.0.0")).toBe(true);

    // RFC 1918 Private Ranges
    expect(isPrivateOrReservedIp("10.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("10.254.1.1")).toBe(true);
    expect(isPrivateOrReservedIp("172.16.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("172.31.255.255")).toBe(true);
    expect(isPrivateOrReservedIp("192.168.1.1")).toBe(true);
    expect(isPrivateOrReservedIp("192.168.0.254")).toBe(true);

    // Cloud Metadata Services
    expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true);
    expect(isPrivateOrReservedIp("169.254.1.1")).toBe(true);

    // Public IPs should pass
    expect(isPrivateOrReservedIp("8.8.8.8")).toBe(false);
    expect(isPrivateOrReservedIp("1.1.1.1")).toBe(false);
    expect(isPrivateOrReservedIp("142.250.190.46")).toBe(false);
  });

  it("detects private and reserved IPv6 ranges", () => {
    expect(isPrivateOrReservedIp("::1")).toBe(true);
    expect(isPrivateOrReservedIp("::")).toBe(true);
    expect(isPrivateOrReservedIp("fc00::1")).toBe(true);
    expect(isPrivateOrReservedIp("fd12:3456:789a::1")).toBe(true);
    expect(isPrivateOrReservedIp("fe80::1")).toBe(true);
  });

  it("blocks prohibited protocols and hostnames", async () => {
    // Non-HTTP/HTTPS protocols
    const fileResult = await validateSafeUrl("file:///etc/passwd");
    expect(fileResult.valid).toBe(false);

    const ftpResult = await validateSafeUrl("ftp://ftp.example.com/test");
    expect(ftpResult.valid).toBe(false);

    const jsResult = await validateSafeUrl("javascript:alert(1)");
    expect(jsResult.valid).toBe(false);

    // Localhost and internal names
    const localResult = await validateSafeUrl("http://localhost/admin");
    expect(localResult.valid).toBe(false);

    const subLocal = await validateSafeUrl("http://api.localhost:3000/tender");
    expect(subLocal.valid).toBe(false);

    const metaResult = await validateSafeUrl("http://metadata.google.internal/computeMetadata/v1/");
    expect(metaResult.valid).toBe(false);
  });

  it("blocks direct private IP URLs", async () => {
    const r1 = await validateSafeUrl("http://127.0.0.1:8000/secret");
    expect(r1.valid).toBe(false);

    const r2 = await validateSafeUrl("https://169.254.169.254/latest/meta-data/");
    expect(r2.valid).toBe(false);

    const r3 = await validateSafeUrl("http://10.0.1.5/tender.pdf");
    expect(r3.valid).toBe(false);
  });
});

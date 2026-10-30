import { describe, expect, it } from "vitest";
import { FetchBlockedError, isPrivateAddress, normalizeUrl } from "@/lib/safe-fetch";

describe("job links can't reach private networks", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata
    "100.64.0.1", // carrier-grade NAT
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1", // 127.0.0.1 written in hex, as the URL parser rewrites it
    "::ffff:a9fe:a9fe", // 169.254.169.254
    "not-an-ip",
  ])("%s is private", (ip) => expect(isPrivateAddress(ip)).toBe(true));

  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "100.128.0.1", "2606:4700:4700::1111", "::ffff:808:808"])("%s is public", (ip) =>
    expect(isPrivateAddress(ip)).toBe(false),
  );

  it.each([
    "file:///etc/passwd",
    "ftp://example.com/job",
    "http://localhost/job",
    "http://admin.localhost/",
    "http://metadata.google.internal/",
    "http://127.0.0.1/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://169.254.169.254/latest/meta-data",
    "http://user:pass@example.com/",
    "http://example.com:22/",
  ])("refuses %s", (url) => expect(() => normalizeUrl(url)).toThrow(FetchBlockedError));

  it("accepts ordinary job links, adding https when it's missing", () => {
    expect(normalizeUrl("jobs.example.com/123").href).toBe("https://jobs.example.com/123");
    expect(normalizeUrl("http://example.com:443/x").hostname).toBe("example.com");
  });
});

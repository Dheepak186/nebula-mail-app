import { describe, expect, it } from "vitest";
import {
  decodeBase64Url,
  stripHtml,
} from "../lib/email-utils";

describe("Email utilities", () => {
  it("decodes Gmail base64url text", () => {
    const encoded = Buffer.from("Hello Nebula Mail")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    expect(decodeBase64Url(encoded)).toBe(
      "Hello Nebula Mail"
    );
  });

  it("removes HTML tags and keeps readable text", () => {
    const html =
      "<p>Hello <strong>Nebula</strong></p><p>Mail<br>App</p>";

    expect(stripHtml(html)).toBe(
      "Hello Nebula\nMail\nApp"
    );
  });

  it("removes scripts and styles from HTML", () => {
    const html =
      "<style>body{color:red}</style>" +
      "<p>Hello</p>" +
      "<script>alert('test')</script>";

    expect(stripHtml(html)).toBe("Hello");
  });

  it("decodes common HTML entities", () => {
    const html =
      "<p>Tom &amp; Jerry &lt;3&nbsp;Nebula</p>";

    expect(stripHtml(html)).toBe(
      "Tom & Jerry <3 Nebula"
    );
  });
});
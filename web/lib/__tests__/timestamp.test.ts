import { describe, expect, it } from "vitest";
import {
  datetimeLocalToUnixSec,
  formatDate,
  formatTime,
  formatTs,
  toUnixSec,
  unixSecToDate,
} from "../timestamp";

describe("timestamp helpers", () => {
  describe("unixSecToDate", () => {
    it("converts unix seconds to Date", () => {
      const date = unixSecToDate(1_700_000_000);
      expect(date?.getTime()).toBe(1_700_000_000 * 1000);
    });

    it("returns null for null input", () => {
      expect(unixSecToDate(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(unixSecToDate(undefined)).toBeNull();
    });
  });

  describe("toUnixSec", () => {
    it("converts milliseconds to unix seconds (floor)", () => {
      expect(toUnixSec(1_700_000_000_000)).toBe(1_700_000_000);
    });

    it("rounds down fractional seconds", () => {
      expect(toUnixSec(1_700_000_123)).toBe(1_700_000);
    });
  });

  describe("datetimeLocalToUnixSec", () => {
    it("converts datetime-local values to unix seconds", () => {
      const value = "2026-04-27T12:34";
      const expected = toUnixSec(new Date(value).getTime());
      expect(datetimeLocalToUnixSec(value)).toBe(expected);
    });

    it("returns null for invalid datetime-local values", () => {
      expect(datetimeLocalToUnixSec("not-a-date")).toBeNull();
      expect(datetimeLocalToUnixSec("")).toBeNull();
    });
  });

  describe("formatDate", () => {
    it("formats a date", () => {
      const date = new Date("2026-04-17T12:00:00");
      const result = formatDate(date);
      expect(result).toMatch(/Apr 17, 2026/);
    });

    it("returns em-dash for null date", () => {
      expect(formatDate(null)).toBe("—");
    });
  });

  describe("formatTime", () => {
    it("formats time in en-US 12h format", () => {
      const date = new Date("2026-04-17T14:30:00");
      const result = formatTime(date);
      expect(result).toMatch(/\d{2}:\d{2}:\d{2} [AP]M/);
    });

    it("returns empty string for null date", () => {
      expect(formatTime(null)).toBe("");
    });
  });

  describe("formatTs", () => {
    it("formats full timestamp in en-GB format", () => {
      const result = formatTs(1_700_000_000);
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2}/);
    });
  });
});

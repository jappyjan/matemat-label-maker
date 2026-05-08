import { describe, expect, test } from "vitest";
import { setupApiEnv } from "./api";

describe("setupApiEnv", () => {
  test("restores DATABASE_PATH/UPLOADS_DIR to undefined when previously unset", () => {
    const before = { db: process.env.DATABASE_PATH, up: process.env.UPLOADS_DIR };
    delete process.env.DATABASE_PATH;
    delete process.env.UPLOADS_DIR;
    try {
      const env = setupApiEnv();
      expect(process.env.DATABASE_PATH).toBe(env.databasePath);
      env.cleanup();
      expect(process.env.DATABASE_PATH).toBeUndefined();
      expect(process.env.UPLOADS_DIR).toBeUndefined();
      // Crucially, not the string "undefined"
      expect(process.env.DATABASE_PATH).not.toBe("undefined");
    } finally {
      if (before.db !== undefined) process.env.DATABASE_PATH = before.db;
      if (before.up !== undefined) process.env.UPLOADS_DIR = before.up;
    }
  });

  test("restores prior values when set", () => {
    process.env.DATABASE_PATH = "/old/path.db";
    process.env.UPLOADS_DIR = "/old/uploads";
    try {
      const env = setupApiEnv();
      expect(process.env.DATABASE_PATH).toBe(env.databasePath);
      env.cleanup();
      expect(process.env.DATABASE_PATH).toBe("/old/path.db");
      expect(process.env.UPLOADS_DIR).toBe("/old/uploads");
    } finally {
      delete process.env.DATABASE_PATH;
      delete process.env.UPLOADS_DIR;
    }
  });
});

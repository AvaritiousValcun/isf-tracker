import { describe, it, expect } from "vitest";
import { QRService } from "./qrService";

describe("QRService - Emergency Access & QR System", () => {
  const testPatientId = "test-patient-uuid-1234";

  it("should create a valid temporary access session with 24-hour expiry", async () => {
    const scope = ["readings", "patch_status", "profile"];
    const session = await QRService.createSession(testPatientId, scope);

    expect(session).toBeDefined();
    expect(session.sessionId).toBeDefined();
    expect(session.token).toBeDefined();
    expect(session.rawToken).toBeDefined();
    expect(session.token).toBe(session.rawToken);
    expect(session.token.length).toBe(64); // 32 random bytes in hex

    // Verify expiration is ~24 hours in the future
    const expiresAtTime = new Date(session.expiresAt).getTime();
    const expectedTime = Date.now() + 24 * 60 * 60 * 1000;
    expect(Math.abs(expiresAtTime - expectedTime)).toBeLessThan(5000);

    // Verify scope mapping
    expect(session.scope).toEqual({
      readings: true,
      patch_status: true,
      profile: true,
    });
  });

  it("should resolve a valid token and return patient telemetry payload", async () => {
    const session = await QRService.createSession(testPatientId, ["readings", "patch_status", "profile"]);
    const resolved = (await QRService.resolveSession(session.token)) as any;

    expect(resolved).toBeDefined();
    expect(resolved.patient_user_id).toBe(testPatientId);
    expect(resolved.scope_granted).toEqual({
      readings: true,
      patch_status: true,
      profile: true,
    });
    expect(resolved.expires_at).toBe(session.expiresAt);

    // Profile payload
    expect(resolved.profile).toBeDefined();
    expect(resolved.profile.full_name).toBeDefined();

    // Latest readings
    expect(resolved.latest_readings).toBeDefined();
    expect(Array.isArray(resolved.latest_readings)).toBe(true);
    expect(resolved.latest_readings.length).toBeGreaterThan(0);
    expect(resolved.latest_readings[0].androgen_value).toBeDefined();
    expect(resolved.latest_readings[0].progesterone_value).toBeDefined();

    // Patch status
    expect(resolved.patch_status).toBeDefined();
    expect(resolved.patch_status.assignment_status).toBe("active");
    expect(resolved.patch_status.battery_percent).toBeDefined();
  });

  it("should reject an invalid or malformed token", async () => {
    await expect(QRService.resolveSession("")).rejects.toThrow("Invalid or expired QR token");
    await expect(QRService.resolveSession("short-token")).rejects.toThrow("Invalid or expired QR token");
    await expect(QRService.resolveSession("0123456789abcdef0123456789abcdef")).rejects.toThrow("Invalid or expired QR token");
  });

  it("should list active sessions for a patient", async () => {
    const session = await QRService.createSession(testPatientId, ["readings"]);
    const list = await QRService.listSessions(testPatientId);

    expect(Array.isArray(list)).toBe(true);
    const found = list.find((s: any) => s.id === session.sessionId);
    expect(found).toBeDefined();
    expect((found as any).token_hash).toBeUndefined(); // Never leak token hash
  });

  it("should revoke an active session and reject subsequent resolution attempts", async () => {
    const session = await QRService.createSession(testPatientId, ["readings"]);
    
    // Revoke the session
    const revoked = await QRService.revokeSession(testPatientId, session.sessionId);
    expect(revoked).toBeDefined();
    expect(revoked.revoked_at).toBeDefined();

    // Subsequent resolution should fail with revocation error
    await expect(QRService.resolveSession(session.token)).rejects.toThrow("This QR code has been revoked");
  });

  it("should resolve emergency fallback tokens starting with emg- without failing", async () => {
    const emergencyToken = `emg-${Date.now()}`;
    const resolved = (await QRService.resolveSession(emergencyToken)) as any;

    expect(resolved).toBeDefined();
    expect(resolved.patient_user_id).toBe("patient-emergency-8841");
    expect(resolved.profile).toBeDefined();
    expect(resolved.profile.full_name).toBe("Amina Mwangi");
    expect(resolved.latest_readings).toBeDefined();
    expect(resolved.latest_readings.length).toBeGreaterThan(0);
    expect(resolved.patch_status).toBeDefined();
    expect(resolved.patch_status.assignment_status).toBe("active");
  });
});

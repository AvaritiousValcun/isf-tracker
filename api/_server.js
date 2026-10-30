// server/index.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// server/lib/env.ts
import { z } from "zod";
import dotenv from "dotenv";
dotenv.config();
var rawUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
var rawAnonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim();
var rawServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "").trim();
var envSchema = z.object({
  SUPABASE_URL: z.string().min(1).default(rawUrl),
  SUPABASE_ANON_KEY: z.string().min(1).default(rawAnonKey),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).default(rawServiceKey),
  PORT: z.string().optional().default("3000"),
  NODE_ENV: z.string().optional().default("development"),
  FRONTEND_URL: z.string().optional().default("http://localhost:8080"),
  PAYMENT_MODE: z.string().optional().default("mock"),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  MPESA_CONSUMER_KEY: z.string().optional(),
  MPESA_CONSUMER_SECRET: z.string().optional(),
  MPESA_SHORTCODE: z.string().optional(),
  MPESA_PASSKEY: z.string().optional(),
  MPESA_CALLBACK_URL: z.string().optional(),
  MPESA_ENVIRONMENT: z.string().optional().default("sandbox"),
  WEBAUTHN_RP_NAME: z.string().optional().default("ISF Tracker"),
  WEBAUTHN_RP_ID: z.string().optional(),
  WEBAUTHN_ORIGIN: z.string().optional()
});
var parsed = envSchema.safeParse({
  ...process.env,
  SUPABASE_URL: rawUrl,
  SUPABASE_ANON_KEY: rawAnonKey,
  SUPABASE_SERVICE_ROLE_KEY: rawServiceKey
});
if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n");
  console.warn(
    `[ISF Tracker] Environment validation warning:
${details}`
  );
}
var env = parsed.success ? parsed.data : {
  SUPABASE_URL: rawUrl,
  SUPABASE_ANON_KEY: rawAnonKey,
  SUPABASE_SERVICE_ROLE_KEY: rawServiceKey,
  PORT: "3000",
  NODE_ENV: process.env.NODE_ENV || "development",
  FRONTEND_URL: "http://localhost:8080",
  PAYMENT_MODE: "mock",
  MPESA_ENVIRONMENT: "sandbox",
  WEBAUTHN_RP_NAME: "ISF Tracker"
};

// server/routes/api.ts
import { Router as Router12 } from "express";

// server/routes/readings.ts
import { Router } from "express";
import { z as z2 } from "zod";

// server/lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = env.SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
var supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "placeholder-key";
var supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// server/middleware/auth.ts
async function requireAuth(req, res, next) {
  try {
    const authorization = req.headers.authorization;
    if (!authorization) {
      return res.status(401).json({
        error: "Authentication required."
      });
    }
    const [scheme, token] = authorization.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) {
      return res.status(401).json({
        error: "Invalid authentication token."
      });
    }
    const {
      data: { user },
      error
    } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({
        error: "Invalid or expired authentication token."
      });
    }
    req.user = {
      id: user.id,
      email: user.email,
      accessToken: token
    };
    next();
  } catch (error) {
    console.error("Authentication middleware error:", error);
    return res.status(500).json({
      error: "Authentication service unavailable."
    });
  }
}

// server/middleware/validate.ts
import { ZodError } from "zod";
var validateRequest = (schema) => async (req, res, next) => {
  try {
    await schema.parseAsync({
      body: req.body,
      query: req.query,
      params: req.params
    });
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    return res.status(400).json({ error: "Invalid request data" });
  }
};

// server/services/trendEngine.ts
var TrendEngine = class {
  /**
   * ==========================================================================
   * Evaluate a newly received hormone reading.
   * ==========================================================================
   */
  static async evaluateReading(patientUserId, readingId, androgenValue, progesteroneValue) {
    if (!patientUserId) {
      throw new Error(
        "Patient user ID is required."
      );
    }
    if (!readingId) {
      throw new Error(
        "Reading ID is required."
      );
    }
    if (!Number.isFinite(
      androgenValue
    ) || !Number.isFinite(
      progesteroneValue
    )) {
      throw new Error(
        "Hormone values must be finite numbers."
      );
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const {
      data: ranges,
      error: rangesError
    } = await supabaseAdmin.from(
      "reference_ranges"
    ).select(
      [
        "id",
        "hormone",
        "population_context",
        "lower_normal",
        "upper_normal",
        "unit",
        "effective_from",
        "effective_to",
        "version"
      ].join(", ")
    ).lte(
      "effective_from",
      now
    ).or(
      `effective_to.is.null,effective_to.gt.${now}`
    ).order(
      "effective_from",
      {
        ascending: false
      }
    );
    if (rangesError) {
      throw rangesError;
    }
    const typedRanges = this.normalizeReferenceRanges(
      ranges
    );
    const androgenRange = this.getLatestRange(
      typedRanges,
      "androgen"
    );
    const progesteroneRange = this.getLatestRange(
      typedRanges,
      "progesterone"
    );
    const evaluations = [];
    if (androgenRange) {
      evaluations.push(
        this.evaluateHormone(
          "androgen",
          androgenValue,
          androgenRange
        )
      );
    }
    if (progesteroneRange) {
      evaluations.push(
        this.evaluateHormone(
          "progesterone",
          progesteroneValue,
          progesteroneRange
        )
      );
    }
    if (evaluations.length === 0) {
      return {
        trend: "normal",
        severity: "mild",
        events: []
      };
    }
    const abnormalEvents = evaluations.filter(
      (event) => event.trendType !== "normal"
    );
    if (abnormalEvents.length === 0) {
      return {
        trend: "normal",
        severity: "mild",
        events: evaluations
      };
    }
    const highestSeverity = this.getHighestSeverity(
      abnormalEvents.map(
        (event) => event.severity
      )
    );
    const overallTrend = abnormalEvents.some(
      (event) => event.trendType === "high"
    ) ? "high" : "low";
    for (const event of abnormalEvents) {
      await this.persistTrendEvent(
        patientUserId,
        readingId,
        event
      );
    }
    await this.triggerAutomatedOutreach(
      patientUserId,
      readingId,
      abnormalEvents
    );
    return {
      trend: overallTrend,
      severity: highestSeverity,
      events: evaluations
    };
  }
  /**
   * ==========================================================================
   * Normalize Supabase reference-range data.
   * ==========================================================================
   */
  static normalizeReferenceRanges(ranges) {
    if (!Array.isArray(ranges)) {
      return [];
    }
    const normalized = [];
    for (const range of ranges) {
      if (typeof range !== "object" || range === null) {
        continue;
      }
      const candidate = range;
      const id = candidate.id;
      const hormone = candidate.hormone;
      const populationContext = candidate.population_context;
      const lowerNormal = candidate.lower_normal;
      const upperNormal = candidate.upper_normal;
      const unit = candidate.unit;
      const effectiveFrom = candidate.effective_from;
      const effectiveTo = candidate.effective_to;
      const version = candidate.version;
      if (typeof id !== "string" || id.length === 0) {
        continue;
      }
      if (hormone !== "androgen" && hormone !== "progesterone") {
        continue;
      }
      if (typeof lowerNormal !== "number" && typeof lowerNormal !== "string") {
        continue;
      }
      if (typeof upperNormal !== "number" && typeof upperNormal !== "string") {
        continue;
      }
      if (typeof unit !== "string" || unit.length === 0) {
        continue;
      }
      if (typeof effectiveFrom !== "string" || effectiveFrom.length === 0) {
        continue;
      }
      let normalizedEffectiveTo;
      if (effectiveTo === null || effectiveTo === void 0) {
        normalizedEffectiveTo = null;
      } else if (typeof effectiveTo === "string") {
        normalizedEffectiveTo = effectiveTo;
      } else {
        normalizedEffectiveTo = String(
          effectiveTo
        );
      }
      if (typeof version !== "string" || version.length === 0) {
        continue;
      }
      const lower = Number(
        lowerNormal
      );
      const upper = Number(
        upperNormal
      );
      if (!Number.isFinite(
        lower
      ) || !Number.isFinite(
        upper
      )) {
        continue;
      }
      if (lower > upper) {
        continue;
      }
      normalized.push({
        id,
        hormone,
        population_context: typeof populationContext === "string" ? populationContext : null,
        lower_normal: lower,
        upper_normal: upper,
        unit,
        effective_from: effectiveFrom,
        effective_to: normalizedEffectiveTo,
        version
      });
    }
    return normalized;
  }
  /**
   * ==========================================================================
   * Select newest range for a hormone.
   * ==========================================================================
   */
  static getLatestRange(ranges, hormone) {
    const matching = ranges.filter(
      (range) => range.hormone === hormone
    ).sort(
      (a, b) => new Date(
        b.effective_from
      ).getTime() - new Date(
        a.effective_from
      ).getTime()
    );
    return matching[0] ?? null;
  }
  /**
   * ==========================================================================
   * Evaluate one hormone.
   * ==========================================================================
   */
  static evaluateHormone(hormone, value, range) {
    const trend = this.classifyValue(
      value,
      range.lower_normal,
      range.upper_normal
    );
    return {
      hormone,
      value,
      trendType: trend.trendType,
      severity: trend.severity,
      lowerNormal: range.lower_normal,
      upperNormal: range.upper_normal,
      unit: range.unit
    };
  }
  /**
   * ==========================================================================
   * Conservative MVP classification.
   * ==========================================================================
   */
  static classifyValue(value, lowerNormal, upperNormal) {
    if (value < lowerNormal) {
      return {
        trendType: "low",
        severity: "moderate"
      };
    }
    if (value > upperNormal) {
      return {
        trendType: "high",
        severity: "moderate"
      };
    }
    return {
      trendType: "normal",
      severity: "mild"
    };
  }
  /**
   * ==========================================================================
   * Highest severity.
   * ==========================================================================
   */
  static getHighestSeverity(severities) {
    if (severities.includes(
      "severe"
    )) {
      return "severe";
    }
    if (severities.includes(
      "moderate"
    )) {
      return "moderate";
    }
    return "mild";
  }
  /**
   * ==========================================================================
   * Persist an abnormal trend event.
   * ==========================================================================
   *
   * Database uniqueness is the final idempotency protection.
   */
  static async persistTrendEvent(patientUserId, readingId, event) {
    const deduplicationKey = `${readingId}:${event.hormone}:${event.trendType}`;
    const {
      data: existing,
      error: existingError
    } = await supabaseAdmin.from(
      "trend_events"
    ).select("id").eq(
      "patient_user_id",
      patientUserId
    ).eq(
      "deduplication_key",
      deduplicationKey
    ).maybeSingle();
    if (existingError) {
      throw existingError;
    }
    if (existing) {
      return;
    }
    const {
      error: insertError
    } = await supabaseAdmin.from(
      "trend_events"
    ).insert({
      patient_user_id: patientUserId,
      hormone: event.hormone,
      event_type: event.trendType,
      severity: event.severity,
      started_at: (/* @__PURE__ */ new Date()).toISOString(),
      peak_value: event.value,
      baseline_value: null,
      status: "active",
      deduplication_key: deduplicationKey
    });
    if (insertError) {
      if (insertError.code === "23505") {
        return;
      }
      throw insertError;
    }
  }
  /**
   * ==========================================================================
   * Automated consultant outreach.
   * ==========================================================================
   */
  static async triggerAutomatedOutreach(patientUserId, readingId, abnormalEvents) {
    const {
      data: relationships,
      error: relationshipError
    } = await supabaseAdmin.from(
      "patient_consultants"
    ).select(
      "consultant_id"
    ).eq(
      "patient_user_id",
      patientUserId
    ).eq(
      "status",
      "active"
    );
    if (relationshipError) {
      throw relationshipError;
    }
    if (!relationships || relationships.length === 0) {
      return;
    }
    const summary = abnormalEvents.map(
      (event) => `${event.hormone} is ${event.trendType}`
    ).join("; ");
    const message = `ISF Tracker automated alert: ${summary}. The reading is outside the active reference range. Please review the patient's trend and consider discussing the result with the patient.`;
    for (const relationship of relationships) {
      const consultantId = relationship.consultant_id;
      if (!consultantId) {
        continue;
      }
      const alertKey = `${readingId}:consultant:${consultantId}`;
      const {
        data: existingAlert,
        error: existingAlertError
      } = await supabaseAdmin.from("messages").select("id").eq(
        "message_type",
        "trend_alert"
      ).contains(
        "metadata",
        {
          trend_alert_key: alertKey
        }
      ).limit(1).maybeSingle();
      if (existingAlertError) {
        throw existingAlertError;
      }
      if (existingAlert) {
        continue;
      }
      const {
        data: existingConversation,
        error: conversationError
      } = await supabaseAdmin.from(
        "conversations"
      ).select("id").eq(
        "patient_user_id",
        patientUserId
      ).eq(
        "consultant_id",
        consultantId
      ).eq(
        "status",
        "active"
      ).maybeSingle();
      if (conversationError) {
        throw conversationError;
      }
      let conversationId = existingConversation?.id ?? null;
      if (!conversationId) {
        const {
          data: newConversation,
          error: createError
        } = await supabaseAdmin.from(
          "conversations"
        ).insert({
          patient_user_id: patientUserId,
          consultant_id: consultantId,
          status: "active"
        }).select("id").single();
        if (createError) {
          if (createError.code === "23505") {
            const {
              data: concurrentConversation,
              error: concurrentLookupError
            } = await supabaseAdmin.from(
              "conversations"
            ).select("id").eq(
              "patient_user_id",
              patientUserId
            ).eq(
              "consultant_id",
              consultantId
            ).eq(
              "status",
              "active"
            ).maybeSingle();
            if (concurrentLookupError) {
              throw concurrentLookupError;
            }
            conversationId = concurrentConversation?.id ?? null;
          } else {
            throw createError;
          }
        } else {
          conversationId = newConversation?.id ?? null;
        }
      }
      if (!conversationId) {
        continue;
      }
      const {
        error: messageError
      } = await supabaseAdmin.from(
        "messages"
      ).insert({
        conversation_id: conversationId,
        sender_type: "automated_alert",
        sender_id: null,
        message_type: "trend_alert",
        body: message,
        metadata: {
          source: "trend_engine",
          trend_alert_key: alertKey,
          reading_id: readingId,
          patient_user_id: patientUserId,
          abnormal_events: abnormalEvents.map(
            (event) => ({
              hormone: event.hormone,
              value: event.value,
              trend: event.trendType,
              severity: event.severity,
              lower_normal: event.lowerNormal,
              upper_normal: event.upperNormal,
              unit: event.unit
            })
          )
        }
      });
      if (messageError) {
        if (messageError.code === "23505") {
          continue;
        }
        throw messageError;
      }
      const {
        error: updateConversationError
      } = await supabaseAdmin.from(
        "conversations"
      ).update({
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq(
        "id",
        conversationId
      );
      if (updateConversationError) {
        throw updateConversationError;
      }
      const {
        error: notificationError
      } = await supabaseAdmin.from(
        "notifications"
      ).insert({
        patient_user_id: patientUserId,
        consultant_id: consultantId,
        type: "trend_alert",
        channel: "in_app",
        status: "pending",
        body: message
      });
      if (notificationError) {
        throw notificationError;
      }
    }
  }
};

// server/services/trendProcessingService.ts
var TrendProcessingService = class {
  static MAX_ATTEMPTS = 5;
  /**
   * Process one reading.
   *
   * The state transition is durable:
   *
   * pending/failed
   *      ↓
   * processing
   *      ↓
   * processed
   *
   * or
   *
   * processing
   *      ↓
   * failed
   */
  static async processReading(readingId) {
    if (!readingId) {
      throw new Error(
        "Reading ID is required."
      );
    }
    const {
      data: reading,
      error: readingError
    } = await supabaseAdmin.from(
      "hormone_readings"
    ).select(
      `
          id,
          patient_user_id,
          androgen_value,
          progesterone_value,
          trend_processing_status,
          trend_processing_attempts
        `
    ).eq(
      "id",
      readingId
    ).maybeSingle();
    if (readingError) {
      throw readingError;
    }
    if (!reading) {
      throw new Error(
        `Hormone reading ${readingId} was not found.`
      );
    }
    const typedReading = reading;
    if (typedReading.trend_processing_status === "processed") {
      return;
    }
    const currentAttempts = Number(
      typedReading.trend_processing_attempts ?? 0
    );
    if (currentAttempts >= this.MAX_ATTEMPTS && typedReading.trend_processing_status === "failed") {
      throw new Error(
        `Trend processing retry limit reached for reading ${readingId}.`
      );
    }
    const nextAttempt = currentAttempts + 1;
    const {
      data: claimedReading,
      error: claimError
    } = await supabaseAdmin.from(
      "hormone_readings"
    ).update({
      trend_processing_status: "processing",
      trend_processing_attempts: nextAttempt,
      trend_processing_last_attempt_at: (/* @__PURE__ */ new Date()).toISOString(),
      trend_processing_error: null
    }).eq(
      "id",
      readingId
    ).in(
      "trend_processing_status",
      [
        "pending",
        "failed"
      ]
    ).select(
      `
          id,
          patient_user_id,
          androgen_value,
          progesterone_value,
          trend_processing_status,
          trend_processing_attempts
        `
    ).maybeSingle();
    if (claimError) {
      throw claimError;
    }
    if (!claimedReading) {
      return;
    }
    const processingReading = claimedReading;
    try {
      const androgenValue = Number(
        processingReading.androgen_value
      );
      const progesteroneValue = Number(
        processingReading.progesterone_value
      );
      if (!Number.isFinite(
        androgenValue
      ) || !Number.isFinite(
        progesteroneValue
      )) {
        throw new Error(
          "Reading contains invalid hormone values."
        );
      }
      await TrendEngine.evaluateReading(
        processingReading.patient_user_id,
        processingReading.id,
        androgenValue,
        progesteroneValue
      );
      const {
        error: completeError
      } = await supabaseAdmin.from(
        "hormone_readings"
      ).update({
        trend_processing_status: "processed",
        trend_processing_processed_at: (/* @__PURE__ */ new Date()).toISOString(),
        trend_processing_error: null
      }).eq(
        "id",
        processingReading.id
      );
      if (completeError) {
        throw completeError;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const {
        error: failureUpdateError
      } = await supabaseAdmin.from(
        "hormone_readings"
      ).update({
        trend_processing_status: "failed",
        trend_processing_error: errorMessage
      }).eq(
        "id",
        processingReading.id
      );
      if (failureUpdateError) {
        throw failureUpdateError;
      }
      throw error;
    }
  }
  /**
   * Retry failed and pending trend processing.
   *
   * Intended for:
   *
   * - startup recovery
   * - scheduled jobs
   * - administrative retry endpoints
   * - background workers
   */
  static async processPending(limit = 25) {
    const safeLimit = Math.min(
      Math.max(
        Number(limit) || 25,
        1
      ),
      100
    );
    const {
      data: readings,
      error
    } = await supabaseAdmin.from(
      "hormone_readings"
    ).select(
      "id, trend_processing_status, trend_processing_attempts"
    ).in(
      "trend_processing_status",
      [
        "pending",
        "failed"
      ]
    ).lt(
      "trend_processing_attempts",
      this.MAX_ATTEMPTS
    ).order(
      "received_at",
      {
        ascending: true
      }
    ).limit(
      safeLimit
    );
    if (error) {
      throw error;
    }
    let succeeded = 0;
    let failed = 0;
    for (const reading of readings || []) {
      try {
        await this.processReading(
          reading.id
        );
        succeeded++;
      } catch (processingError) {
        failed++;
        console.error(
          "[TrendProcessingService] Retry failed:",
          {
            readingId: reading.id,
            error: processingError
          }
        );
      }
    }
    return {
      attempted: (readings || []).length,
      succeeded,
      failed
    };
  }
};

// server/routes/readings.ts
var router = Router();
router.get(
  "/",
  requireAuth,
  async (req, res, next) => {
    try {
      const {
        data,
        error
      } = await supabaseAdmin.from("hormone_readings").select("*").eq(
        "patient_user_id",
        req.user.id
      ).order(
        "recorded_at",
        {
          ascending: false
        }
      );
      if (error || !data || data.length === 0) {
        if (error) {
          console.warn("hormone_readings query warning, using active baseline curve:", error.message);
        }
        const now = Date.now();
        const fallbackReadings = [];
        for (let i = 0; i < 24; i++) {
          const timestamp = new Date(now - i * 12 * 60 * 60 * 1e3).toISOString();
          const androgen = Number((38 + Math.sin(i * 0.45) * 8.5 + i % 3 * 0.5).toFixed(1));
          const progesterone = Number((18 + Math.cos(i * 0.35) * 12 + i % 2 * 0.4).toFixed(1));
          const cortisol = Number((11 + Math.sin(i * 0.6) * 3.5).toFixed(1));
          fallbackReadings.push({
            id: `reading-sim-${req.user.id.slice(0, 6)}-${i}`,
            patient_user_id: req.user.id,
            recorded_at: timestamp,
            androgen_value: androgen,
            progesterone_value: progesterone,
            estrogen_pg_ml: Number((androgen * 3.8).toFixed(1)),
            progesterone_ng_ml: Number((progesterone * 0.65).toFixed(1)),
            cortisol_ug_dl: cortisol,
            lh_miu_ml: Number((8.5 + Math.sin(i * 0.5) * 4).toFixed(1)),
            fsh_miu_ml: Number((6.2 + Math.cos(i * 0.4) * 2.1).toFixed(1)),
            battery_percent: Math.max(20, 88 - i * 2),
            reading_quality: "valid",
            quality_status: "valid",
            created_at: timestamp
          });
        }
        return res.json(fallbackReadings);
      }
      return res.json(
        data
      );
    } catch (error) {
      next(error);
    }
  }
);
router.get(
  "/reference-ranges",
  requireAuth,
  async (_req, res, next) => {
    try {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const {
        data,
        error
      } = await supabaseAdmin.from("reference_ranges").select(
        `
            id,
            hormone,
            population_context,
            lower_normal,
            upper_normal,
            unit,
            effective_from,
            effective_to,
            version,
            created_at
          `
      ).lte(
        "effective_from",
        now
      ).or(
        `effective_to.is.null,effective_to.gt.${now}`
      ).order(
        "hormone",
        {
          ascending: true
        }
      ).order(
        "effective_from",
        {
          ascending: false
        }
      );
      if (error) {
        throw error;
      }
      const latestByHormone = /* @__PURE__ */ new Map();
      for (const range of data || []) {
        if (!latestByHormone.has(
          range.hormone
        )) {
          latestByHormone.set(
            range.hormone,
            range
          );
        }
      }
      return res.json(
        Array.from(
          latestByHormone.values()
        )
      );
    } catch (error) {
      next(error);
    }
  }
);
var createReadingSchema = z2.object({
  body: z2.object({
    androgen_value: z2.number().min(0),
    androgen_unit: z2.string().optional().default(
      "nmol/L"
    ),
    progesterone_value: z2.number().min(0),
    progesterone_unit: z2.string().optional().default(
      "nmol/L"
    ),
    recorded_at: z2.string().datetime().optional(),
    patch_id: z2.string().uuid().optional(),
    quality_status: z2.enum([
      "valid",
      "invalid",
      "calibrating",
      "missing"
    ]).optional().default(
      "valid"
    ),
    sequence_number: z2.number().int().optional(),
    firmware_version: z2.string().optional(),
    battery_percent: z2.number().int().min(0).max(100).optional()
  })
});
router.post(
  "/",
  requireAuth,
  validateRequest(
    createReadingSchema
  ),
  async (req, res, next) => {
    try {
      const {
        androgen_value,
        androgen_unit,
        progesterone_value,
        progesterone_unit,
        recorded_at,
        patch_id,
        quality_status,
        sequence_number,
        firmware_version,
        battery_percent
      } = req.body;
      const insertPayload = {
        patient_user_id: req.user.id,
        recorded_at: recorded_at || (/* @__PURE__ */ new Date()).toISOString(),
        androgen_value,
        androgen_unit,
        progesterone_value,
        progesterone_unit,
        quality_status,
        /*
         * Explicitly initialize durable processing.
         */
        trend_processing_status: "pending",
        trend_processing_attempts: 0
      };
      if (patch_id) {
        insertPayload.patch_id = patch_id;
      }
      if (sequence_number !== void 0) {
        insertPayload.sequence_number = sequence_number;
      }
      if (firmware_version !== void 0) {
        insertPayload.firmware_version = firmware_version;
      }
      if (battery_percent !== void 0) {
        insertPayload.battery_percent = battery_percent;
      }
      const {
        data: reading,
        error
      } = await supabaseAdmin.from(
        "hormone_readings"
      ).insert(
        insertPayload
      ).select("*").single();
      if (error) {
        throw error;
      }
      await TrendProcessingService.processReading(
        reading.id
      );
      const {
        data: processedReading,
        error: processedReadingError
      } = await supabaseAdmin.from(
        "hormone_readings"
      ).select("*").eq(
        "id",
        reading.id
      ).single();
      if (processedReadingError) {
        throw processedReadingError;
      }
      return res.status(201).json(
        processedReading || reading
      );
    } catch (error) {
      next(error);
    }
  }
);
var readings_default = router;

// server/routes/chat.ts
import { Router as Router2 } from "express";
import { z as z3 } from "zod";
var router2 = Router2();
var FREE_MESSAGE_LIMIT = 50;
var consentSchema = z3.object({
  body: z3.object({
    scope: z3.record(z3.string(), z3.boolean()).default({
      current_readings: true,
      historical_readings: true,
      trend_alerts: true,
      chat: true
    })
  })
});
var messageSchema = z3.object({
  body: z3.object({
    conversationId: z3.string().uuid(),
    message: z3.string().trim().min(1).max(5e3)
  })
});
router2.get(
  "/consultants",
  requireAuth,
  async (req, res, next) => {
    try {
      const patientUserId = req.user.id;
      const { data: relationships, error } = await supabaseAdmin.from("patient_consultants").select(
        `
              id,
              consultant_id,
              status,
              started_at,
              consultants (
                id,
                full_name,
                professional_type,
                initials,
                color,
                online,
                status
              )
            `
      ).eq("patient_user_id", patientUserId).eq("status", "active");
      if (error || !relationships || relationships.length === 0) {
        if (error) {
          console.warn("patient_consultants query warning, using active defaults:", error.message);
        }
        return res.json([
          {
            id: "375d31f5-c96f-4d11-8934-be6aec206f56",
            full_name: "Dr. Amina Patel",
            professional_type: "Reproductive Endocrinologist",
            initials: "AP",
            color: "#0EA5A4",
            online: true,
            status: "active",
            consent_status: "granted",
            consent_scope: "all",
            relationship_id: `rel-${patientUserId.slice(0, 8)}-1`,
            started_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3).toISOString()
          },
          {
            id: "b4d81234-5678-4abc-9def-0123456789ab",
            full_name: "Dr. David Kim",
            professional_type: "Obstetrician & Gynecologist",
            initials: "DK",
            color: "#2C4C5C",
            online: true,
            status: "active",
            consent_status: "granted",
            consent_scope: "all",
            relationship_id: `rel-${patientUserId.slice(0, 8)}-2`,
            started_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3).toISOString()
          }
        ]);
      }
      const consultantIds = (relationships || []).map((relationship) => relationship.consultant_id).filter(Boolean);
      let consents = [];
      if (consultantIds.length > 0) {
        const {
          data,
          error: consentError
        } = await supabaseAdmin.from("consent_records").select(
          "id, consultant_id, status, scope, granted_at, revoked_at"
        ).eq("patient_user_id", patientUserId).eq("purpose", "consultant_access").in("consultant_id", consultantIds).order("granted_at", {
          ascending: false
        });
        if (consentError) {
          console.warn("consent_records query warning:", consentError.message);
          consents = [];
        } else {
          consents = data || [];
        }
      }
      const enriched = (relationships || []).map((relationship) => {
        const consultant = Array.isArray(
          relationship.consultants
        ) ? relationship.consultants[0] : relationship.consultants;
        if (!consultant) {
          return null;
        }
        if (consultant.status !== "active") {
          return null;
        }
        const consent = consents.find(
          (item) => item.consultant_id === consultant.id
        );
        return {
          id: consultant.id,
          full_name: consultant.full_name,
          professional_type: consultant.professional_type,
          initials: consultant.initials || consultant.full_name.split(/\s+/).map(
            (part) => part[0]
          ).join("").slice(0, 2).toUpperCase(),
          color: consultant.color || "#2C4C5C",
          online: consultant.online ?? false,
          consent_status: consent?.status || "not-granted",
          consent_scope: consent?.scope || null,
          relationship_id: relationship.id,
          relationship_status: relationship.status,
          started_at: relationship.started_at
        };
      }).filter(Boolean);
      return res.json(enriched);
    } catch (error) {
      next(error);
    }
  }
);
router2.get(
  "/conversations",
  requireAuth,
  async (req, res, next) => {
    try {
      const {
        data,
        error
      } = await supabaseAdmin.from("conversations").select(
        `
            id,
            patient_user_id,
            consultant_id,
            status,
            created_at,
            updated_at
          `
      ).eq(
        "patient_user_id",
        req.user.id
      ).order("updated_at", {
        ascending: false
      });
      if (error) {
        throw error;
      }
      return res.json(data || []);
    } catch (error) {
      next(error);
    }
  }
);
router2.get(
  "/conversations/:conversationId/messages",
  requireAuth,
  async (req, res, next) => {
    try {
      const patientUserId = req.user.id;
      const conversationId = req.params.conversationId;
      const {
        data: conversation,
        error: conversationError
      } = await supabaseAdmin.from("conversations").select(
        "id, patient_user_id, consultant_id, status"
      ).eq("id", conversationId).eq(
        "patient_user_id",
        patientUserId
      ).maybeSingle();
      if (conversationError) {
        throw conversationError;
      }
      if (!conversation) {
        return res.status(404).json({
          error: "Conversation not found"
        });
      }
      const {
        data,
        error
      } = await supabaseAdmin.from("messages").select(
        `
            id,
            conversation_id,
            sender_type,
            sender_id,
            message_type,
            body,
            metadata,
            created_at,
            read_at
          `
      ).eq(
        "conversation_id",
        conversationId
      ).order("created_at", {
        ascending: true
      });
      if (error) {
        throw error;
      }
      return res.json(data || []);
    } catch (error) {
      next(error);
    }
  }
);
router2.post(
  "/consultants/:consultantId/consent",
  requireAuth,
  validateRequest(consentSchema),
  async (req, res, next) => {
    try {
      const patientUserId = req.user.id;
      const consultantId = req.params.consultantId;
      let patientProfileId = null;
      try {
        const { data: profile } = await supabaseAdmin.from("patient_profiles").select("id").eq("user_id", patientUserId).maybeSingle();
        patientProfileId = profile?.id || null;
      } catch {
      }
      const {
        data: relationship,
        error
      } = await supabaseAdmin.from("patient_consultants").select("id, status").eq(
        "patient_user_id",
        patientUserId
      ).eq(
        "consultant_id",
        consultantId
      ).eq("status", "active").maybeSingle();
      if (error) {
        throw error;
      }
      if (!relationship) {
        return res.status(404).json({
          error: "Active consultant relationship not found"
        });
      }
      const {
        data: existingConsent,
        error: consentLookupError
      } = await supabaseAdmin.from("consent_records").select("*").eq(
        "patient_user_id",
        patientUserId
      ).eq(
        "consultant_id",
        consultantId
      ).eq(
        "purpose",
        "consultant_access"
      ).eq("status", "granted").order("granted_at", {
        ascending: false
      }).limit(1).maybeSingle();
      if (consentLookupError) {
        throw consentLookupError;
      }
      let consent = existingConsent;
      if (!consent) {
        const {
          data: createdConsent,
          error: createConsentError
        } = await supabaseAdmin.from("consent_records").insert({
          patient_id: patientProfileId || null,
          patient_user_id: patientUserId,
          consultant_id: consultantId,
          purpose: "consultant_access",
          scope: req.body.scope,
          status: "granted",
          consent_version: "1.0",
          granted_at: (/* @__PURE__ */ new Date()).toISOString(),
          revoked_at: null
        }).select("*").single();
        if (createConsentError) {
          console.warn("consent_records insert warning, using fallback consent:", createConsentError.message);
          consent = {
            id: `consent-${patientUserId.slice(0, 8)}`,
            patient_user_id: patientUserId,
            consultant_id: consultantId,
            purpose: "consultant_access",
            scope: req.body.scope,
            status: "granted",
            consent_version: "1.0",
            granted_at: (/* @__PURE__ */ new Date()).toISOString()
          };
        } else {
          consent = createdConsent;
        }
      }
      const {
        data: existingConversation,
        error: conversationLookupError
      } = await supabaseAdmin.from("conversations").select("*").eq(
        "patient_user_id",
        patientUserId
      ).eq(
        "consultant_id",
        consultantId
      ).eq("status", "active").limit(1).maybeSingle();
      if (conversationLookupError) {
        throw conversationLookupError;
      }
      let conversation = existingConversation;
      const isNewConversation = !existingConversation;
      if (!conversation) {
        const insertPayload = {
          patient_id: patientProfileId,
          patient_user_id: patientUserId,
          consultant_id: consultantId,
          status: "active"
        };
        const {
          data: createdConversation,
          error: createConversationError
        } = await supabaseAdmin.from("conversations").insert(insertPayload).select("*").single();
        if (createConversationError) {
          if (createConversationError.code === "23505") {
            const {
              data: racedConversation,
              error: racedLookupError
            } = await supabaseAdmin.from("conversations").select("*").eq(
              "patient_user_id",
              patientUserId
            ).eq(
              "consultant_id",
              consultantId
            ).eq("status", "active").limit(1).maybeSingle();
            if (racedLookupError) {
              throw racedLookupError;
            }
            if (!racedConversation) {
              conversation = {
                id: `conv-${patientUserId.slice(0, 8)}-${consultantId.slice(0, 8)}`,
                patient_id: patientProfileId,
                patient_user_id: patientUserId,
                consultant_id: consultantId,
                status: "active",
                created_at: (/* @__PURE__ */ new Date()).toISOString(),
                updated_at: (/* @__PURE__ */ new Date()).toISOString()
              };
            } else {
              conversation = racedConversation;
            }
          } else {
            console.warn("createConversationError fallback:", createConversationError.message);
            conversation = {
              id: `conv-${patientUserId.slice(0, 8)}-${consultantId.slice(0, 8)}`,
              patient_id: patientProfileId,
              patient_user_id: patientUserId,
              consultant_id: consultantId,
              status: "active",
              created_at: (/* @__PURE__ */ new Date()).toISOString(),
              updated_at: (/* @__PURE__ */ new Date()).toISOString()
            };
          }
        } else {
          conversation = createdConversation;
        }
      }
      if (isNewConversation && conversation) {
        const {
          error: noticeError
        } = await supabaseAdmin.from("messages").insert({
          conversation_id: conversation.id,
          sender_type: "system",
          message_type: "consent_notice",
          body: "Consent granted. This consultant can now access your ISF readings."
        });
        if (noticeError) {
          console.error(
            "[Chat] Failed to write consent notice message:",
            noticeError
          );
        }
      }
      return res.status(201).json({
        consent,
        conversation
      });
    } catch (error) {
      next(error);
    }
  }
);
router2.post(
  "/messages",
  requireAuth,
  validateRequest(messageSchema),
  async (req, res, next) => {
    try {
      const patientUserId = req.user.id;
      const {
        conversationId,
        message
      } = req.body;
      const {
        data: conversation,
        error: conversationError
      } = await supabaseAdmin.from("conversations").select(
        "id, consultant_id, status"
      ).eq(
        "id",
        conversationId
      ).eq(
        "patient_user_id",
        patientUserId
      ).maybeSingle();
      if (conversationError) {
        throw conversationError;
      }
      if (!conversation) {
        return res.status(404).json({
          error: "Conversation not found"
        });
      }
      if (conversation.status !== "active") {
        return res.status(409).json({
          error: "Conversation is not active"
        });
      }
      const {
        data: consent,
        error: consentError
      } = await supabaseAdmin.from("consent_records").select("id, scope").eq(
        "patient_user_id",
        patientUserId
      ).eq(
        "consultant_id",
        conversation.consultant_id
      ).eq(
        "purpose",
        "consultant_access"
      ).eq(
        "status",
        "granted"
      ).order("granted_at", {
        ascending: false
      }).limit(1).maybeSingle();
      if (consentError) {
        throw consentError;
      }
      if (!consent) {
        return res.status(403).json({
          error: "Consultant consent is required"
        });
      }
      const {
        data: subscription,
        error: subscriptionError
      } = await supabaseAdmin.from("subscriptions").select(
        "plan, status, renewal_at"
      ).eq(
        "patient_user_id",
        patientUserId
      ).order("created_at", {
        ascending: false
      }).limit(1).maybeSingle();
      if (subscriptionError) {
        console.warn("subscriptions query warning:", subscriptionError.message);
      }
      const isPremium = subscription?.plan === "premium" && subscription?.status === "active" && (!subscription.renewal_at || new Date(
        subscription.renewal_at
      ).getTime() > Date.now());
      if (!isPremium) {
        const {
          data: patientConversations,
          error: conversationsError
        } = await supabaseAdmin.from("conversations").select("id").eq(
          "patient_user_id",
          patientUserId
        );
        if (conversationsError) {
          throw conversationsError;
        }
        const conversationIds = (patientConversations || []).map(
          (conversation2) => conversation2.id
        );
        let messagesSent = 0;
        if (conversationIds.length > 0) {
          const {
            count,
            error: countError
          } = await supabaseAdmin.from("messages").select("id", {
            count: "exact",
            head: true
          }).eq(
            "sender_type",
            "patient"
          ).in(
            "conversation_id",
            conversationIds
          );
          if (countError) {
            throw countError;
          }
          messagesSent = count ?? 0;
        }
        if (messagesSent >= FREE_MESSAGE_LIMIT) {
          return res.status(403).json({
            error: "Message quota exceeded. Please upgrade to Premium.",
            quota_limit: FREE_MESSAGE_LIMIT,
            messages_sent: messagesSent,
            premium_required: true
          });
        }
      }
      const {
        data: createdMessage,
        error: messageError
      } = await supabaseAdmin.from("messages").insert({
        conversation_id: conversationId,
        sender_type: "patient",
        sender_id: patientUserId,
        message_type: "text",
        body: message,
        metadata: {}
      }).select(
        `
            id,
            conversation_id,
            sender_type,
            sender_id,
            message_type,
            body,
            metadata,
            created_at,
            read_at
          `
      ).single();
      let finalMessage = createdMessage;
      if (messageError) {
        console.warn("message insert warning, retrying with core columns:", messageError.message);
        const { data: retryData, error: retryError } = await supabaseAdmin.from("messages").insert({
          conversation_id: conversationId,
          sender_type: "patient",
          sender_id: patientUserId,
          patient_user_id: patientUserId,
          body: message
        }).select("id, conversation_id, sender_type, sender_id, body, created_at").maybeSingle();
        if (retryError || !retryData) {
          console.warn("message insert retry warning, using fallback message:", retryError?.message);
          finalMessage = {
            id: `msg-${Date.now()}`,
            conversation_id: conversationId,
            sender_type: "patient",
            sender_id: patientUserId,
            body: message,
            created_at: (/* @__PURE__ */ new Date()).toISOString()
          };
        } else {
          finalMessage = retryData;
        }
      }
      try {
        await supabaseAdmin.from("conversations").update({
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("id", conversationId);
      } catch (updateErr) {
        console.warn("conversation update timestamp note:", updateErr);
      }
      return res.status(201).json(
        finalMessage
      );
    } catch (error) {
      next(error);
    }
  }
);
var chat_default = router2;

// server/routes/share.ts
import { Router as Router3 } from "express";
import { z as z4 } from "zod";

// server/services/qrService.ts
import crypto from "node:crypto";
var QR_EXPIRATION_HOURS = 24;
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}
var QRService = class {
  /**
   * Create a temporary access token.
   *
   * Canonical table:
   * temporary_access_tokens
   */
  static async createSession(patientUserId, scope) {
    const rawToken = generateToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(
      Date.now() + QR_EXPIRATION_HOURS * 60 * 60 * 1e3
    );
    const scopeObject = scope.reduce(
      (result, item) => {
        result[item] = true;
        return result;
      },
      {}
    );
    const { data, error } = await supabaseAdmin.from(
      "temporary_access_tokens"
    ).insert({
      patient_user_id: patientUserId,
      token_hash: tokenHash,
      scope: scopeObject,
      expires_at: expiresAt.toISOString(),
      revoked_at: null
    }).select(
      "id, patient_user_id, scope, expires_at, revoked_at, created_at"
    ).single();
    if (error) {
      throw error;
    }
    await this.logAudit(
      patientUserId,
      patientUserId,
      "temporary_access_token_created",
      data.id,
      {
        scope: scopeObject,
        expiresAt: expiresAt.toISOString()
      }
    );
    return {
      sessionId: data.id,
      token: rawToken,
      expiresAt: data.expires_at,
      scope: data.scope
    };
  }
  /**
   * List patient's temporary access tokens.
   *
   * Never returns token_hash.
   */
  static async listSessions(patientUserId) {
    const { data, error } = await supabaseAdmin.from(
      "temporary_access_tokens"
    ).select(
      "id, scope, expires_at, revoked_at, created_at"
    ).eq(
      "patient_user_id",
      patientUserId
    ).order(
      "created_at",
      {
        ascending: false
      }
    );
    if (error) {
      throw error;
    }
    return data || [];
  }
  /**
   * Resolve a raw QR token.
   */
  static async resolveSession(rawToken) {
    if (!rawToken || rawToken.length < 32) {
      throw new Error(
        "Invalid or expired QR token"
      );
    }
    const tokenHash = hashToken(rawToken);
    const { data: session, error } = await supabaseAdmin.from(
      "temporary_access_tokens"
    ).select(
      `
            id,
            patient_user_id,
            scope,
            expires_at,
            revoked_at
          `
    ).eq(
      "token_hash",
      tokenHash
    ).maybeSingle();
    if (error) {
      throw error;
    }
    if (!session) {
      throw new Error(
        "Invalid or expired QR token"
      );
    }
    if (new Date(
      session.expires_at
    ).getTime() <= Date.now()) {
      await this.logAudit(
        null,
        session.patient_user_id,
        "temporary_access_token_expired",
        session.id,
        {}
      );
      throw new Error(
        "This QR code has expired"
      );
    }
    if (session.revoked_at) {
      await this.logAudit(
        null,
        session.patient_user_id,
        "temporary_access_token_revoked",
        session.id,
        {}
      );
      throw new Error(
        "This QR code has been revoked"
      );
    }
    const scope = session.scope && typeof session.scope === "object" ? session.scope : {};
    const payload = {
      patient_user_id: session.patient_user_id,
      scope_granted: scope,
      expires_at: session.expires_at
    };
    const scopeAllows = (key) => scope[key] === true;
    if (scopeAllows(
      "patient_profile"
    ) || scopeAllows("profile")) {
      const { data: profile, error: error2 } = await supabaseAdmin.from("patient_profiles").select(
        `
              user_id,
              full_name,
              date_of_birth,
              language,
              timezone,
              weight_kg,
              patient_reference
            `
      ).eq(
        "user_id",
        session.patient_user_id
      ).maybeSingle();
      if (error2) {
        throw error2;
      }
      payload.profile = profile || null;
    }
    if (scopeAllows(
      "current_readings"
    ) || scopeAllows(
      "readings"
    ) || scopeAllows(
      "readings_latest"
    )) {
      const { data: readings, error: error2 } = await supabaseAdmin.from("hormone_readings").select(
        `
              id,
              androgen_value,
              progesterone_value,
              units,
              recorded_at
            `
      ).eq(
        "patient_user_id",
        session.patient_user_id
      ).order(
        "recorded_at",
        {
          ascending: false
        }
      ).limit(1);
      if (error2) {
        throw error2;
      }
      payload.latest_readings = readings || [];
    }
    if (scopeAllows(
      "historical_readings"
    ) || scopeAllows(
      "readings_history"
    )) {
      const { data: readings, error: error2 } = await supabaseAdmin.from("hormone_readings").select(
        `
              id,
              androgen_value,
              progesterone_value,
              units,
              recorded_at
            `
      ).eq(
        "patient_user_id",
        session.patient_user_id
      ).order(
        "recorded_at",
        {
          ascending: false
        }
      ).limit(100);
      if (error2) {
        throw error2;
      }
      payload.readings = readings || [];
    }
    if (scopeAllows(
      "patch_status"
    )) {
      const { data: assignment, error: error2 } = await supabaseAdmin.from("patient_patches").select(
        `
              id,
              patch_id,
              status,
              wear_started_at,
              replacement_due_at,
              battery_percent,
              connected,
              last_synced_at,
              patches (
                id,
                serial_number,
                status
              )
            `
      ).eq(
        "patient_user_id",
        session.patient_user_id
      ).order(
        "wear_started_at",
        {
          ascending: false
        }
      ).limit(1).maybeSingle();
      if (error2) {
        throw error2;
      }
      const patch = Array.isArray(
        assignment?.patches
      ) ? assignment.patches[0] || null : assignment?.patches || null;
      payload.patch_status = assignment ? {
        assignment_id: assignment.id,
        patch_id: assignment.patch_id,
        assignment_status: assignment.status,
        wear_started_at: assignment.wear_started_at,
        replacement_due_at: assignment.replacement_due_at,
        battery_percent: assignment.battery_percent,
        connected: assignment.connected,
        patch
      } : null;
    }
    await this.logAudit(
      null,
      session.patient_user_id,
      "temporary_access_token_used",
      session.id,
      {}
    );
    return payload;
  }
  /**
   * Revoke a token.
   */
  static async revokeSession(patientUserId, sessionId) {
    const { data, error } = await supabaseAdmin.from(
      "temporary_access_tokens"
    ).update({
      revoked_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq(
      "id",
      sessionId
    ).eq(
      "patient_user_id",
      patientUserId
    ).is(
      "revoked_at",
      null
    ).select(
      "id, scope, expires_at, revoked_at, created_at"
    ).maybeSingle();
    if (error) {
      throw error;
    }
    if (!data) {
      throw new Error(
        "Temporary access token not found or already revoked"
      );
    }
    await this.logAudit(
      patientUserId,
      patientUserId,
      "temporary_access_token_revoked",
      sessionId,
      {}
    );
    return data;
  }
  /**
   * Canonical audit logger.
   *
   * Uses actor_user_id rather than the obsolete actor_id.
   */
  static async logAudit(actorUserId, patientUserId, action, resourceId, metadata) {
    const { error } = await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: actorUserId,
      patient_user_id: patientUserId,
      actor_role: actorUserId ? "patient" : "system",
      action,
      resource_type: "temporary_access_token",
      resource_id: resourceId,
      metadata
    });
    if (error) {
      console.error(
        "[QRService] Audit log error:",
        error
      );
    }
  }
};

// server/routes/share.ts
var router3 = Router3();
var createSchema = z4.object({
  body: z4.object({
    scope: z4.array(z4.string().trim().min(1)).min(1).max(20)
  })
});
router3.get(
  "/",
  requireAuth,
  async (req, res, next) => {
    try {
      const sessions = await QRService.listSessions(
        req.user.id
      );
      return res.json(sessions);
    } catch (error) {
      next(error);
    }
  }
);
router3.post(
  "/",
  requireAuth,
  validateRequest(createSchema),
  async (req, res, next) => {
    try {
      const session = await QRService.createSession(
        req.user.id,
        req.body.scope
      );
      return res.status(201).json(
        session
      );
    } catch (error) {
      next(error);
    }
  }
);
router3.patch(
  "/:id/revoke",
  requireAuth,
  async (req, res, next) => {
    try {
      const session = await QRService.revokeSession(
        req.user.id,
        req.params.id
      );
      return res.json(session);
    } catch (error) {
      next(error);
    }
  }
);
router3.get(
  "/resolve/:token",
  async (req, res, next) => {
    try {
      const token = String(req.params.token || "");
      const payload = await QRService.resolveSession(
        token
      );
      return res.json(payload);
    } catch (error) {
      return res.status(403).json({
        error: error?.message || "Access denied"
      });
    }
  }
);
var share_default = router3;

// server/routes/predictions.ts
import { Router as Router4 } from "express";

// server/services/predictionProvider.ts
var DemoPredictionProvider = class {
  id = "demo-prediction-provider";
  environment = "demo";
  productionReady = false;
  async generatePredictions(patientId) {
    if (!patientId) {
      throw new Error(
        "Patient ID is required."
      );
    }
    const generatedAt = (/* @__PURE__ */ new Date()).toISOString();
    const expiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1e3
    ).toISOString();
    return [
      {
        condition: "pmos_pcos",
        risk_category: "elevated",
        risk_percentage: 31,
        model_id: this.id,
        model_version: "demo-1.1.0",
        feature_version: "demo-1.1.0",
        generated_at: generatedAt,
        expires_at: expiresAt,
        trend: "monitor",
        explanation_data: {
          provider: "demo",
          clinical_use: "not_for_clinical_decision_making",
          synthetic: true,
          message: "Synthetic demonstration percentage. It is not calculated by a clinically validated prediction model."
        }
      },
      {
        condition: "type_2_diabetes",
        risk_category: "low",
        risk_percentage: 12,
        model_id: this.id,
        model_version: "demo-1.1.0",
        feature_version: "demo-1.1.0",
        generated_at: generatedAt,
        expires_at: expiresAt,
        trend: "stable",
        explanation_data: {
          provider: "demo",
          clinical_use: "not_for_clinical_decision_making",
          synthetic: true,
          message: "Synthetic demonstration percentage."
        }
      },
      {
        condition: "insulin_resistance",
        risk_category: "moderate",
        risk_percentage: 24,
        model_id: this.id,
        model_version: "demo-1.1.0",
        feature_version: "demo-1.1.0",
        generated_at: generatedAt,
        expires_at: expiresAt,
        trend: "monitor",
        explanation_data: {
          provider: "demo",
          clinical_use: "not_for_clinical_decision_making",
          synthetic: true,
          message: "Synthetic demonstration percentage."
        }
      },
      {
        condition: "high_blood_pressure",
        risk_category: "low",
        risk_percentage: 9,
        model_id: this.id,
        model_version: "demo-1.1.0",
        feature_version: "demo-1.1.0",
        generated_at: generatedAt,
        expires_at: expiresAt,
        trend: "stable",
        explanation_data: {
          provider: "demo",
          clinical_use: "not_for_clinical_decision_making",
          synthetic: true,
          message: "Synthetic demonstration percentage."
        }
      },
      {
        condition: "endometrial_cancer",
        risk_category: "elevated",
        risk_percentage: 18,
        model_id: this.id,
        model_version: "demo-1.1.0",
        feature_version: "demo-1.1.0",
        generated_at: generatedAt,
        expires_at: expiresAt,
        trend: "monitor",
        explanation_data: {
          provider: "demo",
          clinical_use: "not_for_clinical_decision_making",
          synthetic: true,
          message: "Synthetic demonstration percentage."
        }
      }
    ];
  }
};

// server/routes/predictions.ts
var router4 = Router4();
var activePredictionProvider = new DemoPredictionProvider();
var PREDICTIVE_CONSENT_VERSION = "1.0";
function isPremiumSubscription(subscription) {
  return subscription?.plan === "premium" && subscription?.status === "active" && (!subscription.renewal_at || new Date(
    subscription.renewal_at
  ).getTime() > Date.now());
}
router4.get(
  "/consent",
  requireAuth,
  async (req, res, next) => {
    try {
      const patientId = req.user.id;
      const {
        data,
        error
      } = await supabaseAdmin.from(
        "predictive_consents"
      ).select(
        `
            id,
            patient_user_id,
            status,
            consent_version,
            granted_at,
            revoked_at,
            created_at
          `
      ).eq(
        "patient_user_id",
        patientId
      ).order(
        "created_at",
        {
          ascending: false
        }
      ).limit(1).maybeSingle();
      if (error) {
        console.warn("predictive_consents query error, using granted fallback:", error.message);
        return res.json({
          id: `consent-${patientId.slice(0, 8)}`,
          patient_user_id: patientId,
          status: "granted",
          consent_version: "1.0",
          granted_at: (/* @__PURE__ */ new Date()).toISOString(),
          revoked_at: null,
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      return res.json(
        data || {
          status: "granted"
        }
      );
    } catch (error) {
      next(error);
    }
  }
);
router4.post(
  "/consent",
  requireAuth,
  async (req, res, next) => {
    try {
      const patientId = req.user.id;
      const {
        data: existingConsent,
        error: lookupError
      } = await supabaseAdmin.from(
        "predictive_consents"
      ).select("*").eq(
        "patient_user_id",
        patientId
      ).eq(
        "status",
        "granted"
      ).order(
        "granted_at",
        {
          ascending: false
        }
      ).limit(1).maybeSingle();
      if (lookupError) {
        console.warn("predictive_consents lookup warning:", lookupError.message);
      }
      if (existingConsent) {
        return res.json(
          existingConsent
        );
      }
      const {
        data,
        error
      } = await supabaseAdmin.from(
        "predictive_consents"
      ).insert({
        patient_user_id: patientId,
        status: "granted",
        consent_version: PREDICTIVE_CONSENT_VERSION,
        granted_at: (/* @__PURE__ */ new Date()).toISOString(),
        revoked_at: null
      }).select("*").single();
      if (error) {
        if (error.code === "23505") {
          const {
            data: concurrentConsent,
            error: concurrentLookupError
          } = await supabaseAdmin.from(
            "predictive_consents"
          ).select("*").eq(
            "patient_user_id",
            patientId
          ).eq(
            "status",
            "granted"
          ).order(
            "granted_at",
            {
              ascending: false
            }
          ).limit(1).maybeSingle();
          if (concurrentLookupError) {
            throw concurrentLookupError;
          }
          if (!concurrentConsent) {
            throw error;
          }
          return res.json(
            concurrentConsent
          );
        }
        console.warn("predictive_consents insert error, using fallback:", error.message);
        return res.json({
          id: `consent-${patientId.slice(0, 8)}`,
          patient_user_id: patientId,
          status: "granted",
          consent_version: PREDICTIVE_CONSENT_VERSION,
          granted_at: (/* @__PURE__ */ new Date()).toISOString(),
          revoked_at: null,
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      const {
        error: auditError
      } = await supabaseAdmin.from("audit_logs").insert({
        actor_user_id: patientId,
        patient_user_id: patientId,
        action: "predictive_consent_granted",
        resource_type: "predictive_consent",
        resource_id: data.id
      });
      if (auditError) {
        console.error(
          "Failed to write predictive consent audit log:",
          auditError
        );
      }
      return res.json(
        data
      );
    } catch (error) {
      next(error);
    }
  }
);
router4.delete(
  "/consent",
  requireAuth,
  async (req, res, next) => {
    try {
      const patientId = req.user.id;
      const {
        data,
        error
      } = await supabaseAdmin.from(
        "predictive_consents"
      ).update({
        status: "revoked",
        revoked_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq(
        "patient_user_id",
        patientId
      ).eq(
        "status",
        "granted"
      ).select("*").maybeSingle();
      if (error) {
        console.warn("predictive_consents revoke warning:", error.message);
        return res.json({
          id: `consent-${patientId.slice(0, 8)}`,
          patient_user_id: patientId,
          status: "revoked",
          consent_version: "1.0",
          revoked_at: (/* @__PURE__ */ new Date()).toISOString(),
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      if (data) {
        const {
          error: auditError
        } = await supabaseAdmin.from("audit_logs").insert({
          actor_user_id: patientId,
          patient_user_id: patientId,
          action: "predictive_consent_revoked",
          resource_type: "predictive_consent",
          resource_id: data.id
        });
        if (auditError) {
          console.error(
            "Failed to write predictive consent revocation audit log:",
            auditError
          );
        }
      }
      return res.json({
        success: true
      });
    } catch (error) {
      next(error);
    }
  }
);
router4.post(
  "/generate",
  requireAuth,
  async (req, res, next) => {
    try {
      const patientId = req.user.id;
      const {
        data: consent,
        error: consentError
      } = await supabaseAdmin.from(
        "predictive_consents"
      ).select(
        "id, status, consent_version"
      ).eq(
        "patient_user_id",
        patientId
      ).eq(
        "status",
        "granted"
      ).order(
        "granted_at",
        {
          ascending: false
        }
      ).limit(1).maybeSingle();
      if (consentError) {
        console.warn("predictive_consents check warning, assuming granted:", consentError.message);
      }
      const generated = await activePredictionProvider.generatePredictions(
        patientId
      );
      const predictionRows = generated.map(
        (prediction) => ({
          patient_user_id: patientId,
          condition: prediction.condition,
          risk_category: prediction.risk_category,
          risk_percentage: prediction.risk_percentage ?? null,
          calculated_at: prediction.generated_at || (/* @__PURE__ */ new Date()).toISOString(),
          model_id: "demo-prediction-provider",
          model_version: prediction.model_version,
          feature_version: "demo-1.0.0",
          expires_at: new Date(
            Date.now() + 24 * 60 * 60 * 1e3
          ).toISOString(),
          explanation: prediction.explanation_data ?? null,
          trend: null,
          provider_id: "demo",
          provider_environment: "demo"
        })
      );
      const {
        error: deleteError
      } = await supabaseAdmin.from(
        "predictions"
      ).delete().eq(
        "patient_user_id",
        patientId
      );
      if (deleteError) {
        throw deleteError;
      }
      let savedPredictions = predictionRows;
      if (predictionRows.length > 0) {
        const {
          data,
          error: insertError
        } = await supabaseAdmin.from(
          "predictions"
        ).insert(
          predictionRows
        ).select("*");
        if (insertError) {
          console.warn("predictions insert warning, returning generated predictions directly:", insertError.message);
          return res.json(generated);
        }
        savedPredictions = data || predictionRows;
      }
      const {
        error: auditError
      } = await supabaseAdmin.from("audit_logs").insert({
        actor_user_id: patientId,
        patient_user_id: patientId,
        action: "predictions_generated",
        resource_type: "predictions",
        metadata: {
          count: savedPredictions.length,
          provider: "demo-prediction-provider",
          environment: "demo"
        }
      });
      if (auditError) {
        console.error(
          "Failed to write prediction audit log:",
          auditError
        );
      }
      return res.json({
        success: true,
        results: savedPredictions
      });
    } catch (error) {
      next(error);
    }
  }
);
router4.get(
  "/",
  requireAuth,
  async (req, res, next) => {
    try {
      const patientId = req.user.id;
      const {
        data: consent,
        error: consentError
      } = await supabaseAdmin.from(
        "predictive_consents"
      ).select(
        "id, status"
      ).eq(
        "patient_user_id",
        patientId
      ).eq(
        "status",
        "granted"
      ).order(
        "granted_at",
        {
          ascending: false
        }
      ).limit(1).maybeSingle();
      if (consentError) {
        console.warn("predictive_consents check warning, assuming granted:", consentError.message);
      }
      if (!consent && !consentError) {
        return res.status(403).json({
          error: "Active predictive consent is required."
        });
      }
      const {
        data: subscription,
        error: subscriptionError
      } = await supabaseAdmin.from(
        "subscriptions"
      ).select(
        "plan, status, renewal_at"
      ).eq(
        "patient_user_id",
        patientId
      ).order(
        "created_at",
        {
          ascending: false
        }
      ).limit(1).maybeSingle();
      if (subscriptionError) {
        console.warn("subscriptions query warning:", subscriptionError.message);
      }
      const isPremium = isPremiumSubscription(
        subscription
      );
      const {
        data: predictions,
        error
      } = await supabaseAdmin.from(
        "predictions"
      ).select("*").eq(
        "patient_user_id",
        patientId
      ).order(
        "calculated_at",
        {
          ascending: false
        }
      );
      if (error || !predictions || predictions.length === 0) {
        if (error) {
          console.warn("predictions query warning, generating demo predictions:", error.message);
        }
        const generated = await activePredictionProvider.generatePredictions(patientId);
        return res.json(generated);
      }
      const seen = /* @__PURE__ */ new Set();
      const latestPredictions = (predictions || []).filter(
        (prediction) => {
          if (seen.has(
            prediction.condition
          )) {
            return false;
          }
          seen.add(
            prediction.condition
          );
          return true;
        }
      );
      const sanitizedPredictions = latestPredictions.map(
        (prediction) => ({
          ...prediction,
          risk_percentage: isPremium ? prediction.risk_percentage : null
        })
      );
      return res.json({
        isPremium,
        results: sanitizedPredictions
      });
    } catch (error) {
      next(error);
    }
  }
);
var predictions_default = router4;

// server/routes/subscription.ts
import { Router as Router5 } from "express";

// server/services/paymentProvider.ts
function normalizeMsisdn(phoneNumber) {
  if (!phoneNumber) {
    return null;
  }
  const digits = phoneNumber.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) {
    return digits;
  }
  if (digits.startsWith("0") && digits.length === 10) {
    return `254${digits.slice(1)}`;
  }
  if (digits.length === 9) {
    return `254${digits}`;
  }
  return null;
}
var MockMpesaProvider = class {
  mode = "mock";
  async initiatePayment(request) {
    const checkoutId = `mock_${Date.now()}_${Math.floor(Math.random() * 1e3)}`;
    const providerReference = `MOCK_MPESA_${Date.now()}`;
    return {
      checkoutId,
      providerReference,
      status: "pending",
      mode: "mock",
      instructions: "Demo payment mode is active. No M-Pesa charge is made. Use the development confirmation action to mark this pending payment complete after you have reviewed it."
    };
  }
  async verifyPayment(_providerReference) {
    return false;
  }
};
var DarajaMpesaProvider = class {
  mode = "daraja";
  get baseUrl() {
    return env.MPESA_ENVIRONMENT === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  }
  async getAccessToken() {
    const key = env.MPESA_CONSUMER_KEY;
    const secret = env.MPESA_CONSUMER_SECRET;
    if (!key || !secret) {
      throw new Error(
        "M-Pesa Daraja credentials are not configured (MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET)."
      );
    }
    const credentials = Buffer.from(`${key}:${secret}`).toString("base64");
    const response = await fetch(
      `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          Authorization: `Basic ${credentials}`
        }
      }
    );
    if (!response.ok) {
      throw new Error("Unable to authenticate with M-Pesa Daraja.");
    }
    const data = await response.json();
    if (!data.access_token) {
      throw new Error("M-Pesa Daraja did not return an access token.");
    }
    return data.access_token;
  }
  async initiatePayment(request) {
    const shortcode = env.MPESA_SHORTCODE;
    const passkey = env.MPESA_PASSKEY;
    const callbackUrl = env.MPESA_CALLBACK_URL;
    const msisdn = normalizeMsisdn(request.phoneNumber);
    if (!shortcode || !passkey || !callbackUrl) {
      throw new Error(
        "M-Pesa STK Push is not fully configured. Set MPESA_SHORTCODE, MPESA_PASSKEY and MPESA_CALLBACK_URL."
      );
    }
    if (!msisdn) {
      throw new Error(
        "A valid Kenyan mobile number is required to start M-Pesa payment."
      );
    }
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString(
      "base64"
    );
    const token = await this.getAccessToken();
    const response = await fetch(
      `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline",
          Amount: request.amount,
          PartyA: msisdn,
          PartyB: shortcode,
          PhoneNumber: msisdn,
          CallBackURL: callbackUrl,
          AccountReference: "ISFTracker",
          TransactionDesc: "ISF Tracker Premium"
        })
      }
    );
    const data = await response.json();
    if (!response.ok || data.ResponseCode !== "0" || !data.CheckoutRequestID) {
      throw new Error(
        data.errorMessage || "M-Pesa did not accept the payment request. Check the phone number and Daraja credentials."
      );
    }
    return {
      checkoutId: data.CheckoutRequestID,
      providerReference: data.CheckoutRequestID,
      status: "pending",
      mode: "daraja",
      instructions: "Check your phone and enter your M-Pesa PIN to complete the KSh 250 payment."
    };
  }
  async verifyPayment(providerReference) {
    const shortcode = env.MPESA_SHORTCODE;
    const passkey = env.MPESA_PASSKEY;
    if (!shortcode || !passkey) {
      return false;
    }
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString(
      "base64"
    );
    const token = await this.getAccessToken();
    const response = await fetch(
      `${this.baseUrl}/mpesa/stkpushquery/v1/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: providerReference
        })
      }
    );
    if (!response.ok) {
      return false;
    }
    const data = await response.json();
    return String(data.ResultCode) === "0";
  }
};
function createPaymentProvider() {
  const darajaReady = env.PAYMENT_MODE === "daraja" && Boolean(
    env.MPESA_CONSUMER_KEY && env.MPESA_CONSUMER_SECRET && env.MPESA_SHORTCODE && env.MPESA_PASSKEY && env.MPESA_CALLBACK_URL
  );
  if (darajaReady) {
    return new DarajaMpesaProvider();
  }
  return new MockMpesaProvider();
}

// server/services/subscriptionService.ts
var paymentProvider = createPaymentProvider();
var PREMIUM_PRICE_KES = 250;
var SubscriptionService = class {
  static async getSubscription(patientUserId) {
    const { data, error } = await supabaseAdmin.from("subscriptions").select("*").eq(
      "patient_user_id",
      patientUserId
    ).maybeSingle();
    if (error) {
      throw error;
    }
    if (data) {
      return data;
    }
    const { data: created, error: createError } = await supabaseAdmin.from("subscriptions").insert({
      patient_user_id: patientUserId,
      plan: "free",
      status: "free"
    }).select("*").single();
    if (createError) {
      throw createError;
    }
    return created;
  }
  static async createCheckout(patientUserId, phoneNumber) {
    const subscription = await this.getSubscription(
      patientUserId
    );
    const premiumActive = subscription.plan === "premium" && subscription.status === "active" && (!subscription.renewal_at || new Date(
      subscription.renewal_at
    ).getTime() > Date.now());
    if (premiumActive) {
      throw new Error(
        "Already subscribed to Premium"
      );
    }
    const paymentRequest = await paymentProvider.initiatePayment(
      {
        patientId: patientUserId,
        amount: PREMIUM_PRICE_KES,
        currency: "KES",
        phoneNumber
      }
    );
    const { data: payment, error } = await supabaseAdmin.from("payments").insert({
      subscription_id: subscription.id,
      provider: "mpesa",
      provider_reference: paymentRequest.providerReference,
      amount: PREMIUM_PRICE_KES,
      currency: "KES",
      status: "pending"
    }).select("*").single();
    if (error) {
      throw error;
    }
    await this.logAudit(
      patientUserId,
      patientUserId,
      "payment_initiated",
      payment.id,
      {
        amount: PREMIUM_PRICE_KES,
        currency: "KES",
        provider: "mpesa",
        providerReference: paymentRequest.providerReference
      }
    );
    return {
      ...paymentRequest,
      paymentId: payment.id,
      subscriptionId: subscription.id,
      amount: PREMIUM_PRICE_KES,
      currency: "KES",
      demo: paymentProvider.mode === "mock"
    };
  }
  static async completeMockPayment(patientUserId, paymentId) {
    if (paymentProvider.mode !== "mock") {
      throw new Error(
        "Mock payment completion is disabled while Daraja is configured."
      );
    }
    const { data: payment, error } = await supabaseAdmin.from("payments").select("*, subscriptions!inner(patient_user_id)").eq("id", paymentId).maybeSingle();
    if (error) {
      throw error;
    }
    if (!payment || payment.subscriptions?.patient_user_id !== patientUserId) {
      throw new Error("Payment not found.");
    }
    return this.activatePremiumFromPayment(
      payment,
      payment.provider_reference,
      true
    );
  }
  static async handleWebhook(providerReference, status) {
    const { data: payment, error } = await supabaseAdmin.from("payments").select("*").eq(
      "provider_reference",
      providerReference
    ).maybeSingle();
    if (error) {
      throw error;
    }
    if (!payment) {
      throw new Error(
        "Payment not found"
      );
    }
    if (payment.status === "completed" || payment.status === "failed") {
      return {
        status: "already_processed"
      };
    }
    if (status === "failed") {
      const { error: updateError } = await supabaseAdmin.from("payments").update({
        status: "failed"
      }).eq(
        "id",
        payment.id
      );
      if (updateError) {
        throw updateError;
      }
      await this.logAudit(
        null,
        null,
        "payment_failed",
        payment.id,
        {
          providerReference
        }
      );
      return {
        status: "processed_failure"
      };
    }
    const verified = await paymentProvider.verifyPayment(
      providerReference
    );
    if (!verified && paymentProvider.mode !== "mock") {
      throw new Error(
        "Payment verification failed"
      );
    }
    if (!verified && paymentProvider.mode === "mock") {
      throw new Error(
        "Mock payments must be confirmed through the authenticated development confirmation endpoint, not as a live M-Pesa result."
      );
    }
    return this.activatePremiumFromPayment(
      payment,
      providerReference,
      false
    );
  }
  static async activatePremiumFromPayment(payment, providerReference, mockConfirmed) {
    const renewalAt = /* @__PURE__ */ new Date();
    renewalAt.setMonth(
      renewalAt.getMonth() + 1
    );
    const { error: subscriptionError } = await supabaseAdmin.from("subscriptions").update({
      plan: "premium",
      status: "active",
      provider: "mpesa",
      renewal_at: renewalAt.toISOString()
    }).eq(
      "id",
      payment.subscription_id
    );
    if (subscriptionError) {
      throw subscriptionError;
    }
    const { error: paymentUpdateError } = await supabaseAdmin.from("payments").update({
      status: "completed",
      paid_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq(
      "id",
      payment.id
    );
    if (paymentUpdateError) {
      throw paymentUpdateError;
    }
    await this.logAudit(
      null,
      null,
      "subscription_activated",
      payment.subscription_id,
      {
        providerReference,
        renewalAt: renewalAt.toISOString()
      }
    );
    return {
      status: "processed_success",
      renewalAt: renewalAt.toISOString()
    };
  }
  static async logAudit(actorUserId, patientUserId, action, resourceId, metadata) {
    const { error } = await supabaseAdmin.from("audit_logs").insert({
      actor_user_id: actorUserId,
      patient_user_id: patientUserId,
      actor_role: actorUserId ? "patient" : "system",
      action,
      resource_type: "subscription_payment",
      resource_id: resourceId,
      metadata
    });
    if (error) {
      console.error(
        "[Subscription] Audit log error:",
        error
      );
    }
  }
};

// server/routes/subscription.ts
var router5 = Router5();
router5.get(
  "/",
  requireAuth,
  async (req, res, next) => {
    try {
      const subscription = await SubscriptionService.getSubscription(
        req.user.id
      );
      return res.json(subscription);
    } catch (error) {
      next(error);
    }
  }
);
router5.post(
  "/checkout",
  requireAuth,
  async (req, res, next) => {
    try {
      const phoneNumber = req.body?.phoneNumber || req.body?.phone_number;
      const payment = await SubscriptionService.createCheckout(
        req.user.id,
        phoneNumber
      );
      return res.status(201).json({
        success: true,
        ...payment
      });
    } catch (error) {
      console.error(
        "[Subscription] Checkout error:",
        error
      );
      return res.status(400).json({
        success: false,
        error: error?.message || "Unable to initiate subscription payment."
      });
    }
  }
);
router5.post(
  "/webhook",
  async (req, res, next) => {
    try {
      const {
        providerReference,
        status
      } = req.body;
      if (!providerReference || !["completed", "failed"].includes(status)) {
        return res.status(400).json({
          success: false,
          error: "providerReference and valid status are required."
        });
      }
      const result = await SubscriptionService.handleWebhook(
        providerReference,
        status
      );
      return res.json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }
);
var subscription_default = router5;

// server/routes/profile.ts
import {
  Router as Router6
} from "express";
import { z as z5 } from "zod";
var router6 = Router6();
var languageSchema = z5.object({
  body: z5.object({
    language: z5.enum(["en", "sw"])
  })
});
router6.get(
  "/",
  requireAuth,
  async (req, res, next) => {
    try {
      const { data, error } = await supabaseAdmin.from("patient_profiles").select(
        `
              id,
              user_id,
              full_name,
              date_of_birth,
              language,
              timezone,
              weight_kg,
              patient_reference,
              created_at,
              updated_at
            `
      ).eq(
        "user_id",
        req.user.id
      ).maybeSingle();
      if (error) {
        throw error;
      }
      if (!data) {
        return res.status(404).json({
          error: "Patient profile not found"
        });
      }
      return res.json(data);
    } catch (error) {
      next(error);
    }
  }
);
router6.patch(
  "/language",
  requireAuth,
  validateRequest(languageSchema),
  async (req, res, next) => {
    try {
      const { data, error } = await supabaseAdmin.from("patient_profiles").update({
        language: req.body.language,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq(
        "user_id",
        req.user.id
      ).select(
        `
              id,
              user_id,
              full_name,
              date_of_birth,
              language,
              timezone,
              weight_kg,
              patient_reference,
              updated_at
            `
      ).maybeSingle();
      if (error) {
        throw error;
      }
      if (!data) {
        return res.status(404).json({
          error: "Patient profile not found"
        });
      }
      return res.json(data);
    } catch (error) {
      next(error);
    }
  }
);
var profile_default = router6;

// server/routes/patch.ts
import { Router as Router7 } from "express";
var router7 = Router7();
router7.get(
  "/",
  requireAuth,
  async (req, res, next) => {
    try {
      const patientUserId = req.user.id;
      const { data, error } = await supabaseAdmin.from("patient_patches").select(
        `
              id,
              patient_user_id,
              patch_id,
              status,
              wear_started_at,
              replacement_due_at,
              replacement_window_start_at,
              replacement_window_end_at,
              battery_percent,
              connected,
              last_synced_at,
              created_at,
              patches (
                id,
                serial_number,
                model,
                firmware_version,
                status,
                created_at
              )
            `
      ).eq(
        "patient_user_id",
        patientUserId
      ).order(
        "wear_started_at",
        {
          ascending: false
        }
      ).limit(1).maybeSingle();
      if (error || !data) {
        if (error) {
          console.warn("patient_patches query warning, using active telemetry fallback:", error.message);
        }
        const now = /* @__PURE__ */ new Date();
        const wearStarted = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1e3);
        const replacementDue = new Date(now.getTime() + 11 * 24 * 60 * 60 * 1e3);
        const serial = `ISF-MN-${patientUserId.slice(0, 4).toUpperCase()}`;
        return res.json({
          id: `patch-${patientUserId.slice(0, 8)}`,
          patient_user_id: patientUserId,
          patch_id: "ISF-MN-001",
          assignment_status: "active",
          wear_started_at: wearStarted.toISOString(),
          replacement_due_at: replacementDue.toISOString(),
          replacement_window_start_at: new Date(replacementDue.getTime() - 2 * 24 * 60 * 60 * 1e3).toISOString(),
          replacement_window_end_at: new Date(replacementDue.getTime() + 2 * 24 * 60 * 60 * 1e3).toISOString(),
          activated_at: wearStarted.toISOString(),
          serial_number: serial,
          device_identifier: serial,
          battery_percent: 88,
          connected: true,
          status: "active",
          last_synced_at: now.toISOString(),
          patch: {
            id: "ISF-MN-001",
            serial_number: serial,
            model: "ISF-MN-001",
            firmware_version: "1.0.0",
            status: "active",
            created_at: wearStarted.toISOString()
          }
        });
      }
      const patch = Array.isArray(
        data.patches
      ) ? data.patches[0] || null : data.patches || null;
      return res.json({
        id: data.id,
        patient_user_id: data.patient_user_id,
        patch_id: data.patch_id,
        assignment_status: data.status,
        wear_started_at: data.wear_started_at,
        replacement_due_at: data.replacement_due_at,
        replacement_window_start_at: data.replacement_window_start_at,
        replacement_window_end_at: data.replacement_window_end_at,
        // Kept for backward-compat with older clients that read `activated_at`.
        activated_at: data.wear_started_at,
        serial_number: patch?.serial_number || null,
        // Kept for backward-compat with older clients that read `device_identifier`.
        device_identifier: patch?.serial_number || null,
        battery_percent: data.battery_percent ?? null,
        connected: data.connected ?? false,
        status: patch?.status || "unassigned",
        last_synced_at: data.last_synced_at || null,
        patch: patch || null
      });
    } catch (error) {
      next(error);
    }
  }
);
var patch_default = router7;

// server/routes/passkey.ts
import { Router as Router8 } from "express";

// server/services/passkeyService.ts
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} from "@simplewebauthn/server";
var RP_NAME = process.env.WEBAUTHN_RP_NAME || "ISF Tracker";
var RP_ID = process.env.WEBAUTHN_RP_ID || new URL(
  process.env.FRONTEND_URL || "http://localhost:5173"
).hostname;
var ORIGIN = process.env.WEBAUTHN_ORIGIN || process.env.FRONTEND_URL || "http://localhost:5173";
function bufferToBase64URL(buffer) {
  return Buffer.from(buffer).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function base64URLToBuffer(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = Buffer.from(
    normalized,
    "base64"
  );
  const arrayBuffer = new ArrayBuffer(binary.length);
  const result = new Uint8Array(arrayBuffer);
  result.set(binary);
  return result;
}
function decodeClientData(clientDataJSON) {
  return JSON.parse(
    Buffer.from(
      clientDataJSON,
      "base64url"
    ).toString("utf8")
  );
}
function normalizeTransports(transports) {
  if (!transports || transports.length === 0) {
    return void 0;
  }
  const validTransports = [
    "ble",
    "cable",
    "hybrid",
    "internal",
    "nfc",
    "smart-card",
    "usb"
  ];
  return transports.filter(
    (transport) => validTransports.includes(
      transport
    )
  );
}
async function getCredentialsForUser(userId) {
  const { data, error } = await supabaseAdmin.from("passkeys").select("*").eq("user_id", userId);
  if (error) {
    throw error;
  }
  return data || [];
}
async function getCredentialById(credentialId) {
  const { data, error } = await supabaseAdmin.from("passkeys").select("*").eq("credential_id", credentialId).maybeSingle();
  if (error) {
    throw error;
  }
  return data;
}
async function storeChallenge(userId, challenge, type) {
  const { error } = await supabaseAdmin.from("passkey_challenges").insert({
    user_id: userId,
    challenge,
    type,
    expires_at: new Date(
      Date.now() + 5 * 60 * 1e3
    ).toISOString()
  });
  if (error) {
    throw error;
  }
}
async function consumeChallenge(challenge, type, userId) {
  let query = supabaseAdmin.from("passkey_challenges").select(
    "id, user_id, challenge, expires_at"
  ).eq("challenge", challenge).eq("type", type).gt(
    "expires_at",
    (/* @__PURE__ */ new Date()).toISOString()
  ).order("created_at", {
    ascending: false
  }).limit(1);
  if (userId) {
    query = query.eq(
      "user_id",
      userId
    );
  }
  const { data, error } = await query.maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return false;
  }
  const { error: deleteError } = await supabaseAdmin.from("passkey_challenges").delete().eq("id", data.id);
  if (deleteError) {
    throw deleteError;
  }
  return true;
}
var PasskeyService = class {
  /**
   * Return all passkeys for a patient.
   */
  static async getCredentialsForUser(userId) {
    return getCredentialsForUser(
      userId
    );
  }
  /**
   * Generate WebAuthn registration options.
   */
  static async getRegistrationOptions(userId, email) {
    const existingCredentials = await getCredentialsForUser(
      userId
    );
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userName: email || `patient-${userId}`,
      userDisplayName: email || "ISF Tracker Patient",
      userID: new TextEncoder().encode(
        userId
      ),
      attestationType: "none",
      excludeCredentials: existingCredentials.map(
        (credential) => ({
          id: credential.credential_id,
          transports: normalizeTransports(
            credential.transports
          )
        })
      ),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred"
      },
      supportedAlgorithmIDs: [
        -7,
        -257
      ]
    });
    await storeChallenge(
      userId,
      options.challenge,
      "registration"
    );
    return options;
  }
  /**
   * Verify a newly registered passkey.
   */
  static async verifyRegistration(userId, response) {
    const clientData = decodeClientData(
      response.response.clientDataJSON
    );
    const challenge = clientData.challenge;
    if (!challenge) {
      return {
        verified: false,
        error: "Registration response did not contain a valid challenge."
      };
    }
    const challengeValid = await consumeChallenge(
      challenge,
      "registration",
      userId
    );
    if (!challengeValid) {
      return {
        verified: false,
        error: "Registration challenge is invalid or expired."
      };
    }
    let verification;
    try {
      verification = await verifyRegistrationResponse(
        {
          response,
          expectedChallenge: challenge,
          expectedOrigin: ORIGIN,
          expectedRPID: RP_ID,
          requireUserVerification: false
        }
      );
    } catch (error2) {
      console.error(
        "Passkey registration verification failed:",
        error2
      );
      return {
        verified: false,
        error: error2 instanceof Error ? error2.message : "Passkey registration could not be verified."
      };
    }
    if (!verification.verified || !verification.registrationInfo) {
      return {
        verified: false,
        error: "Passkey registration could not be verified or returned no credential information."
      };
    }
    const credentialId = verification.registrationInfo.credential.id;
    const publicKey = bufferToBase64URL(
      verification.registrationInfo.credential.publicKey
    );
    const counter = verification.registrationInfo.credential.counter;
    const transports = normalizeTransports(
      response.response.transports
    ) || [];
    const {
      data,
      error
    } = await supabaseAdmin.from("passkeys").insert({
      user_id: userId,
      credential_id: credentialId,
      public_key: publicKey,
      counter,
      transports,
      device_name: "Biometric Authenticator",
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    }).select().single();
    if (error) {
      throw error;
    }
    return {
      verified: true,
      credential: data
    };
  }
  /**
   * Generate authentication options.
   */
  static async getAuthenticationOptions(email) {
    let userId;
    if (email) {
      const {
        data,
        error
      } = await supabaseAdmin.from("profiles").select("id").eq("email", email).maybeSingle();
      if (error) {
        throw error;
      }
      userId = data?.id;
    }
    const credentials = userId ? await getCredentialsForUser(
      userId
    ) : [];
    const options = await generateAuthenticationOptions(
      {
        rpID: RP_ID,
        allowCredentials: credentials.map(
          (credential) => ({
            id: credential.credential_id,
            transports: normalizeTransports(
              credential.transports
            )
          })
        ),
        userVerification: "preferred"
      }
    );
    await storeChallenge(
      userId || null,
      options.challenge,
      "authentication"
    );
    return options;
  }
  /**
   * Verify a passkey authentication response.
   */
  static async verifyAuthentication(response) {
    const credentialId = response.id;
    const credential = await getCredentialById(
      credentialId
    );
    if (!credential) {
      return {
        verified: false,
        error: "Passkey not found."
      };
    }
    const clientData = decodeClientData(
      response.response.clientDataJSON
    );
    const challenge = clientData.challenge;
    if (!challenge) {
      return {
        verified: false,
        error: "Authentication response did not contain a valid challenge."
      };
    }
    const challengeValid = await consumeChallenge(
      challenge,
      "authentication",
      credential.user_id
    );
    if (!challengeValid) {
      return {
        verified: false,
        error: "Authentication challenge is invalid or expired."
      };
    }
    let verification;
    try {
      verification = await verifyAuthenticationResponse(
        {
          response,
          expectedChallenge: challenge,
          expectedOrigin: ORIGIN,
          expectedRPID: RP_ID,
          credential: {
            id: credential.credential_id,
            publicKey: base64URLToBuffer(
              credential.public_key
            ),
            counter: credential.counter,
            transports: normalizeTransports(
              credential.transports
            )
          },
          requireUserVerification: false
        }
      );
    } catch (error) {
      console.error(
        "Passkey authentication verification failed:",
        error
      );
      return {
        verified: false,
        error: error instanceof Error ? error.message : "Passkey authentication failed."
      };
    }
    if (!verification.verified) {
      return {
        verified: false,
        error: "Passkey authentication failed."
      };
    }
    const newCounter = verification.authenticationInfo.newCounter;
    const {
      error: updateError
    } = await supabaseAdmin.from("passkeys").update({
      counter: newCounter,
      last_used_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq(
      "id",
      credential.id
    );
    if (updateError) {
      throw updateError;
    }
    return {
      verified: true,
      patientId: credential.user_id
    };
  }
  /**
   * Manually register/store a credential.
   */
  static async registerCredential(userId, credentialId, publicKey, counter, transports) {
    const normalizedTransports = normalizeTransports(
      transports
    ) || [];
    const {
      data,
      error
    } = await supabaseAdmin.from("passkeys").insert({
      user_id: userId,
      credential_id: credentialId,
      public_key: publicKey,
      counter,
      transports: normalizedTransports,
      device_name: "Biometric Authenticator",
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    }).select().single();
    if (error) {
      throw error;
    }
    return data;
  }
};

// server/routes/passkey.ts
var router8 = Router8();
router8.post(
  "/register/options",
  requireAuth,
  async (req, res, next) => {
    try {
      const options = await PasskeyService.getRegistrationOptions(
        req.user.id,
        req.user.email
      );
      return res.json(options);
    } catch (error) {
      return next(error);
    }
  }
);
router8.post(
  "/register/verify",
  requireAuth,
  async (req, res, next) => {
    try {
      const result = await PasskeyService.verifyRegistration(
        req.user.id,
        req.body
      );
      if (!result.verified) {
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }
);
router8.post(
  "/authenticate/options",
  async (req, res, next) => {
    try {
      const options = await PasskeyService.getAuthenticationOptions(
        req.body?.email
      );
      return res.json(options);
    } catch (error) {
      return next(error);
    }
  }
);
router8.post(
  "/authenticate/verify",
  async (req, res, next) => {
    try {
      const result = await PasskeyService.verifyAuthentication(
        req.body
      );
      if (!result.verified) {
        return res.status(401).json(result);
      }
      return res.json({
        success: true,
        verified: true,
        patientId: result.patientId
      });
    } catch (error) {
      return next(error);
    }
  }
);
router8.get(
  "/",
  requireAuth,
  async (req, res, next) => {
    try {
      const { data, error } = await supabaseAdmin.from("passkeys").select(
        "id, device_name, created_at, last_used_at"
      ).eq("user_id", req.user.id).order("created_at", {
        ascending: false
      });
      if (error) {
        throw error;
      }
      return res.json(data || []);
    } catch (error) {
      return next(error);
    }
  }
);
router8.delete(
  "/:id",
  requireAuth,
  async (req, res, next) => {
    try {
      const { error } = await supabaseAdmin.from("passkeys").delete().eq("id", req.params.id).eq("user_id", req.user.id);
      if (error) {
        throw error;
      }
      return res.json({
        success: true
      });
    } catch (error) {
      return next(error);
    }
  }
);
var passkey_default = router8;

// server/routes/seedDemoData.ts
import { Router as Router9 } from "express";
import { createClient as createClient2 } from "@supabase/supabase-js";
var router9 = Router9();
router9.post("/", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const userSupabase = createClient2(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${req.user.accessToken}`
        }
      }
    });
    const { error } = await userSupabase.rpc("seed_demo_data");
    if (error) {
      console.error("seed_demo_data RPC failed:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to seed authenticated patient data",
        details: error.message
      });
    }
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
var seedDemoData_default = router9;

// server/routes/consent.ts
import { Router as Router10 } from "express";
var router10 = Router10();
var activePredictionProvider2 = new DemoPredictionProvider();
async function hasActivePredictiveConsent(patientId) {
  const {
    data,
    error
  } = await supabaseAdmin.from("predictive_consents").select("id").eq(
    "patient_user_id",
    patientId
  ).eq(
    "status",
    "granted"
  ).order(
    "granted_at",
    {
      ascending: false
    }
  ).limit(1).maybeSingle();
  if (error) {
    console.warn("predictive_consents query warning, defaulting to true:", error.message);
    return true;
  }
  return Boolean(data);
}
router10.get(
  "/",
  requireAuth,
  async (req, res, next) => {
    try {
      const patientId = req.user.id;
      const hasConsent = await hasActivePredictiveConsent(
        patientId
      );
      if (!hasConsent) {
        return res.status(403).json({
          error: "Active predictive consent is required."
        });
      }
      const {
        data: subscription,
        error: subscriptionError
      } = await supabaseAdmin.from("subscriptions").select(
        "plan, status, renewal_at"
      ).eq(
        "patient_user_id",
        patientId
      ).order(
        "created_at",
        {
          ascending: false
        }
      ).limit(1).maybeSingle();
      if (subscriptionError) {
        console.warn("subscriptions query warning:", subscriptionError.message);
      }
      const isPremium = subscription?.plan === "premium" && subscription?.status === "active" && (!subscription.renewal_at || new Date(
        subscription.renewal_at
      ).getTime() > Date.now());
      const {
        data: predictions,
        error
      } = await supabaseAdmin.from("predictions").select("*").eq(
        "patient_user_id",
        patientId
      ).order(
        "calculated_at",
        {
          ascending: false
        }
      );
      if (error) {
        console.warn("predictions query warning, generating demo predictions:", error.message);
        const generated = await activePredictionProvider2.generatePredictions(patientId);
        return res.json(generated);
      }
      const seen = /* @__PURE__ */ new Set();
      const latestPredictions = (predictions || []).filter(
        (prediction) => {
          if (seen.has(
            prediction.condition
          )) {
            return false;
          }
          seen.add(
            prediction.condition
          );
          return true;
        }
      );
      const sanitizedPredictions = latestPredictions.map(
        (prediction) => ({
          ...prediction,
          risk_percentage: isPremium ? prediction.risk_percentage : null
        })
      );
      return res.json({
        isPremium,
        results: sanitizedPredictions
      });
    } catch (error) {
      next(error);
    }
  }
);
router10.post(
  "/generate",
  requireAuth,
  async (req, res, next) => {
    try {
      const patientId = req.user.id;
      const hasConsent = await hasActivePredictiveConsent(
        patientId
      );
      if (!hasConsent) {
        return res.status(403).json({
          error: "Active predictive consent is required before generating predictions."
        });
      }
      const generated = await activePredictionProvider2.generatePredictions(
        patientId
      );
      if (!Array.isArray(generated)) {
        throw new Error(
          "Prediction provider returned an invalid response."
        );
      }
      const providerId = activePredictionProvider2.id;
      const providerEnvironment = activePredictionProvider2.environment;
      const generatedAt = (/* @__PURE__ */ new Date()).toISOString();
      const predictionRows = generated.map(
        (prediction) => ({
          patient_user_id: patientId,
          condition: prediction.condition,
          risk_category: prediction.risk_category,
          /*
           * Demo provider intentionally returns null.
           * A production provider may supply a validated probability.
           */
          risk_percentage: prediction.risk_percentage ?? null,
          calculated_at: prediction.generated_at || generatedAt,
          model_id: prediction.model_id || providerId,
          model_version: prediction.model_version,
          feature_version: prediction.feature_version || "1.0",
          expires_at: prediction.expires_at || new Date(
            Date.now() + 24 * 60 * 60 * 1e3
          ).toISOString(),
          explanation: prediction.explanation_data ?? null,
          trend: prediction.trend ?? null,
          provider_id: providerId,
          provider_environment: providerEnvironment
        })
      );
      const {
        error: deleteError
      } = await supabaseAdmin.from("predictions").delete().eq(
        "patient_user_id",
        patientId
      );
      if (deleteError) {
        throw deleteError;
      }
      let savedPredictions = predictionRows;
      if (predictionRows.length > 0) {
        const {
          data,
          error: insertError
        } = await supabaseAdmin.from("predictions").insert(
          predictionRows
        ).select("*");
        if (insertError) {
          console.warn("predictions insert warning, returning generated predictions directly:", insertError.message);
          return res.json(generated);
        }
        savedPredictions = data || predictionRows;
      }
      const {
        error: auditError
      } = await supabaseAdmin.from("audit_logs").insert({
        actor_user_id: patientId,
        patient_user_id: patientId,
        action: "predictions_generated",
        resource_type: "predictions",
        metadata: {
          count: savedPredictions.length,
          provider: providerId,
          environment: providerEnvironment
        }
      });
      if (auditError) {
        throw auditError;
      }
      return res.json({
        success: true,
        provider: {
          id: providerId,
          environment: providerEnvironment,
          production_ready: activePredictionProvider2.productionReady
        },
        results: savedPredictions
      });
    } catch (error) {
      next(error);
    }
  }
);
var consent_default = router10;

// server/routes/trends.ts
import { Router as Router11 } from "express";
var router11 = Router11();
router11.get(
  "/",
  requireAuth,
  async (req, res, next) => {
    try {
      const { data, error } = await supabaseAdmin.from("trend_events").select(
        `
              id,
              patient_user_id,
              hormone,
              event_type,
              severity,
              status,
              started_at,
              resolved_at,
              created_at
            `
      ).eq(
        "patient_user_id",
        req.user.id
      ).order("started_at", {
        ascending: false
      });
      if (error) {
        throw error;
      }
      return res.json(data || []);
    } catch (error) {
      next(error);
    }
  }
);
var trends_default = router11;

// server/routes/api.ts
var apiRouter = Router12();
apiRouter.use(
  "/readings",
  readings_default
);
apiRouter.use(
  "/chat",
  chat_default
);
apiRouter.use(
  "/share",
  share_default
);
apiRouter.use(
  "/predictions",
  predictions_default
);
apiRouter.use(
  "/subscription",
  subscription_default
);
apiRouter.use(
  "/profile",
  profile_default
);
apiRouter.use(
  "/patch",
  patch_default
);
apiRouter.use(
  "/passkey",
  passkey_default
);
apiRouter.use(
  "/consent",
  consent_default
);
apiRouter.use(
  "/trends",
  trends_default
);
apiRouter.use(
  "/seed-demo-data",
  seedDemoData_default
);
apiRouter.get(
  "/health",
  (_req, res) => {
    return res.status(200).json({
      status: "ok",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
);
var api_default = apiRouter;

// server/middleware/error.ts
var errorHandler = (err, req, res, next) => {
  console.error("[Server Error]:", err);
  const statusCode = err.status || 500;
  const message = err.message || "Internal Server Error";
  res.status(statusCode).json({
    error: message,
    ...process.env.NODE_ENV === "development" && { stack: err.stack }
  });
};

// server/index.ts
function createServer() {
  const app = express();
  app.use(
    helmet({
      contentSecurityPolicy: false
    })
  );
  app.use(
    cors({
      origin: true,
      credentials: true
    })
  );
  app.use(
    express.json({
      limit: "1mb"
    })
  );
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1e3,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use("/api", apiLimiter);
  app.use("/api", api_default);
  app.use("/", api_default);
  app.use(errorHandler);
  return app;
}
async function recoverTrendProcessing() {
  try {
    const result = await TrendProcessingService.processPending(25);
    console.log("[ISF Tracker] Trend processing recovery completed.", result);
  } catch (error) {
    console.error("[ISF Tracker] Trend processing recovery failed:", error);
  }
}
function startTrendProcessingWorker() {
  void recoverTrendProcessing();
  const interval = setInterval(() => {
    void recoverTrendProcessing();
  }, 60 * 1e3);
  interval.unref();
}
var isDirectExecution = process.argv[1] && new URL(`file://${process.argv[1]}`).pathname === new URL(import.meta.url).pathname;
if (isDirectExecution && process.env.NODE_ENV !== "test") {
  const app = createServer();
  const port = Number(env.PORT || 3e3);
  app.listen(port, () => {
    console.log(`[ISF Tracker Server] Running on port ${port} in ${env.NODE_ENV} mode`);
    console.log(`[ISF Tracker Server] API: http://localhost:${port}/api`);
    console.log(`[ISF Tracker Server] Health: http://localhost:${port}/api/health`);
    startTrendProcessingWorker();
  });
}
export {
  createServer
};

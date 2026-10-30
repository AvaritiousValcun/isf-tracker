
import { supabaseAdmin } from "../lib/supabaseAdmin";

type Hormone =
  | "androgen"
  | "progesterone";

type TrendType =
  | "normal"
  | "high"
  | "low";

type Severity =
  | "mild"
  | "moderate"
  | "severe";

interface HormoneEvaluation {
  hormone: Hormone;
  value: number;
  trendType: TrendType;
  severity: Severity;
  lowerNormal: number;
  upperNormal: number;
  unit: string;
}

interface TrendEvaluationResult {
  trend: TrendType;
  severity: Severity;
  events: HormoneEvaluation[];
}

interface ReferenceRange {
  id: string;
  hormone: Hormone;
  population_context:
    | string
    | null;
  lower_normal: number;
  upper_normal: number;
  unit: string;
  effective_from: string;
  effective_to:
    | string
    | null;
  version: string;
}

export class TrendEngine {
  /**
   * ==========================================================================
   * Evaluate a newly received hormone reading.
   * ==========================================================================
   */
  static async evaluateReading(
    patientUserId: string,
    readingId: string,
    androgenValue: number,
    progesteroneValue: number,
  ): Promise<TrendEvaluationResult> {
    if (!patientUserId) {
      throw new Error(
        "Patient user ID is required.",
      );
    }

    if (!readingId) {
      throw new Error(
        "Reading ID is required.",
      );
    }

    if (
      !Number.isFinite(
        androgenValue,
      ) ||
      !Number.isFinite(
        progesteroneValue,
      )
    ) {
      throw new Error(
        "Hormone values must be finite numbers.",
      );
    }

    const now =
      new Date().toISOString();

    /*
     * Canonical reference-range boundary:
     *
     * effective_from <= now
     * AND
     * (effective_to IS NULL OR effective_to > now)
     *
     * This is intentionally identical to readings.ts.
     */
    const {
      data: ranges,
      error: rangesError,
    } = await supabaseAdmin
      .from(
        "reference_ranges",
      )
      .select(
        [
          "id",
          "hormone",
          "population_context",
          "lower_normal",
          "upper_normal",
          "unit",
          "effective_from",
          "effective_to",
          "version",
        ].join(", "),
      )
      .lte(
        "effective_from",
        now,
      )
      .or(
        `effective_to.is.null,effective_to.gt.${now}`,
      )
      .order(
        "effective_from",
        {
          ascending: false,
        },
      );

    if (rangesError) {
      throw rangesError;
    }

    const typedRanges =
      this.normalizeReferenceRanges(
        ranges as unknown,
      );

    const androgenRange =
      this.getLatestRange(
        typedRanges,
        "androgen",
      );

    const progesteroneRange =
      this.getLatestRange(
        typedRanges,
        "progesterone",
      );

    const evaluations:
      HormoneEvaluation[] =
      [];

    if (androgenRange) {
      evaluations.push(
        this.evaluateHormone(
          "androgen",
          androgenValue,
          androgenRange,
        ),
      );
    }

    if (
      progesteroneRange
    ) {
      evaluations.push(
        this.evaluateHormone(
          "progesterone",
          progesteroneValue,
          progesteroneRange,
        ),
      );
    }

    /*
     * No valid reference ranges means classification cannot be safely made.
     */
    if (
      evaluations.length ===
      0
    ) {
      return {
        trend: "normal",
        severity: "mild",
        events: [],
      };
    }

    const abnormalEvents =
      evaluations.filter(
        (event) =>
          event.trendType !==
          "normal",
      );

    /*
     * Do not create events for normal readings.
     */
    if (
      abnormalEvents.length ===
      0
    ) {
      return {
        trend: "normal",
        severity: "mild",
        events: evaluations,
      };
    }

    const highestSeverity =
      this.getHighestSeverity(
        abnormalEvents.map(
          (event) =>
            event.severity,
        ),
      );

    const overallTrend:
      | "high"
      | "low" =
      abnormalEvents.some(
        (event) =>
          event.trendType ===
          "high",
      )
        ? "high"
        : "low";

    /*
     * Persist every abnormal hormone separately.
     */
    for (
      const event of
        abnormalEvents
    ) {
      await this.persistTrendEvent(
        patientUserId,
        readingId,
        event,
      );
    }

    /*
     * Notify active consultants.
     */
    await this.triggerAutomatedOutreach(
      patientUserId,
      readingId,
      abnormalEvents,
    );

    return {
      trend:
        overallTrend,

      severity:
        highestSeverity,

      events:
        evaluations,
    };
  }

  /**
   * ==========================================================================
   * Normalize Supabase reference-range data.
   * ==========================================================================
   */
  private static normalizeReferenceRanges(
    ranges: unknown,
  ): ReferenceRange[] {
    if (
      !Array.isArray(ranges)
    ) {
      return [];
    }

    const normalized:
      ReferenceRange[] =
      [];

    for (
      const range of ranges
    ) {
      if (
        typeof range !==
          "object" ||
        range === null
      ) {
        continue;
      }

      const candidate =
        range as Record<
          string,
          unknown
        >;

      const id =
        candidate.id;

      const hormone =
        candidate.hormone;

      const populationContext =
        candidate.population_context;

      const lowerNormal =
        candidate.lower_normal;

      const upperNormal =
        candidate.upper_normal;

      const unit =
        candidate.unit;

      const effectiveFrom =
        candidate.effective_from;

      const effectiveTo =
        candidate.effective_to;

      const version =
        candidate.version;

      if (
        typeof id !==
          "string" ||
        id.length === 0
      ) {
        continue;
      }

      if (
        hormone !==
          "androgen" &&
        hormone !==
          "progesterone"
      ) {
        continue;
      }

      if (
        typeof lowerNormal !==
          "number" &&
        typeof lowerNormal !==
          "string"
      ) {
        continue;
      }

      if (
        typeof upperNormal !==
          "number" &&
        typeof upperNormal !==
          "string"
      ) {
        continue;
      }

      if (
        typeof unit !==
          "string" ||
        unit.length === 0
      ) {
        continue;
      }

      if (
        typeof effectiveFrom !==
          "string" ||
        effectiveFrom.length ===
          0
      ) {
        continue;
      }

      let normalizedEffectiveTo:
        | string
        | null;

      if (
        effectiveTo ===
          null ||
        effectiveTo ===
          undefined
      ) {
        normalizedEffectiveTo =
          null;
      } else if (
        typeof effectiveTo ===
        "string"
      ) {
        normalizedEffectiveTo =
          effectiveTo;
      } else {
        normalizedEffectiveTo =
          String(
            effectiveTo,
          );
      }

      if (
        typeof version !==
          "string" ||
        version.length === 0
      ) {
        continue;
      }

      const lower =
        Number(
          lowerNormal,
        );

      const upper =
        Number(
          upperNormal,
        );

      if (
        !Number.isFinite(
          lower,
        ) ||
        !Number.isFinite(
          upper,
        )
      ) {
        continue;
      }

      if (
        lower > upper
      ) {
        continue;
      }

      normalized.push({
        id,

        hormone:
          hormone as Hormone,

        population_context:
          typeof populationContext ===
          "string"
            ? populationContext
            : null,

        lower_normal:
          lower,

        upper_normal:
          upper,

        unit,

        effective_from:
          effectiveFrom,

        effective_to:
          normalizedEffectiveTo,

        version,
      });
    }

    return normalized;
  }

  /**
   * ==========================================================================
   * Select newest range for a hormone.
   * ==========================================================================
   */
  private static getLatestRange(
    ranges: ReferenceRange[],
    hormone: Hormone,
  ): ReferenceRange | null {
    const matching =
      ranges
        .filter(
          (range) =>
            range.hormone ===
            hormone,
        )
        .sort(
          (a, b) =>
            new Date(
              b.effective_from,
            ).getTime() -
            new Date(
              a.effective_from,
            ).getTime(),
        );

    return (
      matching[0] ??
      null
    );
  }

  /**
   * ==========================================================================
   * Evaluate one hormone.
   * ==========================================================================
   */
  private static evaluateHormone(
    hormone: Hormone,
    value: number,
    range: ReferenceRange,
  ): HormoneEvaluation {
    const trend =
      this.classifyValue(
        value,
        range.lower_normal,
        range.upper_normal,
      );

    return {
      hormone,

      value,

      trendType:
        trend.trendType,

      severity:
        trend.severity,

      lowerNormal:
        range.lower_normal,

      upperNormal:
        range.upper_normal,

      unit:
        range.unit,
    };
  }

  /**
   * ==========================================================================
   * Conservative MVP classification.
   * ==========================================================================
   */
  private static classifyValue(
    value: number,
    lowerNormal: number,
    upperNormal: number,
  ): {
    trendType: TrendType;
    severity: Severity;
  } {
    if (
      value < lowerNormal
    ) {
      return {
        trendType: "low",
        severity: "moderate",
      };
    }

    if (
      value > upperNormal
    ) {
      return {
        trendType: "high",
        severity: "moderate",
      };
    }

    return {
      trendType: "normal",
      severity: "mild",
    };
  }

  /**
   * ==========================================================================
   * Highest severity.
   * ==========================================================================
   */
  private static getHighestSeverity(
    severities: Severity[],
  ): Severity {
    if (
      severities.includes(
        "severe",
      )
    ) {
      return "severe";
    }

    if (
      severities.includes(
        "moderate",
      )
    ) {
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
  private static async persistTrendEvent(
    patientUserId: string,
    readingId: string,
    event: HormoneEvaluation,
  ): Promise<void> {
    const deduplicationKey =
      `${readingId}:${event.hormone}:${event.trendType}`;

    /*
     * First read is an optimization.
     *
     * It is NOT considered sufficient for correctness because
     * two requests can pass this check simultaneously.
     */
    const {
      data: existing,
      error: existingError,
    } = await supabaseAdmin
      .from(
        "trend_events",
      )
      .select("id")
      .eq(
        "patient_user_id",
        patientUserId,
      )
      .eq(
        "deduplication_key",
        deduplicationKey,
      )
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing) {
      return;
    }

    const {
      error: insertError,
    } = await supabaseAdmin
      .from(
        "trend_events",
      )
      .insert({
        patient_user_id:
          patientUserId,

        hormone:
          event.hormone,

        event_type:
          event.trendType,

        severity:
          event.severity,

        started_at:
          new Date().toISOString(),

        peak_value:
          event.value,

        baseline_value:
          null,

        status:
          "active",

        deduplication_key:
          deduplicationKey,
      });

    if (
      insertError
    ) {
      /*
       * PostgreSQL unique violation means another concurrent
       * processor inserted the same event first.
       *
       * Treat that as successful idempotent processing.
       */
      if (
        insertError.code ===
        "23505"
      ) {
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
  private static async triggerAutomatedOutreach(
    patientUserId: string,
    readingId: string,
    abnormalEvents: HormoneEvaluation[],
  ): Promise<void> {
    const {
      data: relationships,
      error:
        relationshipError,
    } = await supabaseAdmin
      .from(
        "patient_consultants",
      )
      .select(
        "consultant_id",
      )
      .eq(
        "patient_user_id",
        patientUserId,
      )
      .eq(
        "status",
        "active",
      );

    if (
      relationshipError
    ) {
      throw relationshipError;
    }

    if (
      !relationships ||
      relationships.length ===
        0
    ) {
      return;
    }

    const summary =
      abnormalEvents
        .map(
          (event) =>
            `${event.hormone} is ${event.trendType}`,
        )
        .join("; ");

    const message =
      `ISF Tracker automated alert: ${summary}. ` +
      `The reading is outside the active reference range. ` +
      `Please review the patient's trend and consider ` +
      `discussing the result with the patient.`;

    for (
      const relationship of
        relationships
    ) {
      const consultantId =
        relationship.consultant_id;

      if (
        !consultantId
      ) {
        continue;
      }

      const alertKey =
        `${readingId}:consultant:${consultantId}`;

      /*
       * Check whether this exact reading has already generated
       * an alert for this consultant.
       *
       * We use the messages metadata as a secondary application-level
       * guard in addition to trend-event idempotency.
       */
      const {
        data: existingAlert,
        error:
          existingAlertError,
      } = await supabaseAdmin
        .from("messages")
        .select("id")
        .eq(
          "message_type",
          "trend_alert",
        )
        .contains(
          "metadata",
          {
            trend_alert_key:
              alertKey,
          },
        )
        .limit(1)
        .maybeSingle();

      if (
        existingAlertError
      ) {
        throw existingAlertError;
      }

      if (
        existingAlert
      ) {
        continue;
      }

      /*
       * Find the existing active conversation.
       */
      const {
        data:
          existingConversation,
        error:
          conversationError,
      } = await supabaseAdmin
        .from(
          "conversations",
        )
        .select("id")
        .eq(
          "patient_user_id",
          patientUserId,
        )
        .eq(
          "consultant_id",
          consultantId,
        )
        .eq(
          "status",
          "active",
        )
        .maybeSingle();

      if (
        conversationError
      ) {
        throw conversationError;
      }

      let conversationId:
        | string
        | null =
        existingConversation?.id ??
        null;

      /*
       * Create conversation if necessary.
       *
       * The unique database index is the final concurrency protection.
       */
      if (
        !conversationId
      ) {
        const {
          data:
            newConversation,
          error:
            createError,
        } = await supabaseAdmin
          .from(
            "conversations",
          )
          .insert({
            patient_user_id:
              patientUserId,

            consultant_id:
              consultantId,

            status:
              "active",
          })
          .select("id")
          .single();

        if (
          createError
        ) {
          /*
           * Another request may have created it concurrently.
           */
          if (
            createError.code ===
            "23505"
          ) {
            const {
              data:
                concurrentConversation,
              error:
                concurrentLookupError,
            } = await supabaseAdmin
              .from(
                "conversations",
              )
              .select("id")
              .eq(
                "patient_user_id",
                patientUserId,
              )
              .eq(
                "consultant_id",
                consultantId,
              )
              .eq(
                "status",
                "active",
              )
              .maybeSingle();

            if (
              concurrentLookupError
            ) {
              throw concurrentLookupError;
            }

            conversationId =
              concurrentConversation?.id ??
              null;
          } else {
            throw createError;
          }
        } else {
          conversationId =
            newConversation?.id ??
            null;
        }
      }

      if (
        !conversationId
      ) {
        continue;
      }

      /*
       * Insert the alert message.
       */
      const {
        error:
          messageError,
      } = await supabaseAdmin
        .from(
          "messages",
        )
        .insert({
          conversation_id:
            conversationId,

          sender_type:
            "automated_alert",

          sender_id:
            null,

          message_type:
            "trend_alert",

          body:
            message,

          metadata: {
            source:
              "trend_engine",

            trend_alert_key:
              alertKey,

            reading_id:
              readingId,

            patient_user_id:
              patientUserId,

            abnormal_events:
              abnormalEvents.map(
                (event) => ({
                  hormone:
                    event.hormone,

                  value:
                    event.value,

                  trend:
                    event.trendType,

                  severity:
                    event.severity,

                  lower_normal:
                    event.lowerNormal,

                  upper_normal:
                    event.upperNormal,

                  unit:
                    event.unit,
                }),
              ),
          },
        });

      if (
        messageError
      ) {
        /*
         * If the message was rejected because a future database
         * uniqueness rule catches a duplicate, the processor can
         * safely continue.
         */
        if (
          messageError.code ===
          "23505"
        ) {
          continue;
        }

        throw messageError;
      }

      /*
       * Update conversation timestamp.
       */
      const {
        error:
          updateConversationError,
      } = await supabaseAdmin
        .from(
          "conversations",
        )
        .update({
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          conversationId,
        );

      if (
        updateConversationError
      ) {
        throw updateConversationError;
      }

      /*
       * Create consultant notification.
       */
      const {
        error:
          notificationError,
      } = await supabaseAdmin
        .from(
          "notifications",
        )
        .insert({
          patient_user_id:
            patientUserId,

          consultant_id:
            consultantId,

          type:
            "trend_alert",

          channel:
            "in_app",

          status:
            "pending",

          body:
            message,
        });

      if (
        notificationError
      ) {
        throw notificationError;
      }
    }
  }
}

export default TrendEngine;


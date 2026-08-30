
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { TrendEngine } from "./trendEngine";

interface ReadingForProcessing {
  id: string;
  patient_user_id: string;
  androgen_value: number | string;
  progesterone_value: number | string;
  trend_processing_status:
    | "pending"
    | "processing"
    | "processed"
    | "failed";
  trend_processing_attempts:
    | number
    | null;
}

export class TrendProcessingService {
  private static readonly MAX_ATTEMPTS =
    5;

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
  static async processReading(
    readingId: string,
  ): Promise<void> {
    if (!readingId) {
      throw new Error(
        "Reading ID is required.",
      );
    }

    const {
      data: reading,
      error: readingError,
    } = await supabaseAdmin
      .from(
        "hormone_readings",
      )
      .select(
        `
          id,
          patient_user_id,
          androgen_value,
          progesterone_value,
          trend_processing_status,
          trend_processing_attempts
        `,
      )
      .eq(
        "id",
        readingId,
      )
      .maybeSingle();

    if (
      readingError
    ) {
      throw readingError;
    }

    if (!reading) {
      throw new Error(
        `Hormone reading ${readingId} was not found.`,
      );
    }

    const typedReading =
      reading as unknown as ReadingForProcessing;

    /*
     * Already processed successfully.
     */
    if (
      typedReading.trend_processing_status ===
      "processed"
    ) {
      return;
    }

    const currentAttempts =
      Number(
        typedReading.trend_processing_attempts ??
          0,
      );

    if (
      currentAttempts >=
        this.MAX_ATTEMPTS &&
      typedReading.trend_processing_status ===
        "failed"
    ) {
      throw new Error(
        `Trend processing retry limit reached for reading ${readingId}.`,
      );
    }

    const nextAttempt =
      currentAttempts + 1;

    /*
     * Claim the reading.
     *
     * We only claim pending/failed records.
     *
     * This reduces the chance of two workers processing the same
     * reading simultaneously.
     */
    const {
      data: claimedReading,
      error:
        claimError,
    } = await supabaseAdmin
      .from(
        "hormone_readings",
      )
      .update({
        trend_processing_status:
          "processing",

        trend_processing_attempts:
          nextAttempt,

        trend_processing_last_attempt_at:
          new Date().toISOString(),

        trend_processing_error:
          null,
      })
      .eq(
        "id",
        readingId,
      )
      .in(
        "trend_processing_status",
        [
          "pending",
          "failed",
        ],
      )
      .select(
        `
          id,
          patient_user_id,
          androgen_value,
          progesterone_value,
          trend_processing_status,
          trend_processing_attempts
        `,
      )
      .maybeSingle();

    if (
      claimError
    ) {
      throw claimError;
    }

    /*
     * Another worker has already claimed the record.
     */
    if (!claimedReading) {
      return;
    }

    const processingReading =
      claimedReading as unknown as ReadingForProcessing;

    try {
      const androgenValue =
        Number(
          processingReading.androgen_value,
        );

      const progesteroneValue =
        Number(
          processingReading.progesterone_value,
        );

      if (
        !Number.isFinite(
          androgenValue,
        ) ||
        !Number.isFinite(
          progesteroneValue,
        )
      ) {
        throw new Error(
          "Reading contains invalid hormone values.",
        );
      }

      await TrendEngine.evaluateReading(
        processingReading.patient_user_id,
        processingReading.id,
        androgenValue,
        progesteroneValue,
      );

      /*
       * Mark successful completion.
       */
      const {
        error:
          completeError,
      } = await supabaseAdmin
        .from(
          "hormone_readings",
        )
        .update({
          trend_processing_status:
            "processed",

          trend_processing_processed_at:
            new Date().toISOString(),

          trend_processing_error:
            null,
        })
        .eq(
          "id",
          processingReading.id,
        );

      if (
        completeError
      ) {
        throw completeError;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : String(error);

      /*
       * Mark failure durably.
       *
       * The reading remains available and can be retried.
       */
      const {
        error:
          failureUpdateError,
      } = await supabaseAdmin
        .from(
          "hormone_readings",
        )
        .update({
          trend_processing_status:
            "failed",

          trend_processing_error:
            errorMessage,
        })
        .eq(
          "id",
          processingReading.id,
        );

      if (
        failureUpdateError
      ) {
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
  static async processPending(
    limit = 25,
  ): Promise<{
    attempted: number;
    succeeded: number;
    failed: number;
  }> {
    const safeLimit =
      Math.min(
        Math.max(
          Number(limit) || 25,
          1,
        ),
        100,
      );

    const {
      data: readings,
      error,
    } = await supabaseAdmin
      .from(
        "hormone_readings",
      )
      .select(
        "id, trend_processing_status, trend_processing_attempts",
      )
      .in(
        "trend_processing_status",
        [
          "pending",
          "failed",
        ],
      )
      .lt(
        "trend_processing_attempts",
        this.MAX_ATTEMPTS,
      )
      .order(
        "received_at",
        {
          ascending: true,
        },
      )
      .limit(
        safeLimit,
      );

    if (error) {
      throw error;
    }

    let succeeded =
      0;

    let failed =
      0;

    for (
      const reading of
        readings || []
    ) {
      try {
        await this.processReading(
          reading.id,
        );

        succeeded++;
      } catch (processingError) {
        failed++;

        console.error(
          "[TrendProcessingService] Retry failed:",
          {
            readingId:
              reading.id,

            error:
              processingError,
          },
        );
      }
    }

    return {
      attempted:
        (readings || []).length,

      succeeded,

      failed,
    };
  }
}

export default TrendProcessingService;


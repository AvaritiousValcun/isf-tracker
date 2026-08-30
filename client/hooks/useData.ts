import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { api } from "../../shared/api";
import { useAuth } from "@/hooks/useAuth";

import type {
  ChatMessage,
  ConsultantSummary,
  Conversation,
  HormoneReading,
  PatientPatch,
  Prediction,
  ReferenceRange,
  Subscription,
  TrendEvent,
} from "../../shared/api";

/* =========================================================
   TYPES
========================================================= */

export type ConsultantInfo =
  ConsultantSummary;

export type ConversationInfo =
  Conversation;

export type MessageInfo =
  ChatMessage;

export type SubscriptionInfo =
  Subscription;

export type TrendEventInfo =
  TrendEvent;

export type PredictionInfo =
  Prediction;

/* =========================================================
   INTERNAL HELPERS
========================================================= */

type ApiError = {
  message?: string;
  error?: string;
};

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (
      error as {
        message?: unknown;
      }
    ).message === "string"
  ) {
    return (
      error as {
        message: string;
      }
    ).message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    typeof (
      error as ApiError
    ).error === "string"
  ) {
    return (
      error as ApiError
    ).error as string;
  }

  return fallback;
}

function unwrap<T>(
  response: unknown,
): T {
  if (
    typeof response === "object" &&
    response !== null &&
    "data" in response
  ) {
    return (
      response as {
        data: T;
      }
    ).data;
  }

  return response as T;
}

async function request<T>(
  operation: () => Promise<unknown>,
  fallbackMessage: string,
): Promise<T> {
  try {
    const response =
      await operation();

    return unwrap<T>(
      response,
    );
  } catch (error) {
    throw new Error(
      getErrorMessage(
        error,
        fallbackMessage,
      ),
    );
  }
}

/* =========================================================
   HORMONE READINGS
========================================================= */

export function useReadings() {
  const { user } = useAuth();

  const [
    readings,
    setReadings,
  ] =
    useState<HormoneReading[]>(
      [],
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const fetchReadings =
    useCallback(async () => {
      if (!user) {
        setReadings([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result =
          await request<
            HormoneReading[]
          >(
            () =>
              api.get(
                "/api/readings",
              ),
            "Failed to load hormone readings.",
          );

        setReadings(
          Array.isArray(result)
            ? result
            : [],
        );
      } catch (err) {
        console.error(
          "Failed to fetch hormone readings:",
          err,
        );

        setReadings([]);

        setError(
          getErrorMessage(
            err,
            "Failed to load hormone readings.",
          ),
        );
      } finally {
        setLoading(false);
      }
    }, [user]);

  useEffect(() => {
    void fetchReadings();
  }, [fetchReadings]);

  return {
    readings,
    loading,
    error,
    refetch:
      fetchReadings,
  };
}

/* =========================================================
   PATCH
========================================================= */

export function usePatch() {
  const { user } =
    useAuth();

  const [
    patch,
    setPatch,
  ] =
    useState<PatientPatch | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const fetchPatch =
    useCallback(async () => {
      if (!user) {
        setPatch(null);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result =
          await request<
            PatientPatch | null
          >(
            () =>
              api.get(
                "/api/patch",
              ),
            "Failed to load patch information.",
          );

        setPatch(
          result ?? null,
        );
      } catch (err) {
        console.error(
          "Failed to fetch patch:",
          err,
        );

        setPatch(null);

        setError(
          getErrorMessage(
            err,
            "Failed to load patch information.",
          ),
        );
      } finally {
        setLoading(false);
      }
    }, [user]);

  useEffect(() => {
    void fetchPatch();
  }, [fetchPatch]);

  return {
    patch,
    loading,
    error,
    refetch:
      fetchPatch,
  };
}

/* =========================================================
   CONSULTANTS
========================================================= */

export function useConsultants() {
  const { user } =
    useAuth();

  const [
    consultants,
    setConsultants,
  ] =
    useState<
      ConsultantSummary[]
    >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const fetchConsultants =
    useCallback(async () => {
      if (!user) {
        setConsultants([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result =
          await request<
            ConsultantSummary[]
          >(
            () =>
              api.get(
                "/api/chat/consultants",
              ),
            "Failed to load consultants.",
          );

        setConsultants(
          Array.isArray(result)
            ? result
            : [],
        );
      } catch (err) {
        console.error(
          "Failed to fetch consultants:",
          err,
        );

        setConsultants([]);

        setError(
          getErrorMessage(
            err,
            "Failed to load consultants.",
          ),
        );
      } finally {
        setLoading(false);
      }
    }, [user]);

  useEffect(() => {
    void fetchConsultants();
  }, [fetchConsultants]);

  return {
    consultants,
    loading,
    error,
    refetch:
      fetchConsultants,
  };
}

/* =========================================================
   CONVERSATIONS
========================================================= */

export function useConversations() {
  const { user } =
    useAuth();

  const [
    conversations,
    setConversations,
  ] =
    useState<Conversation[]>(
      [],
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const fetchConversations =
    useCallback(async () => {
      if (!user) {
        setConversations([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result =
          await request<
            Conversation[]
          >(
            () =>
              api.get(
                "/api/chat/conversations",
              ),
            "Failed to load conversations.",
          );

        setConversations(
          Array.isArray(result)
            ? result
            : [],
        );
      } catch (err) {
        console.error(
          "Failed to fetch conversations:",
          err,
        );

        setConversations([]);

        setError(
          getErrorMessage(
            err,
            "Failed to load conversations.",
          ),
        );
      } finally {
        setLoading(false);
      }
    }, [user]);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  return {
    conversations,
    loading,
    error,
    refetch:
      fetchConversations,
  };
}

/* =========================================================
   MESSAGES
========================================================= */

export function useMessages(
  conversationId:
    | string
    | null,
) {
  const { user } =
    useAuth();

  const [
    messages,
    setMessages,
  ] =
    useState<ChatMessage[]>(
      [],
    );

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const fetchMessages =
    useCallback(async () => {
      if (
        !user ||
        !conversationId
      ) {
        setMessages([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result =
          await request<
            ChatMessage[]
          >(
            () =>
              api.get(
                `/api/chat/conversations/${encodeURIComponent(
                  conversationId,
                )}/messages`,
              ),
            "Failed to load messages.",
          );

        setMessages(
          Array.isArray(result)
            ? result
            : [],
        );
      } catch (err) {
        console.error(
          "Failed to fetch messages:",
          err,
        );

        setMessages([]);

        setError(
          getErrorMessage(
            err,
            "Failed to load messages.",
          ),
        );
      } finally {
        setLoading(false);
      }
    }, [
      conversationId,
      user,
    ]);

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  return {
    messages,
    loading,
    error,
    refetch:
      fetchMessages,
  };
}

/* =========================================================
   MESSAGE COUNT
========================================================= */

export function useMessageCount() {
  const { user } =
    useAuth();

  const [
    messageCount,
    setMessageCount,
  ] = useState(0);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const fetchMessageCount =
    useCallback(async () => {
      if (!user) {
        setMessageCount(0);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const conversations =
          await request<
            Conversation[]
          >(
            () =>
              api.get(
                "/api/chat/conversations",
              ),
            "Failed to load conversations for message count.",
          );

        if (
          !Array.isArray(
            conversations,
          ) ||
          conversations.length === 0
        ) {
          setMessageCount(0);
          return;
        }

        const messageGroups =
          await Promise.all(
            conversations.map(
              async (
                conversation,
              ) =>
                request<
                  ChatMessage[]
                >(
                  () =>
                    api.get(
                      `/api/chat/conversations/${encodeURIComponent(
                        conversation.id,
                      )}/messages`,
                    ),
                  "Failed to load conversation messages.",
                ),
            ),
          );

        const total =
          messageGroups.reduce(
            (
              count,
              messages,
            ) =>
              count +
              (
                Array.isArray(
                  messages,
                )
                  ? messages.filter(
                      (
                        msg,
                      ) =>
                        msg.sender_type ===
                        "patient",
                    ).length
                  : 0
              ),
            0,
          );

        setMessageCount(
          total,
        );
      } catch (err) {
        console.error(
          "Failed to fetch message count:",
          err,
        );

        setMessageCount(0);

        setError(
          getErrorMessage(
            err,
            "Failed to load message count.",
          ),
        );
      } finally {
        setLoading(false);
      }
    }, [user]);

  useEffect(() => {
    void fetchMessageCount();
  }, [fetchMessageCount]);

  return {
    messageCount,
    loading,
    error,
    refetch:
      fetchMessageCount,
  };
}

/* =========================================================
   SUBSCRIPTION
========================================================= */

export function useSubscription() {
  const { user } =
    useAuth();

  const [
    subscription,
    setSubscription,
  ] =
    useState<Subscription | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const fetchSubscription =
    useCallback(async () => {
      if (!user) {
        setSubscription(null);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result =
          await request<
            Subscription | null
          >(
            () =>
              api.get(
                "/api/subscription",
              ),
            "Failed to load subscription.",
          );

        setSubscription(
          result ?? null,
        );
      } catch (err) {
        console.error(
          "Failed to fetch subscription:",
          err,
        );

        setSubscription(null);

        setError(
          getErrorMessage(
            err,
            "Failed to load subscription.",
          ),
        );
      } finally {
        setLoading(false);
      }
    }, [user]);

  useEffect(() => {
    void fetchSubscription();
  }, [fetchSubscription]);

  return {
    subscription,
    loading,
    error,
    refetch:
      fetchSubscription,
  };
}

/* =========================================================
   TREND EVENTS
========================================================= */

export function useTrendEvents() {
  const { user } =
    useAuth();

  const [
    events,
    setEvents,
  ] =
    useState<TrendEvent[]>(
      [],
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const fetchEvents =
    useCallback(async () => {
      if (!user) {
        setEvents([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result =
          await request<
            TrendEvent[]
          >(
            () =>
              api.get(
                "/api/trends",
              ),
            "Failed to load trend events.",
          );

        setEvents(
          Array.isArray(result)
            ? result
            : [],
        );
      } catch (err) {
        console.error(
          "Failed to fetch trend events:",
          err,
        );

        setEvents([]);

        setError(
          getErrorMessage(
            err,
            "Failed to load trend events.",
          ),
        );
      } finally {
        setLoading(false);
      }
    }, [user]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  return {
    events,
    loading,
    error,
    refetch:
      fetchEvents,
  };
}

/* =========================================================
   PREDICTIONS
========================================================= */

export function usePredictions() {
  const { user } =
    useAuth();

  const [
    predictions,
    setPredictions,
  ] =
    useState<Prediction[]>(
      [],
    );

  const [
    isPremium,
    setIsPremium,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const fetchPredictions =
    useCallback(async () => {
      if (!user) {
        setPredictions([]);
        setIsPremium(false);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result =
          await request<{
            isPremium?: boolean;
            results?: Prediction[];
          }>(
            () =>
              api.get(
                "/api/predictions",
              ),
            "Failed to load predictions.",
          );

        const allPredictions =
          Array.isArray(
            result?.results,
          )
            ? result.results
            : [];

        const seen =
          new Set<string>();

        const latest: Prediction[] =
          [];

        for (
          const prediction of
            allPredictions
        ) {
          if (
            seen.has(
              prediction.condition,
            )
          ) {
            continue;
          }

          seen.add(
            prediction.condition,
          );

          latest.push(
            prediction,
          );
        }

        setPredictions(
          latest,
        );

        setIsPremium(
          result?.isPremium ===
            true,
        );
      } catch (err) {
        console.error(
          "Failed to fetch predictions:",
          err,
        );

        setPredictions([]);
        setIsPremium(false);

        setError(
          getErrorMessage(
            err,
            "Failed to load predictions.",
          ),
        );
      } finally {
        setLoading(false);
      }
    }, [user]);

  useEffect(() => {
    void fetchPredictions();
  }, [fetchPredictions]);

  return {
    predictions,
    isPremium,
    loading,
    error,
    refetch:
      fetchPredictions,
  };
}

/* =========================================================
   REFERENCE RANGES
========================================================= */

export function useReferenceRanges() {
  const [
    ranges,
    setRanges,
  ] =
    useState<ReferenceRange[]>(
      [],
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const fetchRanges =
    useCallback(async () => {
      setLoading(true);
      setError(null);

      try {
        const result =
          await request<
            ReferenceRange[]
          >(
            () =>
              api.get(
                "/api/readings/reference-ranges",
              ),
            "Failed to load reference ranges.",
          );

        setRanges(
          Array.isArray(result)
            ? result
            : [],
        );
      } catch (err) {
        console.error(
          "Failed to fetch reference ranges:",
          err,
        );

        setRanges([]);

        setError(
          getErrorMessage(
            err,
            "Failed to load reference ranges.",
          ),
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void fetchRanges();
  }, [fetchRanges]);

  return {
    ranges,
    loading,
    error,
    refetch:
      fetchRanges,
  };
}

/* =========================================================
   PREDICTIVE CONSENT
========================================================= */

export function usePredictiveConsent() {
  const { user } =
    useAuth();

  const [
    consented,
    setConsented,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const fetchConsent =
    useCallback(async () => {
      if (!user) {
        setConsented(false);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result =
          await request<{
            status?: string;
          } | null>(
            () =>
              api.get(
                "/api/predictions/consent",
              ),
            "Failed to load predictive consent.",
          );

        setConsented(
          result?.status ===
            "granted",
        );
      } catch (err) {
        console.error(
          "Failed to fetch predictive consent:",
          err,
        );

        setConsented(false);

        setError(
          getErrorMessage(
            err,
            "Failed to load predictive consent.",
          ),
        );
      } finally {
        setLoading(false);
      }
    }, [user]);

  useEffect(() => {
    void fetchConsent();
  }, [fetchConsent]);

  const grantConsent =
    useCallback(async () => {
      if (!user) {
        return {
          success: false,
          error:
            "User is not authenticated.",
        };
      }

      try {
        await request(
          () =>
            api.post(
              "/api/predictions/consent",
            ),
          "Failed to grant predictive consent.",
        );

        setConsented(true);
        setError(null);

        return {
          success: true,
          error: null,
        };
      } catch (err) {
        const message =
          getErrorMessage(
            err,
            "Failed to grant predictive consent.",
          );

        console.error(
          "Failed to grant predictive consent:",
          err,
        );

        setError(message);

        return {
          success: false,
          error: message,
        };
      }
    }, [user]);

  const revokeConsent =
    useCallback(async () => {
      if (!user) {
        return {
          success: false,
          error:
            "User is not authenticated.",
        };
      }

      try {
        await request(
          () =>
            api.delete(
              "/api/predictions/consent",
            ),
          "Failed to revoke predictive consent.",
        );

        setConsented(false);
        setError(null);

        return {
          success: true,
          error: null,
        };
      } catch (err) {
        const message =
          getErrorMessage(
            err,
            "Failed to revoke predictive consent.",
          );

        console.error(
          "Failed to revoke predictive consent:",
          err,
        );

        setError(message);

        return {
          success: false,
          error: message,
        };
      }
    }, [user]);

  return {
    consented,
    loading,
    error,
    grantConsent,
    revokeConsent,
    refetch:
      fetchConsent,
  };
}
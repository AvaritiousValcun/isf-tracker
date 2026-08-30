import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Battery,
  CalendarClock,
  CheckCircle2,
  Clock3,
  HeartPulse,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";

type Profile = {
  user_id?: string;
  full_name?: string | null;
  date_of_birth?: string | null;
  language?: string | null;
  timezone?: string | null;
  patient_reference?: string | null;
};

type Reading = {
  id: string;
  androgen_value: number | string;
  progesterone_value: number | string;
  units?: string | null;
  recorded_at?: string | null;
};

type Patch = {
  id?: string;
  device_identifier?: string | null;
  battery_percent?: number | null;
  connected?: boolean | null;
  status?: string | null;
  last_seen_at?: string | null;
};

type PatchStatus = {
  assignment_id?: string;
  patch_id?: string;
  assignment_status?: string | null;
  assigned_at?: string | null;
  activated_at?: string | null;
  replacement_due_at?: string | null;
  patch?: Patch | null;
};

type SharePayload = {
  patient_user_id?: string;
  scope_granted?: Record<string, boolean>;
  expires_at: string;
  profile?: Profile | null;
  latest_readings?: Reading[];
  readings?: Reading[];
  patch_status?: PatchStatus | null;
};

type LoadingState = "loading" | "success" | "error";

function formatDate(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return number.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

function isExpired(expiresAt: string) {
  const timestamp = new Date(expiresAt).getTime();

  return !Number.isFinite(timestamp) || timestamp <= Date.now();
}

function getRemainingTime(expiresAt: string) {
  const difference =
    new Date(expiresAt).getTime() - Date.now();

  if (!Number.isFinite(difference) || difference <= 0) {
    return "Expired";
  }

  const totalMinutes = Math.floor(
    difference / (1000 * 60),
  );

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }

  return `${minutes}m remaining`;
}

export default function EmergencyAccessPage() {
  const { token } = useParams<{ token: string }>();

  const [state, setState] =
    useState<LoadingState>("loading");

  const [payload, setPayload] =
    useState<SharePayload | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [now, setNow] =
    useState(() => Date.now());

  const apiBase =
    import.meta.env.VITE_API_URL || "";

  const endpoint = useMemo(() => {
    if (!token) {
      return null;
    }

    return (
      `${apiBase}/api/share/resolve/` +
      encodeURIComponent(token)
    );
  }, [apiBase, token]);

  const loadAccess = async () => {
    if (!endpoint) {
      setState("error");
      setError(
        "No temporary access token was provided.",
      );
      return;
    }

    setState("loading");
    setError(null);

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "This temporary access link is invalid or unavailable.",
        );
      }

      if (
        !data ||
        typeof data.expires_at !== "string"
      ) {
        throw new Error(
          "The temporary access response is invalid.",
        );
      }

      if (isExpired(data.expires_at)) {
        throw new Error(
          "This temporary access link has expired.",
        );
      }

      setPayload(data);
      setState("success");
    } catch (requestError) {
      setPayload(null);
      setState("error");

      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to access the shared health information.",
      );
    }
  };

  useEffect(() => {
    void loadAccess();
  }, [endpoint]);

  useEffect(() => {
    if (!payload?.expires_at) {
      return;
    }

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 30_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [payload?.expires_at]);

  const expired =
    payload?.expires_at
      ? new Date(payload.expires_at).getTime() <= now
      : false;

  const scope =
    payload?.scope_granted || {};

  const latestReading =
    payload?.latest_readings?.[0] ||
    payload?.readings?.[0] ||
    null;

  const hasProfile =
    scope.profile === true ||
    scope.patient_profile === true;

  const hasCurrentReadings =
    scope.current_readings === true ||
    scope.readings === true ||
    scope.readings_latest === true;

  const hasHistoricalReadings =
    scope.historical_readings === true ||
    scope.readings_history === true;

  const hasPatchStatus =
    scope.patch_status === true;

  return (
    <main className="min-h-screen bg-[#F5F7F8] px-4 py-8 text-[#2C4C5C] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1050px]">
        <header className="mb-6 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2C4C5C] text-white">
                <HeartPulse size={23} />
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  ISF Tracker
                </p>

                <h1 className="mt-1 font-display text-[23px] font-semibold tracking-[-0.04em]">
                  Temporary Health Access
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-[#2C4C5C]/10 bg-[#2C4C5C]/[0.04] px-3 py-2">
              <ShieldCheck
                size={16}
                className="text-[#2C4C5C]"
              />

              <span className="text-[11px] font-semibold">
                Time-limited access
              </span>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="flex gap-2">
              <AlertTriangle
                size={16}
                className="mt-0.5 shrink-0 text-amber-700"
              />

              <p className="text-[11px] leading-relaxed text-amber-900">
                This page provides only the information
                authorized by the patient through a
                temporary ISF Tracker access session.
                Do not copy, retain, or share information
                beyond what is necessary for patient care.
              </p>
            </div>
          </div>
        </header>

        {state === "loading" && (
          <section className="rounded-[24px] border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#2C4C5C]/10">
              <RefreshCw
                size={20}
                className="animate-spin text-[#2C4C5C]"
              />
            </div>

            <h2 className="mt-4 text-[16px] font-semibold">
              Verifying temporary access
            </h2>

            <p className="mt-2 text-[12px] text-slate-500">
              Please wait while ISF Tracker verifies
              the access token.
            </p>
          </section>
        )}

        {state === "error" && (
          <section className="rounded-[24px] border border-red-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <XCircle
                size={22}
                className="text-red-600"
              />
            </div>

            <h2 className="mt-4 text-[18px] font-semibold text-[#2C4C5C]">
              Access unavailable
            </h2>

            <p className="mx-auto mt-2 max-w-[500px] text-[12px] leading-relaxed text-slate-500">
              {error ||
                "The requested temporary health information could not be accessed."}
            </p>

            <button
              type="button"
              onClick={() => void loadAccess()}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#2C4C5C] px-4 py-2.5 text-[11px] font-bold text-white"
            >
              <RefreshCw size={14} />
              Try again
            </button>
          </section>
        )}

        {state === "success" &&
          payload &&
          !expired && (
            <div className="space-y-5">
              <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                      Authorized patient
                    </p>

                    <h2 className="mt-1 text-[20px] font-semibold">
                      {hasProfile &&
                      payload.profile?.full_name
                        ? payload.profile.full_name
                        : "Patient information"}
                    </h2>
                  </div>

                  <div className="rounded-xl border border-[#2C4C5C]/10 bg-[#2C4C5C]/[0.04] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Clock3 size={14} />

                      <div>
                        <p className="text-[9px] uppercase tracking-[0.12em] text-slate-500">
                          Access expires
                        </p>

                        <p className="mt-0.5 text-[11px] font-semibold">
                          {formatDate(
                            payload.expires_at,
                          )}
                        </p>

                        <p className="mt-0.5 text-[10px] text-slate-500">
                          {getRemainingTime(
                            payload.expires_at,
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {hasProfile && (
                <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                  <div className="mb-5 flex items-center gap-2">
                    <UserRound size={17} />

                    <h2 className="text-[15px] font-semibold">
                      Patient profile
                    </h2>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoCard
                      label="Full name"
                      value={
                        payload.profile
                          ?.full_name ||
                        "Not provided"
                      }
                    />

                    <InfoCard
                      label="Patient reference"
                      value={
                        payload.profile
                          ?.patient_reference ||
                        "Not provided"
                      }
                    />

                    <InfoCard
                      label="Date of birth"
                      value={
                        payload.profile
                          ?.date_of_birth ||
                        "Not provided"
                      }
                    />

                    <InfoCard
                      label="Timezone"
                      value={
                        payload.profile
                          ?.timezone ||
                        "Not provided"
                      }
                    />
                  </div>
                </section>
              )}

              {hasCurrentReadings &&
                latestReading && (
                  <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Activity size={17} />

                        <h2 className="text-[15px] font-semibold">
                          Latest hormone readings
                        </h2>
                      </div>

                      <span className="text-[10px] text-slate-500">
                        {formatDate(
                          latestReading.recorded_at,
                        )}
                      </span>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <MetricCard
                        label="Androgen"
                        value={formatNumber(
                          latestReading.androgen_value,
                        )}
                        unit={
                          latestReading.units ||
                          "configured unit"
                        }
                      />

                      <MetricCard
                        label="Progesterone"
                        value={formatNumber(
                          latestReading.progesterone_value,
                        )}
                        unit={
                          latestReading.units ||
                          "configured unit"
                        }
                      />
                    </div>
                  </section>
                )}

              {hasHistoricalReadings &&
                payload.readings &&
                payload.readings.length > 0 && (
                  <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                    <div className="mb-5 flex items-center gap-2">
                      <CalendarClock size={17} />

                      <h2 className="text-[15px] font-semibold">
                        Recent readings
                      </h2>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[600px] text-left">
                        <thead>
                          <tr className="border-b border-slate-200 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                            <th className="px-3 py-3">
                              Date
                            </th>

                            <th className="px-3 py-3">
                              Androgen
                            </th>

                            <th className="px-3 py-3">
                              Progesterone
                            </th>

                            <th className="px-3 py-3">
                              Units
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {payload.readings.map(
                            (reading) => (
                              <tr
                                key={reading.id}
                                className="border-b border-slate-100 last:border-0"
                              >
                                <td className="px-3 py-3 text-[11px] text-slate-600">
                                  {formatDate(
                                    reading.recorded_at,
                                  )}
                                </td>

                                <td className="px-3 py-3 text-[11px] font-semibold">
                                  {formatNumber(
                                    reading.androgen_value,
                                  )}
                                </td>

                                <td className="px-3 py-3 text-[11px] font-semibold">
                                  {formatNumber(
                                    reading.progesterone_value,
                                  )}
                                </td>

                                <td className="px-3 py-3 text-[11px] text-slate-500">
                                  {reading.units ||
                                    "—"}
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

              {hasPatchStatus &&
                payload.patch_status && (
                  <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                    <div className="mb-5 flex items-center gap-2">
                      <Battery size={17} />

                      <h2 className="text-[15px] font-semibold">
                        Patch status
                      </h2>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <InfoCard
                        label="Connection"
                        value={
                          payload.patch_status.patch
                            ?.connected
                            ? "Connected"
                            : "Not connected"
                        }
                      />

                      <InfoCard
                        label="Battery"
                        value={
                          payload.patch_status.patch
                            ?.battery_percent !==
                          null &&
                          payload.patch_status.patch
                            ?.battery_percent !==
                          undefined
                            ? `${payload.patch_status.patch.battery_percent}%`
                            : "Not available"
                        }
                      />

                      <InfoCard
                        label="Patch status"
                        value={
                          payload.patch_status.patch
                            ?.status ||
                          payload.patch_status
                            .assignment_status ||
                          "Not available"
                        }
                      />

                      <InfoCard
                        label="Replacement due"
                        value={formatDate(
                          payload.patch_status
                            .replacement_due_at,
                        )}
                      />
                    </div>
                  </section>
                )}

              <section className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex gap-3">
                  <CheckCircle2
                    size={18}
                    className="mt-0.5 shrink-0 text-emerald-700"
                  />

                  <div>
                    <p className="text-[12px] font-semibold text-emerald-900">
                      Temporary access is active
                    </p>

                    <p className="mt-1 text-[11px] leading-relaxed text-emerald-800">
                      Access is limited to the data scopes
                      authorized by the patient and will
                      automatically expire at the time shown
                      above.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          )}

        {state === "success" &&
          payload &&
          expired && (
            <section className="rounded-[24px] border border-red-200 bg-white p-8 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                <LockKeyhole
                  size={21}
                  className="text-red-600"
                />
              </div>

              <h2 className="mt-4 text-[18px] font-semibold">
                Access has expired
              </h2>

              <p className="mx-auto mt-2 max-w-[500px] text-[12px] leading-relaxed text-slate-500">
                This temporary ISF Tracker access session
                has expired. Ask the patient to generate a
                new QR code if access is still required.
              </p>
            </section>
          )}
      </div>
    </main>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-[#F8FAFA] p-4">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>

      <p className="mt-1.5 break-words text-[12px] font-semibold text-[#2C4C5C]">
        {value}
      </p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-[#F8FAFA] p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-[28px] font-semibold tracking-[-0.04em]">
          {value}
        </span>

        <span className="text-[10px] text-slate-500">
          {unit}
        </span>
      </div>
    </div>
  );
}
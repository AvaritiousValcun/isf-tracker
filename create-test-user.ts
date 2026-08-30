import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const email = "patient.test@isftracker.com";
const password = "ISFtest2026!Secure";
const fullName = "Test Patient";

async function main() {
  console.log("Creating Auth user...");

  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

  if (authError) {
    console.error("Auth user creation failed:", authError);
    process.exit(1);
  }

  if (!authData.user) {
    console.error("No Auth user was returned.");
    process.exit(1);
  }

  const userId = authData.user.id;

  console.log("Auth user created:");
  console.log("UUID:", userId);
  console.log("Email:", email);

  const { error: patientError } = await supabase
    .from("patient_profiles")
    .insert({
      user_id: userId,
      full_name: fullName,
      language: "en",
      timezone: "Africa/Nairobi",
      patient_reference: `ISF-TEST-${userId.slice(0, 8).toUpperCase()}`,
    });

  if (patientError) {
    console.error("Patient profile creation failed:", patientError);
    process.exit(1);
  }

  console.log("Patient profile created.");

  const { data: patch, error: patchError } = await supabase
    .from("patches")
    .insert({
      serial_number: `ISF-TEST-${userId.slice(0, 8).toUpperCase()}`,
      model: "ISF-MN-001",
      firmware_version: "1.0.0",
      status: "active",
    })
    .select("id")
    .single();

  if (patchError) {
    console.error("Patch creation failed:", patchError);
    process.exit(1);
  }

  console.log("Patch created:", patch.id);

  const now = new Date();
  const wearStart = new Date(
    now.getTime() - 6 * 24 * 60 * 60 * 1000
  );

  const replacementDue = new Date(
    wearStart.getTime() + 14 * 24 * 60 * 60 * 1000
  );

  const { error: patientPatchError } = await supabase
    .from("patient_patches")
    .insert({
      patient_user_id: userId,
      patch_id: patch.id,
      wear_started_at: wearStart.toISOString(),
      replacement_due_at: replacementDue.toISOString(),
      replacement_window_start_at:
        new Date(
          replacementDue.getTime() -
            2 * 24 * 60 * 60 * 1000
        ).toISOString(),
      replacement_window_end_at:
        new Date(
          replacementDue.getTime() +
            2 * 24 * 60 * 60 * 1000
        ).toISOString(),
      status: "active",
      battery_percent: 78,
      connected: true,
      last_synced_at: now.toISOString(),
    });

  if (patientPatchError) {
    console.error(
      "Patient patch creation failed:",
      patientPatchError
    );
    process.exit(1);
  }

  console.log("Patch assigned to patient.");

  const readings = [];

  let androgen = 42;
  let progesterone = 28;

  for (let i = 13; i >= 0; i--) {
    androgen = Math.max(
      20,
      Math.min(
        70,
        androgen + (Math.random() - 0.45) * 8
      )
    );

    progesterone = Math.max(
      5,
      Math.min(
        60,
        progesterone + (Math.random() - 0.5) * 6
      )
    );

    const recordedAt = new Date(
      now.getTime() -
        i * 12 * 60 * 60 * 1000
    );

    readings.push({
      patient_user_id: userId,
      patch_id: patch.id,
      recorded_at: recordedAt.toISOString(),
      androgen_value: Number(androgen.toFixed(1)),
      androgen_unit: "ng/dL",
      progesterone_value: Number(
        progesterone.toFixed(1)
      ),
      progesterone_unit: "ng/mL",
      quality_status: "valid",
      sequence_number: 14 - i,
      firmware_version: "1.0.0",
      battery_percent: Math.max(
        30,
        78 - (14 - i) * 2
      ),
    });
  }

  const { error: readingsError } =
    await supabase
      .from("hormone_readings")
      .insert(readings);

  if (readingsError) {
    console.error(
      "Hormone readings creation failed:",
      readingsError
    );
    process.exit(1);
  }

  console.log("14 hormone readings created.");

  const { data: consultants, error: consultantError } =
    await supabase
      .from("consultants")
      .select("id")
      .eq("status", "active")
      .order("created_at", {
        ascending: true,
      })
      .limit(2);

  if (consultantError) {
    console.error(
      "Consultant lookup failed:",
      consultantError
    );
    process.exit(1);
  }

  if (consultants && consultants.length > 0) {
    const relationships = consultants.map(
      (consultant) => ({
        patient_user_id: userId,
        consultant_id: consultant.id,
        status: "active",
        started_at: now.toISOString(),
      })
    );

    const { error: relationshipError } =
      await supabase
        .from("patient_consultants")
        .insert(relationships);

    if (relationshipError) {
      console.error(
        "Consultant assignment failed:",
        relationshipError
      );
      process.exit(1);
    }

    console.log(
      `${consultants.length} consultants assigned.`
    );
  } else {
    console.log(
      "No active consultants found. Patient created without consultant assignment."
    );
  }

  const { error: subscriptionError } =
    await supabase
      .from("subscriptions")
      .insert({
        patient_user_id: userId,
        plan: "free",
        status: "free",
      });

  if (subscriptionError) {
    console.error(
      "Subscription creation failed:",
      subscriptionError
    );
    process.exit(1);
  }

  console.log("Subscription created.");

  const { error: predictionError } =
    await supabase.rpc("generate_predictions");

  if (predictionError) {
    console.warn(
      "Prediction generation failed:",
      predictionError
    );
    console.warn(
      "This does not invalidate the patient account."
    );
  } else {
    console.log("Predictions generated.");
  }

  console.log("");
  console.log("=================================");
  console.log("REAL TEST USER CREATED");
  console.log("=================================");
  console.log(`Email:    ${email}`);
  console.log(`Password: ${password}`);
  console.log(`User ID:  ${userId}`);
  console.log("=================================");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

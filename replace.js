const fs = require('fs');
const content = fs.readFileSync('client/hooks/useAuth.tsx', 'utf8');

const regex = /const \{\s*error: profileError,\s*\}\s*=\s*await supabase\s*\.from\("patient_profiles"\)\s*\.insert\(\{\s*user_id:\s*data\.user\.id,\s*full_name:\s*fullName,\s*language: "en",\s*timezone:\s*"Africa\/Nairobi",\s*\}\);\s*if \(profileError\) \{\s*console\.error\(\s*"Patient profile creation failed:",\s*profileError,\s*\);\s*return \{\s*error:\s*profileError\.message,\s*\};\s*\}/g;

const replacement = \
        if (data.session) {
          const { error: profileError } = await supabase.from("patient_profiles").insert({
            user_id: data.user.id,
            full_name: fullName,
            language: "en",
            timezone: "Africa/Nairobi",
          });
          if (profileError && profileError.code !== "23505") { // Ignore unique constraint if trigger already did it
            console.error("Patient profile creation failed:", profileError);
          }
        }
\;

const newContent = content.replace(regex, replacement);
fs.writeFileSync('client/hooks/useAuth.tsx', newContent);

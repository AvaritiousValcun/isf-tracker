-- Ensure Dr. Grace Wanjiku (Gynecologist) is registered in public.consultants
INSERT INTO public.consultants (
    id,
    full_name,
    professional_type,
    license_reference,
    organization,
    status,
    initials,
    color,
    online
)
VALUES (
    'c8e23456-789a-4bcd-ef01-23456789abcd',
    'Dr. Grace Wanjiku',
    'Gynecologist',
    'KMPDC-GYN-0982',
    'Aga Khan University Hospital, Nairobi',
    'active',
    'GW',
    '#E06D53',
    true
)
ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    professional_type = EXCLUDED.professional_type,
    status = EXCLUDED.status,
    initials = EXCLUDED.initials,
    color = EXCLUDED.color,
    online = EXCLUDED.online;

-- Connect Dr. Grace Wanjiku to any existing patient profiles in patient_consultants
INSERT INTO public.patient_consultants (
    patient_user_id,
    consultant_id,
    status,
    started_at
)
SELECT 
    pp.user_id,
    'c8e23456-789a-4bcd-ef01-23456789abcd',
    'active',
    now()
FROM public.patient_profiles pp
WHERE NOT EXISTS (
    SELECT 1 FROM public.patient_consultants pc
    WHERE pc.patient_user_id = pp.user_id
      AND pc.consultant_id = 'c8e23456-789a-4bcd-ef01-23456789abcd'
);

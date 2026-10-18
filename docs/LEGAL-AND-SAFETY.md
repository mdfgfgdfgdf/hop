# Legal, regulatory and safety posture (pilot)

This is engineering documentation, **not legal advice**. Before any commercial launch, the business must
confirm licensing, insurance and data-protection requirements with counsel and the relevant authorities
(Ministry of Transport, insurers, the Privacy Protection Authority).

## What the product enforces today
1. **Only lawful service types are enabled.** `service_types.legalStatus` must be `approved` for a type to
   be enabled or quoted. The seeded types are licensed taxi services (`taxi`, `taxi_xl`, `premium`,
   `accessible`). `rideshare` (private cars) exists in the catalogue but is **disabled** and marked
   `requires_regulatory_approval`; the admin UI cannot enable it until that status is changed deliberately.
2. **Driver verification before any ride.** A driver must upload ID, driving licence, a permit to carry
   paying passengers (היתר להסעת נוסעים בשכר), the taxi licence (מספר ירוק), vehicle registration and
   insurance. Staff approve each document; the driver can be approved only when all required documents are
   approved. Only approved drivers can go online or receive offers. Changing the vehicle plate after approval
   sends the driver back to review.
3. **Service areas.** Pickups are accepted only inside active service areas (seeded: Gush Dan pilot polygon).
4. **Consent records.** Signup stores versioned consent rows for the terms and the privacy policy with IP.
5. **Suspension & audit.** Staff can suspend users/drivers (sessions revoked, driver forced offline); every
   privileged action is written to `audit_logs`.
6. **Safety reporting.** Riders and drivers can open safety/incident tickets (auto-prioritised urgent) from
   an active or past ride; operators work them in the dashboard.
7. **Data minimisation in the UI.** Counterpart phone numbers are masked; location is shared with the rider
   only while a driver is assigned to their ride; documents are visible to the owner and staff only.

## What is intentionally *not* done yet
- No real payments or card storage (`card_demo` is a labelled placeholder). Integrate a PCI-compliant PSP
  (e.g. a tokenised card flow) before charging anyone.
- No SMS/phone verification (email + password only). Add OTP before launch.
- No automated document validation; approval is manual.
- No background checks / criminal-record integration (manual process to be defined).
- Terms and privacy texts are drafts for legal review.
- Data retention / deletion is handled through support tickets, not automated.

## Pilot checklist (business)
- Confirm the operating model (licensed taxi dispatch vs. anything else) and insurance coverage per ride.
- Confirm tariff rules (official taxi tariffs vs. agreed upfront pricing) and update the active tariff
  with `isDemo = false` only after approval.
- Register the database and privacy practices as required; appoint a data-protection contact.
- Define the incident-response process for safety tickets (who, SLA, escalation).

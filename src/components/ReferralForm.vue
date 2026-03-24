<template>
  <div class="referral-form-container card">
    <h1>Mitarbeiter-Empfehlung</h1>
    <p class="lead">
      Empfiehl Kandidat:innen für Pflegestellen. Pflichtfelder sind mit * markiert.
    </p>

    <form @submit.prevent="submitReferral" class="form">
      <div class="form-group">
        <label for="name">Name der geworbenen Person *</label>
        <input
          v-model="form.candidate_name"
          id="name"
          type="text"
          required
          autocomplete="name"
          placeholder="Vor- und Nachname"
        />
      </div>

      <div class="form-group">
        <label for="phone">Telefonnummer *</label>
        <input
          v-model="form.phone"
          id="phone"
          type="tel"
          required
          autocomplete="tel"
          placeholder="+49 …"
        />
      </div>

      <div class="form-group">
        <label for="email">E-Mail (optional)</label>
        <input
          v-model="form.email"
          id="email"
          type="email"
          autocomplete="email"
          placeholder="kandidat@example.com"
        />
      </div>

      <div class="form-group">
        <label for="qualification">Qualifikation *</label>
        <select id="qualification" v-model="form.qualification" required>
          <option value="" disabled>Bitte auswählen</option>
          <option value="Pflegefachkraft">Pflegefachkraft</option>
          <option value="Pflegehelfer">Pflegehelfer</option>
          <option value="Intensivpflege">Intensivpflege</option>
          <option value="Sonstige">Sonstige</option>
        </select>
      </div>

      <div class="form-group">
        <p class="nps-label">NPS: Wie wahrscheinlich empfiehlst du Pflegeunion weiter? *</p>
        <div class="nps-scale" role="radiogroup" aria-label="NPS 0 bis 10">
          <template v-for="n in npsOptions" :key="n">
            <input
              :id="`nps-${n}`"
              v-model="form.nps_score"
              type="radio"
              name="nps"
              :value="n"
              required
            />
            <label :for="`nps-${n}`">{{ n }}</label>
          </template>
        </div>
        <div class="nps-legend">
          <span>Unwahrscheinlich</span>
          <span>Sehr wahrscheinlich</span>
        </div>
      </div>

      <div class="form-group">
        <label for="feedback">Feedback (optional)</label>
        <textarea
          v-model="form.feedback"
          id="feedback"
          rows="4"
          placeholder="Was können wir verbessern?"
        />
      </div>

      <div class="form-group">
        <label for="referral_code">Referral-Code (optional, z. B. aus Link ?ref=)</label>
        <input
          v-model="form.referral_code"
          id="referral_code"
          type="text"
          placeholder="wird aus der URL übernommen, falls vorhanden"
        />
      </div>

      <div class="disclaimer">
        <strong>Einwilligung zur Datenverarbeitung</strong><br />
        Mit der Nutzung dieser Website und der Übermittlung von Daten erklären Sie sich mit der
        Verarbeitung Ihrer personenbezogenen Daten zum Zweck der Bearbeitung Ihrer Anfrage bzw. der
        Nutzung der angebotenen Funktionen einverstanden.<br />
        Bitte tragen Sie ausschließlich Daten von Personen ein, die zuvor ausdrücklich in die
        Übermittlung und Verarbeitung ihrer Daten eingewilligt haben.<br />
        Die Verarbeitung erfolgt ausschließlich im Rahmen der geltenden datenschutzrechtlichen
        Bestimmungen.
      </div>

      <button type="submit" :disabled="isLoading" class="btn-submit">
        {{ isLoading ? 'Wird gesendet…' : 'Absenden' }}
      </button>

      <div v-if="successMessage" class="success-message">
        {{ successMessage }}
      </div>
      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
    </form>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { createClient } from '@supabase/supabase-js'

const npsOptions = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

const form = ref({
  candidate_name: '',
  phone: '',
  email: '',
  qualification: '',
  nps_score: '',
  feedback: '',
  referral_code: '',
})

const isLoading = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  const refParam = params.get('ref')
  if (refParam) {
    form.value.referral_code = String(refParam).trim()
  }
})

const getRefFromUrl = () => {
  const params = new URLSearchParams(window.location.search)
  const refParam = params.get('ref')
  return refParam ? String(refParam).trim() : ''
}

const submitReferral = async () => {
  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  if (!supabase) {
    errorMessage.value =
      'Supabase ist nicht konfiguriert. Lege .env.local mit VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY an.'
    isLoading.value = false
    return
  }

  const referralFromUrl = getRefFromUrl()
  const referralCode =
    String(form.value.referral_code || '').trim() || referralFromUrl || null

  try {
    const payload = {
      candidate_name: String(form.value.candidate_name).trim(),
      phone: String(form.value.phone).trim(),
      email: String(form.value.email).trim() || null,
      qualification: String(form.value.qualification).trim() || null,
      nps_score:
        form.value.nps_score === '' || form.value.nps_score === null
          ? null
          : Number(form.value.nps_score),
      feedback: String(form.value.feedback).trim() || null,
      referral_code: referralCode,
    }

    const { error } = await supabase.from('referral_submissions').insert([payload])

    if (error) {
      throw error
    }

    try {
      await fetch(`${supabaseUrl}/functions/v1/send-referral-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          candidate_name: payload.candidate_name,
          email: payload.email,
          qualification: payload.qualification,
          nps_score: payload.nps_score,
          phone: payload.phone,
          referral_code: payload.referral_code,
        }),
      })
    } catch {
      /* E-Mail-Funktion optional */
    }

    successMessage.value =
      'Danke! Deine Empfehlung wurde gespeichert. Wir melden uns bei Bedarf.'

    form.value = {
      candidate_name: '',
      phone: '',
      email: '',
      qualification: '',
      nps_score: '',
      feedback: '',
      referral_code: referralFromUrl || '',
    }
  } catch (err) {
    errorMessage.value = `Fehler: ${err?.message || 'Unbekannter Fehler'}`
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.card {
  background: #fff;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  padding: 1.75rem;
  box-shadow: 0 10px 35px rgba(0, 0, 0, 0.05);
}

h1 {
  margin: 0 0 0.5rem;
  font-size: clamp(1.5rem, 4vw, 2rem);
  color: #111827;
}

.lead {
  margin: 0 0 1.25rem;
  color: #6b7280;
  line-height: 1.5;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form-group {
  margin-bottom: 1rem;
}

label,
.nps-label {
  display: block;
  margin-bottom: 0.45rem;
  font-weight: 600;
  color: #374151;
  font-size: 0.95rem;
}

select,
input,
textarea {
  width: 100%;
  padding: 0.7rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  font-size: 1rem;
  font-family: inherit;
  box-sizing: border-box;
  background: #fff;
  color: #111827;
  color-scheme: light;
}

select:focus,
input:focus,
textarea:focus {
  outline: none;
  border-color: #14b8a6;
  box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.18);
}

.nps-scale {
  display: grid;
  grid-template-columns: repeat(11, minmax(24px, 1fr));
  gap: 6px;
}

.nps-scale input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.nps-scale label {
  margin: 0;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  text-align: center;
  padding: 0.55rem 0;
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 500;
}

.nps-scale input:checked + label {
  background: #ccfbf1;
  border-color: #14b8a6;
  color: #0f766e;
  font-weight: 700;
}

.nps-legend {
  display: flex;
  justify-content: space-between;
  color: #6b7280;
  font-size: 0.8rem;
  margin-top: 0.35rem;
}

.disclaimer {
  font-size: 0.82rem;
  color: #6b7280;
  line-height: 1.55;
  padding: 0.75rem 1rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.btn-submit {
  margin-top: 0.5rem;
  width: 100%;
  padding: 0.85rem;
  background: #0f766e;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-submit:hover:not(:disabled) {
  background: #0d5f59;
}

.btn-submit:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.success-message {
  margin-top: 1rem;
  padding: 0.85rem;
  background: #d1fae5;
  color: #065f46;
  border-radius: 10px;
}

.error-message {
  margin-top: 1rem;
  padding: 0.85rem;
  background: #fee2e2;
  color: #991b1b;
  border-radius: 10px;
}

@media (max-width: 640px) {
  .nps-scale {
    gap: 4px;
  }
}
</style>

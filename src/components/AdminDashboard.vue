<template>
  <div class="admin-dashboard card">
    <h1>Admin: Empfehlungen</h1>
    <p class="lead">
      Lade Einträge mit deiner Admin-PIN. Löschen und CSV-Export nutzen dieselbe PIN.
    </p>

    <div class="admin-controls">
      <input
        v-model="adminPin"
        type="password"
        autocomplete="current-password"
        placeholder="Admin-PIN"
        @keyup.enter="loadSubmissions"
      />
      <button type="button" @click="loadSubmissions" :disabled="isLoading">
        {{ isLoading ? 'Lade…' : 'Einträge laden' }}
      </button>
      <button
        type="button"
        class="btn-export"
        @click="exportCSV"
        :disabled="!submissions.length"
      >
        CSV exportieren
      </button>
    </div>

    <p class="hint">
      Die Edge Function <code>get-submissions</code> muss die PIN prüfen (z. B. Secret
      <code>ADMIN_PIN</code>). Beim Aufruf wird hier <code>Authorization: Bearer &lt;PIN&gt;</code>
      gesendet, wie in deiner Anleitung.
    </p>

    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <div v-if="submissions.length > 0" class="submissions-table">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Telefon</th>
            <th>E-Mail</th>
            <th>Qualifikation</th>
            <th>NPS</th>
            <th>Feedback</th>
            <th>Ref</th>
            <th>Eingang</th>
            <th>Aktion</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="submission in submissions" :key="submission.id">
            <td>{{ submission.candidate_name }}</td>
            <td>{{ submission.phone }}</td>
            <td>{{ submission.email || '–' }}</td>
            <td>{{ submission.qualification || '–' }}</td>
            <td>
              {{ submission.nps_score ?? '–' }}
              <span v-if="submission.nps_score != null">/10</span>
            </td>
            <td class="feedback">{{ submission.feedback || '–' }}</td>
            <td>{{ submission.referral_code || '–' }}</td>
            <td>{{ formatDate(submission.created_at) }}</td>
            <td>
              <button
                type="button"
                @click="deleteSubmission(submission.id)"
                class="btn-delete"
                :disabled="isDeleting"
              >
                Löschen
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="submissions.length === 0 && !isLoading && hasLoaded" class="empty-state">
      <p>Keine Einträge gefunden.</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const adminPin = ref('')
const submissions = ref([])
const isLoading = ref(false)
const isDeleting = ref(false)
const errorMessage = ref('')
const hasLoaded = ref(false)

const apiUrl = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const loadSubmissions = async () => {
  if (!apiUrl) {
    errorMessage.value =
      'VITE_SUPABASE_URL fehlt. Lege .env.local mit Supabase-URL und Anon-Key an.'
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  hasLoaded.value = true

  try {
    const response = await fetch(
      `${apiUrl}/functions/v1/get-submissions?action=list`,
      {
        headers: {
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
          'X-Admin-Pin': adminPin.value,
        },
      },
    )

    if (!response.ok) {
      throw new Error(
        response.status === 401 || response.status === 403
          ? 'Nicht autorisiert – falsche PIN oder Function nicht erreichbar.'
          : `Anfrage fehlgeschlagen (${response.status})`,
      )
    }

    const data = await response.json()
    submissions.value = Array.isArray(data) ? data : []
  } catch (err) {
    errorMessage.value = err?.message || 'Laden fehlgeschlagen.'
  } finally {
    isLoading.value = false
  }
}

const deleteSubmission = async (id) => {
  if (!confirm('Diesen Eintrag wirklich löschen?')) {
    return
  }

  isDeleting.value = true

  try {
    const response = await fetch(
      `${apiUrl}/functions/v1/get-submissions?action=delete`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
          apikey: anonKey,
          'X-Admin-Pin': adminPin.value,
        },
        body: JSON.stringify({ id }),
      },
    )

    if (!response.ok) {
      throw new Error('Löschen fehlgeschlagen.')
    }

    submissions.value = submissions.value.filter((s) => s.id !== id)
  } catch (err) {
    errorMessage.value = err?.message || 'Löschen fehlgeschlagen.'
  } finally {
    isDeleting.value = false
  }
}

const escapeCsv = (value) => {
  const s = value == null ? '' : String(value)
  return `"${s.replace(/"/g, '""')}"`
}

const exportCSV = () => {
  if (!submissions.value.length) {
    return
  }

  const headers = [
    'id',
    'created_at',
    'candidate_name',
    'phone',
    'email',
    'qualification',
    'nps_score',
    'feedback',
    'referral_code',
  ]

  const lines = [headers.join(',')]
  for (const row of submissions.value) {
    lines.push(
      [
        escapeCsv(row.id),
        escapeCsv(row.created_at),
        escapeCsv(row.candidate_name),
        escapeCsv(row.phone),
        escapeCsv(row.email),
        escapeCsv(row.qualification),
        escapeCsv(row.nps_score),
        escapeCsv(row.feedback),
        escapeCsv(row.referral_code),
      ].join(','),
    )
  }

  const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `empfehlungen-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  window.URL.revokeObjectURL(url)
}

const formatDate = (dateString) => {
  if (!dateString) {
    return '–'
  }
  return new Date(dateString).toLocaleString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
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
  margin: 0 0 0.35rem;
  font-size: clamp(1.35rem, 3vw, 1.75rem);
  color: #111827;
}

.lead {
  margin: 0 0 1rem;
  color: #6b7280;
  line-height: 1.5;
}

.hint {
  font-size: 0.85rem;
  color: #6b7280;
  margin: 0 0 1rem;
  line-height: 1.45;
}

.admin-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.admin-controls input {
  flex: 1 1 200px;
  padding: 0.7rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  font-size: 1rem;
}

.admin-controls button {
  padding: 0.7rem 1.1rem;
  background: #0f766e;
  color: #fff;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
}

.admin-controls button:hover:not(:disabled) {
  background: #0d5f59;
}

.admin-controls button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.btn-export {
  background: #2563eb !important;
}

.btn-export:hover:not(:disabled) {
  background: #1d4ed8 !important;
}

.submissions-table {
  overflow-x: auto;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  min-width: 900px;
}

th {
  background: #f9fafb;
  padding: 0.75rem;
  text-align: left;
  font-weight: 600;
  border-bottom: 2px solid #e5e7eb;
  white-space: nowrap;
}

td {
  padding: 0.75rem;
  border-bottom: 1px solid #e5e7eb;
  vertical-align: top;
  font-size: 0.9rem;
}

td.feedback {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-delete {
  padding: 0.45rem 0.75rem;
  background: #b91c1c;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-delete:hover:not(:disabled) {
  background: #991b1b;
}

.error-message {
  padding: 0.85rem;
  background: #fee2e2;
  color: #991b1b;
  border-radius: 10px;
  margin-bottom: 1rem;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: #9ca3af;
  background: #f9fafb;
  border-radius: 12px;
}
</style>

<script setup>
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app-shell">
    <header class="top-bar">
      <RouterLink class="brand" to="/">Pflegeunion Empfehlung</RouterLink>
      <nav>
        <RouterLink to="/">Formular</RouterLink>
        <RouterLink to="/admin">Admin</RouterLink>
      </nav>
    </header>
    <RouterView />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  background: linear-gradient(180deg, #eafaf8 0%, #f5f7fb 28%);
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
}

.brand {
  font-weight: 700;
  color: #0f766e;
  text-decoration: none;
}

nav {
  display: flex;
  gap: 1rem;
}

nav a {
  color: #111827;
  text-decoration: none;
  font-weight: 500;
}

nav a.router-link-active {
  color: #0f766e;
}
</style>

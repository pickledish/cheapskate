import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import { supabase } from '@/lib/supabase'

async function bootstrap() {
  // Pick up OAuth tokens stashed by the inline script in index.html
  const raw = sessionStorage.getItem('oauth_tokens')
  if (raw) {
    sessionStorage.removeItem('oauth_tokens')
    const { access_token, refresh_token } = JSON.parse(raw)
    if (access_token && refresh_token) {
      await supabase.auth.setSession({ access_token, refresh_token })
    }
  }

  createApp(App).use(router).mount('#app')
}

bootstrap()

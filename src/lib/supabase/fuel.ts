import { createClient } from '@supabase/supabase-js'

const fuelSupabaseUrl = 'https://hziksqggnmjftimwgyyk.supabase.co'
const fuelSupabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6aWtzcWdnbm1qZnRpbXdneXlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4NDc5NDQsImV4cCI6MjA4NTQyMzk0NH0.4_n8TXZ1lKYer2srmtexe1En1KfEnehXmykvsjqGVBY'

export const fuelSupabase = createClient(fuelSupabaseUrl, fuelSupabaseKey, {
  auth: { persistSession: false }
})

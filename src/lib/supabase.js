import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export const VAPID_PUBLIC_KEY = 'BC__SLGqReRItTPZZl_5ZDgZYiUym9kzcA_f5zSi_qPPJf5JaRrx6X22QiBCDPIUraoA6SUFpjs2aA4-utAme38'
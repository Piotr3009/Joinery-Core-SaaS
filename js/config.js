// Supabase Configuration
// WARNING: This file should NOT be committed to repository in production!

const SUPABASE_URL = 'https://iszkquzpoktokmkjmuuq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzemtxdXpwb2t0b2tta2ptdXVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0Mzg3NTksImV4cCI6MjA2ODAxNDc1OX0.hijtNZIitJkc3BIQsYUkUTi3_l8OlCGSiJZdM9G3ywA';

// Initialize Supabase client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const SUPABASE_URL = 'https://vyoeycpclrlhzcvcpqqi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5b2V5Y3BjbHJsaHpjdmNwcXFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NTk4ODIsImV4cCI6MjA4OTMzNTg4Mn0.eQDKWW818nA8y2VmpP_PLwzx2eUdS7aZHDvR71VOxL0';
const BUCKET_NAME = 'cow-images';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const BEHAVIOR_MAP = {
    standing: 'Đứng',
    lying: 'Nằm',
    eating: 'Ăn',
    drinking: 'Uống nước',
    walking: 'Đi lại',
    abnormal: 'Bất thường',
};

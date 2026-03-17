let SUPABASE_URL = '';
let SUPABASE_KEY = '';
const BUCKET_NAME = 'cow-images';

let supabase = null;

async function initializeSupabaseConfig() {
    try {
        const response = await fetch('/api/env', { cache: 'no-store' });
        if (response.ok) {
            const env = await response.json();
            SUPABASE_URL = env.SUPABASE_URL || '';
            SUPABASE_KEY = env.SUPABASE_ANON_KEY || '';
        }
    } catch (err) {
        console.warn('Khong tai duoc env tu /api/env:', err);
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return false;
    }

    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return true;
}

window.initializeSupabaseConfig = initializeSupabaseConfig;

const BEHAVIOR_MAP = {
    standing: 'Đứng',
    lying: 'Nằm',
    eating: 'Ăn',
    drinking: 'Uống nước',
    walking: 'Đi lại',
    abnormal: 'Bất thường',
};

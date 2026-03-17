var SUPABASE_URL = window.SUPABASE_URL || '';
var SUPABASE_KEY = window.SUPABASE_KEY || '';
var BUCKET_NAME = window.BUCKET_NAME || 'cow-images';

var LOCAL_FALLBACK_SUPABASE_URL = 'https://vyoeycpclrlhzcvcpqqi.supabase.co';
var LOCAL_FALLBACK_PUBLISHABLE_KEY = 'sb_publishable_ddY5U44Uh7sARbw2D18gXQ_zggDPphB';

var supabase = window.supabase || null;

async function initializeSupabaseConfig() {
    try {
        const response = await fetch('/api/env', { cache: 'no-store' });
        if (response.ok) {
            const env = await response.json();
            SUPABASE_URL = env.SUPABASE_URL || '';
            SUPABASE_KEY = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '';
        }
    } catch (err) {
        console.warn('Khong tai duoc env tu /api/env:', err);
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        SUPABASE_URL = LOCAL_FALLBACK_SUPABASE_URL;
        SUPABASE_KEY = LOCAL_FALLBACK_PUBLISHABLE_KEY;
        console.warn('Dang dung fallback Supabase config cho local dev.');
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return false;
    }

    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    window.SUPABASE_URL = SUPABASE_URL;
    window.SUPABASE_KEY = SUPABASE_KEY;
    window.BUCKET_NAME = BUCKET_NAME;
    window.supabase = supabase;
    return true;
}

window.initializeSupabaseConfig = initializeSupabaseConfig;

var BEHAVIOR_MAP = window.BEHAVIOR_MAP || {
    standing: 'Đứng',
    lying: 'Nằm',
    eating: 'Ăn',
    drinking: 'Uống nước',
    walking: 'Đi lại',
    abnormal: 'Bất thường',
};
window.BEHAVIOR_MAP = BEHAVIOR_MAP;

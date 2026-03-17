document.addEventListener('DOMContentLoaded', async () => {
    const ready = await window.initializeSupabaseConfig();
    if (!ready) {
        alert('Chua cau hinh SUPABASE_URL hoac SUPABASE_ANON_KEY. Vui long them Environment Variables tren Vercel.');
        return;
    }

    // Initialize modules
    Upload.init();
    Camera.init();
    Gallery.init();
    Export.init();

    // Tab navigation
    const navItems = document.querySelectorAll('.nav-item');
    const tabs = document.querySelectorAll('.tab-content');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabName = item.dataset.tab;

            // Update nav
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            // Update content
            tabs.forEach(t => t.classList.remove('active'));
            document.getElementById(`tab-${tabName}`).classList.add('active');

            // Auto-load gallery when switching to it
            if (tabName === 'gallery') {
                Gallery.loadGallery();
            }
        });
    });
});

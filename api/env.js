module.exports = (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
        SUPABASE_URL: process.env.SUPABASE_URL || '',
        SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY || '',
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
    });
};

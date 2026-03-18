module.exports = {
    apps: [{
        name: 'cow-visioning',
        script: 'server.js',
        instances: 1,
        env: {
            NODE_ENV: 'production',
        },
        watch: false,
        max_memory_restart: '300M',
        error_file: './logs/err.log',
        out_file: './logs/out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
    }],
};

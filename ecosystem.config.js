module.exports = {
    apps: [
        {
            name: 'cow-visioning',
            script: 'server.js',
            cwd: __dirname,
            instances: 1,
            env: {
                NODE_ENV: 'production',
            },
            watch: false,
            max_memory_restart: '300M',
            error_file: './logs/err.log',
            out_file: './logs/out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
        },
        {
            name: 'cow-visioning-ai',
            script: 'python3',
            cwd: __dirname,
            args: '-m uvicorn ai_service.app:app --host 127.0.0.1 --port 8001',
            interpreter: 'none',
            instances: 1,
            watch: false,
            max_memory_restart: '700M',
            error_file: './logs/ai-err.log',
            out_file: './logs/ai-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
        },
    ],
};

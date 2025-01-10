module.exports = {
    apps: [{
        name: 'scriptorium-prod',
        script: 'npm',
        args: 'start',
        cwd: '/home/nickin/Desktop/scriptorium',
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        },
        instances: 6,
        exec_mode: 'cluster',
        max_memory_restart: '300M',
        error_file: 'logs/error.log',
        out_file: 'logs/output.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
        merge_logs: true
    }]
} 
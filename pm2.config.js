// Config
const config = require(`./${process.argv[5]}`);

// Util
const app = component => config.appName + '-' + component;
const logsPath = log => `~/logs/${config.appName}/${log}`;
const apps = [];

const error_file = logsPath(`error.log`);
const out_file = logsPath(`output.log`);
const log_file = logsPath(`merged.log`);
const log_date_format = 'YYYY-MM-DD HH:mm:ss';

// Web server
apps.push({
    error_file,
    out_file,
    log_file,
    log_date_format,
    name: app('listener'),
    script: 'listener.js',
    args: [process.argv[5]],
    merge_logs: true,
});

// Workers
for (let i = 0; i < config.appWorkers; i++) {
    apps.push({
        error_file,
        out_file,
        log_file,
        log_date_format,
        name: app('worker'),
        script: 'worker.js',
        args: [process.argv[5]],
        merge_logs: true,
        env: {
            token_id: i
        },
    });
}

module.exports = {
    apps,
};

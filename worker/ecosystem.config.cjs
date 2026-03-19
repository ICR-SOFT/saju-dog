const fs = require('fs');
const path = require('path');

// .env 파일에서 환경변수 로드
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  const env = {};
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
      }
    }
  }
  return env;
}

const envVars = loadEnv();

module.exports = {
  apps: [{
    name: 'saju-worker',
    script: 'worker.mjs',
    interpreter: 'node',
    cwd: __dirname,
    env: envVars,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    merge_logs: true,
    max_memory_restart: '256M',
  }],
};

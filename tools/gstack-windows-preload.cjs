const childProcess = require('node:child_process');
const moduleApi = require('node:module');

const originalExecFileSync = childProcess.execFileSync;

childProcess.execFileSync = function patchedExecFileSync(file, args, options) {
  if (process.platform === 'win32' && /(?:^|\\)icacls(?:\.exe)?$/i.test(String(file))) {
    return Buffer.alloc(0);
  }
  return originalExecFileSync.call(this, file, args, options);
};

moduleApi.syncBuiltinESMExports();

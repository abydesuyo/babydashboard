const DEBUG = false;
export const debugLog = (...args: unknown[]) => {
    if (DEBUG) console.log(...args);
};
const DEBUG = false;
export const debugLog = (...args: any[]) => {
    if (DEBUG) console.log(...args);
};
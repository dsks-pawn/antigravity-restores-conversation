// Suppress experimental sqlite warning
process.removeAllListeners('warning');
process.on('warning', (warning) => {
    if (warning.name === 'ExperimentalWarning' && warning.message.includes('SQLite')) {
        return;
    }
});

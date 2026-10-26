const results = document.getElementById('test-results');
const summary = document.getElementById('summary');
let passed = 0;
let failed = 0;

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

function assertArrayEqual(actual, expected, message) {
    assertEqual(JSON.stringify(actual), JSON.stringify(expected), message);
}

function queueNames(names) {
    queuedFiles = names.map(name => ({ name }));
    return resolveAllNames();
}

function resetNamingOptions() {
    prefixInput.value = '';
    nameBehavior.value = 'keep';
    customNameInput.value = '';
    suffixInput.value = '';
    numberingToggle.value = 'none';
}

async function test(name, callback) {
    const item = document.createElement('li');
    try {
        await callback();
        passed++;
        item.className = 'pass';
        item.textContent = `PASS ${name}`;
    } catch (error) {
        failed++;
        item.className = 'fail';
        item.textContent = `FAIL ${name}: ${error.message}`;
    }
    results.appendChild(item);
}

async function runTests() {
    await test('all JavaScript DOM references resolve and form controls have labels', () => {
        const ids = [
            'drop-zone', 'file-input', 'prefix-input', 'name-behavior', 'custom-name-wrapper',
            'custom-name-input', 'suffix-input', 'numbering-toggle', 'preview-body',
            'download-btn', 'clear-btn', 'zip-name', 'status-message', 'error-message'
        ];
        for (const id of ids) {
            assertEqual(document.getElementById(id) !== null, true, `DOM element #${id}`);
        }
        for (const control of document.querySelectorAll('input, select')) {
            assertEqual(Boolean(control.labels && control.labels.length) || Boolean(control.getAttribute('aria-label')), true, `Accessible label for #${control.id}`);
        }
        assertEqual(document.querySelector('table caption') !== null, true, 'Preview table caption');
    });

    await test('clicks on nested interactive elements do not open the file picker', () => {
        const originalClick = fileInput.click;
        let pickerRequests = 0;
        fileInput.click = () => pickerRequests++;
        const nestedButton = document.createElement('button');
        nestedButton.type = 'button';
        dropZone.appendChild(nestedButton);
        const nestedLink = document.createElement('a');
        nestedLink.href = '#';
        dropZone.appendChild(nestedLink);
        try {
            nestedButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            nestedLink.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            assertEqual(pickerRequests, 0, 'Picker requests from nested controls');
            const text = document.createElement('span');
            dropZone.appendChild(text);
            text.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            assertEqual(pickerRequests, 1, 'Picker request from non-interactive content');
        } finally {
            nestedButton.remove();
            nestedLink.remove();
            fileInput.click = originalClick;
        }
    });

    await test('the upload area opens the file picker from Enter and Space', () => {
        const originalClick = fileInput.click;
        let pickerRequests = 0;
        fileInput.click = () => pickerRequests++;
        try {
            for (const key of ['Enter', ' ']) {
                const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
                dropZone.dispatchEvent(event);
                assertEqual(event.defaultPrevented, true, `${key} default action`);
            }
            assertEqual(pickerRequests, 2, 'Keyboard picker requests');
        } finally {
            fileInput.click = originalClick;
        }
    });

    await test('dragleave with null relatedTarget preserves highlighting within nested drop-zone elements', () => {
        const nested = document.createElement('span');
        dropZone.appendChild(nested);
        const enteringZone = new Event('dragenter', { bubbles: true, cancelable: true });
        dropZone.dispatchEvent(enteringZone);
        const enteringChild = new Event('dragenter', { bubbles: true, cancelable: true });
        nested.dispatchEvent(enteringChild);

        const leavingChild = new Event('dragleave', { bubbles: true });
        Object.defineProperty(leavingChild, 'relatedTarget', { value: null });
        nested.dispatchEvent(leavingChild);
        assertEqual(dropZone.classList.contains('drag-over'), true, 'Highlight while moving within zone');

        const leavingZone = new Event('dragleave', { bubbles: true });
        Object.defineProperty(leavingZone, 'relatedTarget', { value: null });
        dropZone.dispatchEvent(leavingZone);
        assertEqual(dropZone.classList.contains('drag-over'), false, 'Highlight after leaving zone');

        const cancelledDragEnter = new Event('dragenter', { bubbles: true, cancelable: true });
        dropZone.dispatchEvent(cancelledDragEnter);
        assertEqual(dropZone.classList.contains('drag-over'), true, 'Highlight during cancelled drag');
        window.dispatchEvent(new Event('dragend'));
        assertEqual(dropZone.classList.contains('drag-over'), false, 'Highlight cleared after cancelled drag');

        const droppedFile = new File(['dropped content'], 'dropped.txt');
        const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
        Object.defineProperty(dropEvent, 'dataTransfer', { value: { files: [droppedFile] } });
        dropZone.dispatchEvent(dropEvent);
        assertEqual(dropEvent.defaultPrevented, true, 'Drop default prevented');
        assertEqual(dropZone.classList.contains('drag-over'), false, 'Highlight cleared after drop');
        assertArrayEqual(queuedFiles.map(file => file.name), ['dropped.txt'], 'Dropped file queued');

        dragEnterDepth = 0;
        nested.remove();
    });

    await test('extension rules preserve dotfiles and last-dot behavior', () => {
        resetNamingOptions();
        assertArrayEqual(
            queueNames(['.env', '.gitignore', '.env.local', 'README', 'backup.tar.gz']),
            ['.env', '.gitignore', '.env.local', 'README', 'backup.tar.gz'],
            'Default transformed names'
        );
    });

    await test('prefix, suffix, replacement, empty names, and numbering interact correctly', () => {
        resetNamingOptions();
        prefixInput.value = 'ProjectA';
        suffixInput.value = '_v1';
        numberingToggle.value = 'suffix';
        assertArrayEqual(queueNames(['report.tar.gz']), ['ProjectA - report.tar - _v1_1.gz'], 'Suffix numbering');
        numberingToggle.value = 'prefix';
        assertArrayEqual(queueNames(['report.tar.gz']), ['1_ProjectA - report.tar - _v1.gz'], 'Prefix numbering');
        numberingToggle.value = 'none';
        nameBehavior.value = 'replace';
        customNameInput.value = 'document';
        assertArrayEqual(queueNames(['report.tar.gz']), ['ProjectA - document - _v1.gz'], 'Replacement naming');
        nameBehavior.value = 'empty';
        assertArrayEqual(queueNames(['report.tar.gz']), ['ProjectA - _v1.gz'], 'Empty-name behavior');
        prefixInput.value = '';
        suffixInput.value = '';
        assertArrayEqual(queueNames(['.env', 'README']), ['file_1', 'file_2'], 'Unique fallback names');
    });

    await test('sanitization flattens paths and handles invalid characters, trailing dots, and device names', () => {
        resetNamingOptions();
        assertArrayEqual(
            queueNames(['a/b?c.txt', 'trailing. ', 'CON.txt', 'LPT1', 'COM3.log', 'CONIN$.txt']),
            ['a_b_c.txt', 'trailing', '_CON.txt', '_LPT1', '_COM3.log', '_CONIN$.txt'],
            'Sanitized names'
        );
    });

    await test('case-insensitive duplicates and generated suffix collisions resolve in queue order', () => {
        resetNamingOptions();
        assertArrayEqual(
            queueNames(['Alpha.txt', 'alpha.TXT', 'alpha (1).txt', 'alpha.txt']),
            ['Alpha.txt', 'alpha (1).TXT', 'alpha (1) (1).txt', 'alpha (2).txt'],
            'Case and generated-suffix collisions'
        );
    });

    await test('canonical Unicode equivalents collide while displayed filenames retain their normalization', () => {
        resetNamingOptions();
        const decomposed = 'cafe\u0301.txt';
        assertArrayEqual(
            queueNames(['café.txt', decomposed]),
            ['café.txt', 'cafe\u0301 (1).txt'],
            'NFC collision key with original display normalization preserved'
        );
        assertEqual(getCollisionKey('É.txt'), getCollisionKey('e\u0301.txt'), 'Case-insensitive canonical key');
    });

    await test('sanitization collisions and prototype-sensitive names remain safe', () => {
        resetNamingOptions();
        assertArrayEqual(
            queueNames(['a/b.txt', 'a_b.txt', 'constructor', 'toString', '__proto__']),
            ['a_b.txt', 'a_b (1).txt', 'constructor', 'toString', '__proto__'],
            'Sanitization collision and special property names'
        );
    });

    await test('ZIP filename cleanup trims input, handles extensions case-insensitively, and avoids duplicates', () => {
        zipNameInput.value = ' archive.ZIP ';
        assertEqual(getZipFilename(), 'archive.ZIP', 'Existing ZIP extension');
        zipNameInput.value = 'archive.ZIP.zip';
        assertEqual(getZipFilename(), 'archive.zip', 'Repeated ZIP extension');
        zipNameInput.value = 'bad/name?.zip';
        assertEqual(getZipFilename(), 'bad_name_.zip', 'Invalid ZIP filename characters');
        zipNameInput.value = 'CON.zip';
        assertEqual(getZipFilename(), '_CON.zip', 'Reserved ZIP filename');
        zipNameInput.value = '.zip';
        assertEqual(getZipFilename(), 'renamed_files.zip', 'Empty ZIP basename');
        zipNameInput.value = '   ';
        assertEqual(getZipFilename(), 'renamed_files.zip', 'Blank ZIP filename');
    });

    await test('generated ZIP entries have unique flat names and preserve file contents', async () => {
        resetNamingOptions();
        const inputNames = ['.env', '.env.local', 'backup.tar.gz', 'constructor', 'toString', '__proto__', 'a/b.txt', 'a_b.txt', 'Alpha.txt', 'alpha.TXT'];
        const names = queueNames(inputNames);
        const zip = new JSZip();
        const contents = new Map();

        names.forEach((name, index) => {
            const content = `file-content-${index}`;
            contents.set(name, content);
            zip.file(name, content);
        });

        const data = await zip.generateAsync({ type: 'uint8array' });
        const reopened = await JSZip.loadAsync(data);
        const entryNames = Object.keys(reopened.files).filter(name => !reopened.files[name].dir);
        assertArrayEqual(entryNames, names, 'ZIP entry order and names');
        assertEqual(new Set(entryNames.map(name => name.toLowerCase())).size, names.length, 'Case-insensitive ZIP uniqueness');
        for (const name of names) {
            assertEqual(await reopened.file(name).async('string'), contents.get(name), `Contents for ${name}`);
        }
    });

    await test('successful downloads clean up the link and restore the button state', async () => {
        const file = new Blob(['download content']);
        Object.defineProperty(file, 'name', { value: 'download.txt' });
        queuedFiles = [file];
        zipNameInput.value = 'download.ZIP';

        const originalGenerate = JSZip.prototype.generateAsync;
        const originalCreateObjectURL = URL.createObjectURL;
        const originalRevokeObjectURL = URL.revokeObjectURL;
        const originalClick = HTMLAnchorElement.prototype.click;
        const originalSetTimeout = window.setTimeout;
        let clickDetails;
        let scheduledCleanup;
        const revokedUrls = [];

        JSZip.prototype.generateAsync = () => Promise.resolve(new Blob(['zip data']));
        URL.createObjectURL = () => 'blob:test-download';
        URL.revokeObjectURL = url => revokedUrls.push(url);
        HTMLAnchorElement.prototype.click = function () {
            clickDetails = { filename: this.download, attached: this.isConnected };
        };
        window.setTimeout = (callback, delay, ...args) => {
            if (delay === 300_000) {
                scheduledCleanup = callback;
                return 1;
            }
            return originalSetTimeout(callback, delay, ...args);
        };

        try {
            await packageAndDistributeZip();
            assertEqual(clickDetails.filename, 'download.ZIP', 'Downloaded ZIP filename');
            assertEqual(clickDetails.attached, true, 'Link attached during click');
            assertEqual(document.querySelectorAll('a[download]').length, 0, 'Temporary link removed after click');
            assertEqual(isDownloading, false, 'Busy state after success');
            assertEqual(downloadBtn.disabled, false, 'Download button after success');
            assertEqual(revokedUrls.length, 0, 'URL remains available for the browser download');
            assertEqual(typeof scheduledCleanup, 'function', 'Delayed URL cleanup scheduled');
            scheduledCleanup();
            assertArrayEqual(revokedUrls, ['blob:test-download'], 'Temporary URL cleanup');
        } finally {
            JSZip.prototype.generateAsync = originalGenerate;
            URL.createObjectURL = originalCreateObjectURL;
            URL.revokeObjectURL = originalRevokeObjectURL;
            HTMLAnchorElement.prototype.click = originalClick;
            window.setTimeout = originalSetTimeout;
        }
    });

    await test('generation locks queue and naming controls while preserving the starting snapshot', async () => {
        const file = new Blob(['queue-clear content']);
        Object.defineProperty(file, 'name', { value: 'queue-clear.txt' });
        queuedFiles = [file];
        renderPreviewWorkspace();

        const originalGenerate = JSZip.prototype.generateAsync;
        const originalCreateObjectURL = URL.createObjectURL;
        const originalRevokeObjectURL = URL.revokeObjectURL;
        const originalClick = HTMLAnchorElement.prototype.click;
        const originalSetTimeout = window.setTimeout;
        let resolveGeneration;
        let scheduledCleanup;
        let generationCount = 0;
        let archivedNames;

        JSZip.prototype.generateAsync = function () {
            generationCount++;
            archivedNames = Object.keys(this.files);
            return new Promise(resolve => {
                resolveGeneration = resolve;
            });
        };
        URL.createObjectURL = () => 'blob:queue-clear';
        URL.revokeObjectURL = () => {};
        HTMLAnchorElement.prototype.click = () => {};
        window.setTimeout = (callback, delay, ...args) => {
            if (delay === 300_000) {
                scheduledCleanup = callback;
                return 1;
            }
            return originalSetTimeout(callback, delay, ...args);
        };

        try {
            dragEnterDepth = 2;
            dropZone.classList.add('drag-over');
            const generation = packageAndDistributeZip();
            const removeButton = previewBody.querySelector('.btn-text-danger');
            assertEqual(isDownloading, true, 'Busy state during generation');
            assertEqual(downloadBtn.disabled, true, 'Button disabled during generation');
            assertEqual(fileInput.disabled, true, 'File picker disabled during generation');
            assertEqual(clearBtn.disabled, true, 'Clear button disabled during generation');
            assertEqual(prefixInput.disabled, true, 'Naming settings disabled during generation');
            assertEqual(zipNameInput.disabled, true, 'ZIP filename disabled during generation');
            assertEqual(dropZone.getAttribute('aria-disabled'), 'true', 'Drop zone announces disabled state');
            assertEqual(statusMessage.textContent.includes('Changes are temporarily disabled.'), true, 'Generation snapshot is announced');
            assertEqual(removeButton.disabled, true, 'Remove button disabled during generation');
            assertEqual(getComputedStyle(removeButton).opacity, '0.6', 'Disabled Remove button is visibly muted');
            assertEqual(dropZone.classList.contains('drag-over'), false, 'Drag highlight cleared on generation start');
            assertEqual(dragEnterDepth, 0, 'Drag depth reset on generation start');
            prefixInput.value = 'changed';
            prefixInput.dispatchEvent(new Event('input', { bubbles: true }));
            handleFilesInput([{ name: 'late-file.txt' }]);
            assertArrayEqual(queuedFiles.map(queuedFile => queuedFile.name), ['queue-clear.txt'], 'Queue remains the captured snapshot');
            prefixInput.value = '';
            await packageAndDistributeZip();
            assertEqual(generationCount, 1, 'Only one concurrent generation');
            resolveGeneration(new Blob(['zip data']));
            await generation;
            assertArrayEqual(archivedNames, ['queue-clear.txt'], 'Archive uses the captured filename');
            assertEqual(isDownloading, false, 'Busy state after generation');
            assertEqual(downloadBtn.disabled, false, 'Download button after generation');
            assertEqual(removeButton.disabled, false, 'Remove button restored after generation');
            assertEqual(fileInput.disabled, false, 'File picker restored after generation');
            assertEqual(prefixInput.disabled, false, 'Naming settings restored after generation');
            assertEqual(zipNameInput.disabled, false, 'ZIP filename restored after generation');
            assertEqual(dropZone.getAttribute('aria-disabled'), 'false', 'Drop zone restored after generation');
            scheduledCleanup();
        } finally {
            JSZip.prototype.generateAsync = originalGenerate;
            URL.createObjectURL = originalCreateObjectURL;
            URL.revokeObjectURL = originalRevokeObjectURL;
            HTMLAnchorElement.prototype.click = originalClick;
            window.setTimeout = originalSetTimeout;
        }
    });

    await test('download state and temporary link recover after ZIP generation failure', async () => {
        resetNamingOptions();
        const file = new Blob(['test content']);
        Object.defineProperty(file, 'name', { value: 'test.txt' });
        queuedFiles = [file];
        renderPreviewWorkspace();
        const originalGenerate = JSZip.prototype.generateAsync;
        const originalConsoleError = console.error;
        let rejectGeneration;
        JSZip.prototype.generateAsync = () => new Promise((resolve, reject) => {
            rejectGeneration = reject;
        });
        console.error = () => {};

        try {
            const generation = packageAndDistributeZip();
            const removeButton = previewBody.querySelector('.btn-text-danger');
            assertEqual(isDownloading, true, 'Busy state during failing generation');
            assertEqual(downloadBtn.disabled, true, 'Download button disabled during failure');
            assertEqual(prefixInput.disabled, true, 'Naming control disabled during failure');
            assertEqual(fileInput.disabled, true, 'File picker disabled during failure');
            assertEqual(removeButton.disabled, true, 'Remove button disabled during failure');
            rejectGeneration(new Error('expected test failure'));
            await generation;
            assertEqual(isDownloading, false, 'Busy state after failure');
            assertEqual(downloadBtn.disabled, false, 'Download button after failure');
            assertEqual(downloadBtn.textContent.trim(), 'Download Renamed Archive (.zip)', 'Button label after failure');
            assertEqual(prefixInput.disabled, false, 'Naming control restored after failure');
            assertEqual(fileInput.disabled, false, 'File picker restored after failure');
            assertEqual(previewBody.querySelector('.btn-text-danger').disabled, false, 'Remove button restored after failure');
            assertEqual(errorMessage.hidden, false, 'Accessible error state');
            assertEqual(document.querySelectorAll('a[download]').length, 0, 'Temporary link cleanup');
        } finally {
            JSZip.prototype.generateAsync = originalGenerate;
            console.error = originalConsoleError;
            errorMessage.hidden = true;
        }
    });

    await test('missing JSZip reports a friendly accessible error and logs diagnostics', async () => {
        const originalJSZip = window.JSZip;
        const originalConsoleError = console.error;
        let loggedDiagnostics = false;
        queuedFiles = [{ name: 'missing-library.txt' }];
        window.JSZip = undefined;
        console.error = () => { loggedDiagnostics = true; };
        try {
            await packageAndDistributeZip();
            assertEqual(errorMessage.hidden, false, 'Visible error message');
            assertEqual(errorMessage.textContent, 'The ZIP library could not be loaded. Reload the page and try again.', 'Friendly error text');
            assertEqual(loggedDiagnostics, true, 'Console diagnostic');
            assertEqual(isDownloading, false, 'Busy state remains idle');
        } finally {
            window.JSZip = originalJSZip;
            console.error = originalConsoleError;
            errorMessage.hidden = true;
        }
    });

    summary.textContent = `${passed} passed, ${failed} failed.`;
    summary.className = failed === 0 ? 'pass' : 'fail';
}

runTests();

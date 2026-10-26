// ==========================================
// 1. GLOBAL STATE
// ==========================================
// Stores all files that the user has selected or dragged
// into the application. These files will be renamed and zipped.
let queuedFiles = [];
let isDownloading = false;
let dragEnterDepth = 0;

// ==========================================
// 2. DOM ELEMENT REFERENCES
// ==========================================
// Get references to HTML elements so JavaScript can interact
// with the file upload area, inputs, preview table, and buttons.
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const prefixInput = document.getElementById('prefix-input');
const nameBehavior = document.getElementById('name-behavior');
const customNameWrapper = document.getElementById('custom-name-wrapper');
const customNameInput = document.getElementById('custom-name-input');
const suffixInput = document.getElementById('suffix-input');
const numberingToggle = document.getElementById('numbering-toggle');
const previewBody = document.getElementById('preview-body');
const downloadBtn = document.getElementById('download-btn');
const clearBtn = document.getElementById('clear-btn');
const zipNameInput = document.getElementById('zip-name');
const statusMessage = document.getElementById('status-message');
const errorMessage = document.getElementById('error-message');
const downloadButtonContents = downloadBtn.innerHTML;
const namingControls = [prefixInput, nameBehavior, customNameInput, suffixInput, numberingToggle, zipNameInput];

// ==========================================
// 3. UI EVENT REGISTRATIONS
// ==========================================

// File Selection & Drag-and-Drop

// Open the file selection dialog when the drop zone is clicked.
// fileInput.click() programmatically activates the file input.
dropZone.addEventListener('click', (e) => {
    const interactiveTarget = e.target.closest('a, area[href], button, input, select, textarea, label, summary, audio[controls], video[controls], iframe, object, embed, [role="button"], [role="link"], [contenteditable="true"], [tabindex]:not([tabindex="-1"])');
    if (!isDownloading && (!interactiveTarget || interactiveTarget === dropZone)) {
        fileInput.click();
    }
});

dropZone.addEventListener('keydown', (e) => {
    if (!isDownloading && e.target === dropZone && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        fileInput.click();
    }
});

// Handle files selected through the file browser.
fileInput.addEventListener('change', (e) => {
    // Pass the selected files to the function that adds them
    // to the queue and updates the preview.
    handleFilesInput(e.target.files);
    // Reset the input so the same file can be selected again
    // without requiring the user to select a different file first.
    fileInput.value = ''; 
});

// Handle files being dragged over the drop zone.
dropZone.addEventListener('dragenter', (e) => {
    if (isDownloading) return;
    e.preventDefault();
    dragEnterDepth++;
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragover', (e) => {
    if (isDownloading) return;
    // Prevent the browser's default behavior, which could
    // otherwise open the dragged file instead of accepting it.
    e.preventDefault();
    // Add a CSS class to visually highlight the drop zone.
    dropZone.classList.add('drag-over');
});

// Track nested dragenter/dragleave pairs; relatedTarget may be null during a drag.
dropZone.addEventListener('dragleave', () => {
    dragEnterDepth = Math.max(0, dragEnterDepth - 1);
    if (dragEnterDepth === 0) {
        dropZone.classList.remove('drag-over');
    }
});
function clearDragHighlight() {
    dragEnterDepth = 0;
    dropZone.classList.remove('drag-over');
}

dropZone.addEventListener('dragend', clearDragHighlight);
window.addEventListener('dragend', clearDragHighlight);

// Handle files dropped onto the drop zone.
dropZone.addEventListener('drop', (e) => {
    // Prevent the browser from opening the dropped files.
    e.preventDefault();
    // Remove the visual highlight from the drop zone.
    dragEnterDepth = 0;
    dropZone.classList.remove('drag-over');
    if (isDownloading) return;
    // Check whether at least one file was dropped.
    if (e.dataTransfer.files.length > 0) {
        // Add the dropped files to the queue and refresh the preview.
        handleFilesInput(e.dataTransfer.files);
    }
});

// Listen for changes to the filename settings.
// Whenever one of these controls changes, update the preview.
[prefixInput, customNameInput, suffixInput, nameBehavior, numberingToggle].forEach(element => {
    element.addEventListener('input', () => {
        if (isDownloading) return;
        // Show the custom-name input only when the user
        // selects the option to replace the original filename.
        customNameWrapper.hidden = nameBehavior.value !== 'replace';
        // Recalculate the filenames and refresh the preview table.
        renderPreviewWorkspace();
    });
});

// Handle clicks on the Clear button.
clearBtn.addEventListener('click', () => {
    if (isDownloading) return;
    // Empty the queue by replacing it with a new empty array.
    queuedFiles = [];
    // Refresh the interface to reflect the empty queue.
    renderPreviewWorkspace();
    setStatusMessage('File queue cleared.');
});

// Start the ZIP generation and download process when the
// user clicks the Download button.
downloadBtn.addEventListener('click', packageAndDistributeZip);


// ==========================================
// 4. CORE APPLICATION LOGIC & ACTIONS
// ==========================================

// Add selected or dragged files to the queue.
function handleFilesInput(filesList) {
    if (isDownloading) return;
    // Loop through all files in the supplied FileList.
    for (let i = 0; i < filesList.length; i++) {
        // Add each file to the end of the queuedFiles array.
        queuedFiles.push(filesList[i]);
    }

    // Update the preview table to include the new files.
    renderPreviewWorkspace();
    if (filesList.length > 0) {
        setStatusMessage(`${queuedFiles.length} file${queuedFiles.length === 1 ? '' : 's'} queued.`);
    }
}

// Remove an individual file from the queue.
function removeIndividualFile(targetIndex) {
    if (isDownloading) return;
    // Remove one file at the specified array index.
    // The second argument, 1, means that only one item is removed.
    queuedFiles.splice(targetIndex, 1);
    // Refresh the preview after removing the file.
    renderPreviewWorkspace();
}

// Refresh the preview table whenever files or naming settings change.
function renderPreviewWorkspace() {
    
    // If the queue is empty, display a message and disable downloading.
    if (queuedFiles.length === 0) {
        previewBody.innerHTML = `<tr><td colspan="3" class="empty-state">No files queued. Drag files or browse to begin staging.</td></tr>`;
        downloadBtn.disabled = true;
        clearBtn.hidden = true;

        // Stop here because there are no files to display.
        return;
    }

    // Show the Clear button and enable downloading when files exist.
    clearBtn.hidden = false;
    clearBtn.disabled = isDownloading;
    downloadBtn.disabled = isDownloading;

    // Remove existing table rows before rebuilding the preview.
    previewBody.innerHTML = '';

    // Generate the final filenames and resolve duplicate names.
    const safeNamesList = resolveAllNames();

    // Create one preview row for every queued file.
    queuedFiles.forEach((file, index) => {

        // Get the calculated filename corresponding to this file.
        const transformedName = safeNamesList[index];
        // Create a new table row.
        const row = document.createElement('tr');

        // Create a cell displaying the original filename.
        const oldCell = document.createElement('td');
        oldCell.className = 'old-name';

        // textContent displays the filename as text rather than HTML.
        oldCell.textContent = file.name;

        // Create a cell displaying the proposed new filename.
        const newCell = document.createElement('td');
        newCell.className = 'new-name';
        newCell.textContent = transformedName;
        newCell.setAttribute('headers', 'transformed-filename-heading');
        oldCell.setAttribute('headers', 'original-filename-heading');

        // Create a cell for the Remove button.
        const actionCell = document.createElement('td');
        actionCell.className = 'action-column';
        actionCell.setAttribute('headers', 'action-heading');
        
        // Create a button that removes this file from the queue.
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-text-danger';
        deleteBtn.innerHTML = '&times; Remove';
        deleteBtn.setAttribute('aria-label', `Remove ${file.name}`);
        deleteBtn.disabled = isDownloading;
        
        // When clicked, remove this file and refresh the preview.
        deleteBtn.addEventListener('click', () => removeIndividualFile(index));

        // Assemble the row by adding the button to its cell,
        // then adding all cells to the row.
        actionCell.appendChild(deleteBtn);
        row.appendChild(oldCell);
        row.appendChild(newCell);
        row.appendChild(actionCell);
        previewBody.appendChild(row);
    });
}

// Create a ZIP archive containing the queued files under their
// calculated filenames, then trigger a download in the browser.
async function packageAndDistributeZip() {

    // Do nothing if there are no files to package.
    if (queuedFiles.length === 0 || isDownloading) return;
    
    // Make sure the JSZip library has been loaded before using it.
    if (typeof JSZip === 'undefined') {
        const error = new Error("JSZip is unavailable; the bundled './lib/jszip.min.js' script did not load.");
        console.error('ZIP pipeline failure:', error);
        setErrorMessage('The ZIP library could not be loaded. Reload the page and try again.');
        return;
    }
    
    const filesToArchive = queuedFiles.slice();
    const safeNamesList = resolveAllNames();
    const archiveFilename = getZipFilename();

    // Disable the button to prevent repeated clicks while generating.
    isDownloading = true;
    clearDragHighlight();
    setGenerationUIState(true);
    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Generating Pack...';
    setStatusMessage('Creating ZIP from the current files and naming settings. Changes are temporarily disabled.');

    let downloadUrl;
    let revokeScheduled = false;
    let linkElement;
    try {
        
        // Create a new JSZip archive instance.
        const zip = new JSZip();

        // Add each queued file to the ZIP using its new filename.
        // The file data is added without modifying its contents.
        for (let i = 0; i < filesToArchive.length; i++) {
            zip.file(safeNamesList[i], filesToArchive[i]);
        }

        // Generate the ZIP archive asynchronously as a Blob.
        // A Blob represents the archive data in the browser.
        const finalBlob = await zip.generateAsync({ type: 'blob' });
        
        // Create a temporary link element to initiate the download.
        linkElement = document.createElement('a');
        
        // Create a temporary URL pointing to the generated ZIP data.
        downloadUrl = URL.createObjectURL(finalBlob);
        linkElement.href = downloadUrl;
        linkElement.download = archiveFilename;
        linkElement.style.display = 'none';
        document.body.appendChild(linkElement);
        // Programmatically click the link to start the download.
        linkElement.click();
        
        // Best-effort cleanup only: browsers do not expose a reliable download-completion event for this link.
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 300_000);
        revokeScheduled = true;
        setStatusMessage('ZIP download started.');

    } catch (err) {
        // Log technical details to the console for debugging.
        console.error("ZIP pipeline failure:", err);
        setErrorMessage('Could not create or download the ZIP archive. Check the console for details.');
    } finally {
        if (linkElement) linkElement.remove();
        if (downloadUrl && !revokeScheduled) URL.revokeObjectURL(downloadUrl);
        isDownloading = false;
        setGenerationUIState(false);
        renderPreviewWorkspace();
        // Restore the default download button label and icon.
        downloadBtn.innerHTML = downloadButtonContents;
    }

}

function setGenerationUIState(generating) {
    namingControls.forEach(control => {
        control.disabled = generating;
    });
    fileInput.disabled = generating;
    clearBtn.disabled = generating;
    previewBody.querySelectorAll('.btn-text-danger').forEach(button => {
        button.disabled = generating;
    });
    dropZone.setAttribute('aria-disabled', String(generating));
    dropZone.tabIndex = generating ? -1 : 0;
}

function setStatusMessage(message) {
    statusMessage.textContent = message;
    errorMessage.hidden = true;
    errorMessage.textContent = '';
}

function setErrorMessage(message) {
    errorMessage.textContent = message;
    errorMessage.hidden = false;
    statusMessage.textContent = '';
}


// ==========================================
// 5. HELPER FUNCTIONS FOR FILENAME GENERATION
// ==========================================

// Calculate the new filename for a file based on the user's
// selected naming options and the file's position in the queue.
function computeNewName(file, index) {
    let { baseName, extension } = splitFilenameExtension(file.name);

    // Check which naming behavior the user selected.
    if (nameBehavior.value === 'replace') {
        // Replace the original base filename with the custom name.
        baseName = customNameInput.value;
    } else if (nameBehavior.value === 'empty') {
        // Remove the original base filename.
        // A prefix or suffix can still be added afterward.
        baseName = '';
    }
    // Read the prefix and suffix entered by the user.
    let prefix = prefixInput.value;
    let suffix = suffixInput.value;

    // Apply sequential numbering if the user enabled it.
    if (numberingToggle.value === 'prefix') {
        // Add the file's number before the prefix.
        // index + 1 is used because array indexes start at zero.
        prefix = `${index + 1}_${prefix}`;
    } else if (numberingToggle.value === 'suffix') {
        // Append the file's number to the suffix.
        suffix = `${suffix}_${index + 1}`;
    }

    // Create an array to hold the non-empty parts of the new filename.
    let structuralSegments = [];

    // Add the prefix if it contains a value.
    if (prefix){
        structuralSegments.push(prefix);
    }

    // Add the base filename if it contains a value.
    if (baseName) {
        structuralSegments.push(baseName);
    }

    // Add the suffix if it contains a value.
    if (suffix) {
        structuralSegments.push(suffix);
    }

    // Combine the available parts using " - " as a separator.
    // Example: prefix - filename - suffix
    let finalComputedString = structuralSegments.join(' - ');

    // If all parts are empty, create a fallback filename
    // based on the file's position in the queue.
    if (!finalComputedString) {
        finalComputedString = `file_${index + 1}`;
    }

    // Append the original extension and sanitize the flat ZIP entry filename.
    return sanitizeEntryName(finalComputedString + extension, index);
}

function resolveAllNames() {
    const finalNames = [];
    const usedNames = new Set();

    queuedFiles.forEach((file, index) => {
        // Generate the filename using the current naming settings.
        let proposedName = computeNewName(file, index);

        const nameKey = getCollisionKey(proposedName);
        if (usedNames.has(nameKey)) {
            const { baseName, extension } = splitFilenameExtension(proposedName);
            let counter = 1;
            let adjustedName;
            do {
                adjustedName = sanitizeEntryName(`${baseName} (${counter})${extension}`, index);
                counter++;
            } while (usedNames.has(getCollisionKey(adjustedName)));
            proposedName = adjustedName;
        }

        finalNames.push(proposedName);
        usedNames.add(getCollisionKey(proposedName));
    });

    return finalNames;
}

function getCollisionKey(filename) {
    // Compare Unicode canonically equivalent names after NFC normalization and default Unicode lowercase.
    return filename.normalize('NFC').toLowerCase().normalize('NFC');
}

function splitFilenameExtension(filename) {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot <= 0) {
        return { baseName: filename, extension: '' };
    }
    return {
        baseName: filename.substring(0, lastDot),
        extension: filename.substring(lastDot)
    };
}

function sanitizeEntryName(filename, index) {
    let sanitizedName = sanitizeFilenameCharacters(filename);
    if (!sanitizedName) {
        sanitizedName = `file_${index + 1}`;
    }

    if (isReservedDeviceName(sanitizedName)) {
        sanitizedName = `_${sanitizedName}`;
    }

    return sanitizedName;
}

function sanitizeFilenameCharacters(filename) {
    // Flat ZIP entries replace invalid/control characters with underscores, trim trailing spaces or dots, and prefix device names.
    return filename
        .replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_')
        .replace(/[ .]+$/g, '');
}

function isReservedDeviceName(filename) {
    const deviceName = filename.split('.')[0].replace(/[ .]+$/g, '');
    return /^(con|prn|aux|nul|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])$/i.test(deviceName);
}

function getZipFilename() {
    // ZIP archive names use the same character policy but are validated independently of entry names.
    let filename = sanitizeFilenameCharacters(zipNameInput.value.trim());
    let extension = /\.zip$/i.test(filename) ? filename.slice(-4) : '.zip';

    while (/\.zip$/i.test(filename)) {
        filename = filename.slice(0, -4);
    }

    if (!filename) {
        filename = 'renamed_files';
    }
    if (isReservedDeviceName(filename)) {
        filename = `_${filename}`;
    }

    return `${filename}${extension}`;
}

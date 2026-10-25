// ==========================================
// 1. GLOBAL STATE
// ==========================================
// Stores all files that the user has selected or dragged
// into the application. These files will be renamed and zipped.
let queuedFiles = [];

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

// ==========================================
// 3. UI EVENT REGISTRATIONS
// ==========================================

// File Selection & Drag-and-Drop

// Open the file selection dialog when the drop zone is clicked.
// fileInput.click() programmatically activates the file input.
dropZone.addEventListener('click', () => fileInput.click());

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
dropZone.addEventListener('dragover', (e) => {
    // Prevent the browser's default behavior, which could
    // otherwise open the dragged file instead of accepting it.
    e.preventDefault();
    // Add a CSS class to visually highlight the drop zone.
    dropZone.classList.add('drag-over');
});

// Listen for dragleave and dragend events.
// Remove the highlight when the drag operation leaves or ends.
['dragleave', 'dragend'].forEach(type => {
    dropZone.addEventListener(type, () => dropZone.classList.remove('drag-over'));
});

// Handle files dropped onto the drop zone.
dropZone.addEventListener('drop', (e) => {
    // Prevent the browser from opening the dropped files.
    e.preventDefault();
    // Remove the visual highlight from the drop zone.
    dropZone.classList.remove('drag-over');
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
        // Show the custom-name input only when the user
        // selects the option to replace the original filename.
        if(nameBehavior.value === 'replace') {
            customNameWrapper.style.display = 'flex';
        } else {
            // Hide the custom-name input for other naming options.
            customNameWrapper.style.display = 'none';
        }
        // Recalculate the filenames and refresh the preview table.
        renderPreviewWorkspace();
    });
});

// Handle clicks on the Clear button.
clearBtn.addEventListener('click', () => {
    // Empty the queue by replacing it with a new empty array.
    queuedFiles = [];
    // Refresh the interface to reflect the empty queue.
    renderPreviewWorkspace();
});

// Start the ZIP generation and download process when the
// user clicks the Download button.
downloadBtn.addEventListener('click', packageAndDistributeZip);


// ==========================================
// 4. CORE APPLICATION LOGIC & ACTIONS
// ==========================================

// Add selected or dragged files to the queue.
function handleFilesInput(filesList) {
    // Loop through all files in the supplied FileList.
    for (let i = 0; i < filesList.length; i++) {
        // Add each file to the end of the queuedFiles array.
        queuedFiles.push(filesList[i]);
    }

    // Update the preview table to include the new files.
    renderPreviewWorkspace();
}

// Remove an individual file from the queue.
function removeIndividualFile(targetIndex) {
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
        clearBtn.style.display = 'none';

        // Stop here because there are no files to display.
        return;
    }

    // Show the Clear button and enable downloading when files exist.
    clearBtn.style.display = 'inline-block';
    downloadBtn.disabled = false;

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

        // Create a cell for the Remove button.
        const actionCell = document.createElement('td');
        actionCell.className = 'action-column';
        
        // Create a button that removes this file from the queue.
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-text-danger';
        deleteBtn.innerHTML = '&times; Remove';
        deleteBtn.setAttribute('title', 'Remove file from queue');
        
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
    if (queuedFiles.length === 0) return;
    
    // Make sure the JSZip library has been loaded before using it.
    if (typeof JSZip === 'undefined') {
        alert("Error: JSZip library was not found. Please verify that './lib/jszip.min.js' is placed correctly.");
        return;
    }
    
    // Disable the button to prevent repeated clicks while generating.
    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Generating Pack...';

    try {
        
        // Create a new JSZip archive instance.
        const zip = new JSZip();

        // Calculate the final filenames using the current settings.
        const safeNamesList = resolveAllNames();

        // Add each queued file to the ZIP using its new filename.
        // The file data is added without modifying its contents.
        for (let i = 0; i < queuedFiles.length; i++) {
            zip.file(safeNamesList[i], queuedFiles[i]);
        }

        // Generate the ZIP archive asynchronously as a Blob.
        // A Blob represents the archive data in the browser.
        const finalBlob = await zip.generateAsync({ type: 'blob' });
        
        // Create a temporary link element to initiate the download.
        const linkElement = document.createElement('a');
        
        // Use the user's ZIP filename, or a default if left blank.
        let customizedZipName = zipNameInput.value.trim() || 'renamed_files';
        
        // Create a temporary URL pointing to the generated ZIP data.
        linkElement.href = URL.createObjectURL(finalBlob);
        // Ensure the downloaded archive has the ".zip" extension.
        linkElement.download = customizedZipName.endsWith('.zip') ? customizedZipName : `${customizedZipName}.zip`;
        // Programmatically click the link to start the download.
        linkElement.click();
        
        // Schedule revocation of the temporary object URL shortly after
        // initiating the download to help release the associated resources.
        setTimeout(() => URL.revokeObjectURL(linkElement.href), 100);

    } catch (err) {
        // Log technical details to the console for debugging.
        console.error("ZIP pipeline failure:", err);
        // Show a user-friendly error message.
        alert("Error creating zip archive via JSZip.");
    } finally {
        // Re-enable the download button regardless of success or failure.
        downloadBtn.disabled = false;
        // Restore the default download button label and icon.
        downloadBtn.innerHTML = `<svg style="width:20px;height:20px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> Download Renamed Archive (.zip)`;
    }
}


// ==========================================
// 5. HELPER FUNCTIONS FOR FILENAME GENERATION
// ==========================================

// Calculate the new filename for a file based on the user's
// selected naming options and the file's position in the queue.
function computeNewName(file, index) {
    // Find the position of the last dot in the original filename.
    // This is used to separate the base filename from its extension.
    const lastDot = file.name.lastIndexOf('.');
    
    // Extract the base filename without the final extension.
    // If there is no dot, use the entire filename.
    let baseName = lastDot !== -1 ? file.name.substring(0, lastDot) : file.name;
    
    // Extract the extension, including the dot.
    // If there is no dot, use an empty string.
    const extension = lastDot !== -1 ? file.name.substring(lastDot) : '';

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

    // Append the original extension and return the new filename.
    return finalComputedString + extension;
}

function resolveAllNames() {
    const finalNames = [];
    
    // Track how many times each filename has been encountered.
    const nameCounts = {};

    queuedFiles.forEach((file, index) => {
        // Generate the filename using the current naming settings.
        let proposedName = computeNewName(file, index);
        
        // If the filename already exists, append a numbered suffix.
        if (nameCounts[proposedName]) {
            const lastDot = proposedName.lastIndexOf('.');
            const base = lastDot !== -1 ? proposedName.substring(0, lastDot) : proposedName;
            const ext = lastDot !== -1 ? proposedName.substring(lastDot) : '';
            
            // Find the next available numbered filename.
            let counter = 1;
            let adjustedName = `${base} (${counter})${ext}`;
            while (finalNames.includes(adjustedName)) {
                counter++;
                adjustedName = `${base} (${counter})${ext}`;
            }
            proposedName = adjustedName;
        }
        
        // Store the resolved filename and update the occurrence count.
        finalNames.push(proposedName);
        nameCounts[proposedName] = (nameCounts[proposedName] || 0) + 1;
    });

    // Return filenames in the same order as the queued files.
    return finalNames;
}





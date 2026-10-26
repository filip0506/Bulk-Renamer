# Bulk File Renamer

A lightweight, browser-based application for renaming multiple files and downloading them together in a ZIP archive.

Bulk File Renamer lets you customize filenames, preview changes before downloading, and package your renamed files into a single ZIP archive. File processing takes place locally in your browser.

## Features

- **Bulk file selection:** Select multiple files using the file picker or drag and drop them into the application.
- **Live filename preview:** Review proposed filenames before creating the ZIP archive.
- **Flexible naming options:**
  - Add a prefix.
  - Keep, replace, or clear the original filename.
  - Add a suffix.
  - Automatically number files using a prefix or suffix.
- **Filename validation:** Sanitize invalid filename characters, remove trailing spaces and dots, and handle reserved Windows device names.
- **Duplicate filename handling:** Resolve filename collisions using case-insensitive and Unicode-normalized comparisons.
- **ZIP archive creation:** Package renamed files into a single downloadable ZIP archive using JSZip.
- **Custom ZIP filename:** Choose the name of the downloaded archive.
- **Queue management:** Remove individual files or clear the entire queue.
- **Accessibility:** Keyboard-accessible upload controls, visible focus styling, and accessible status announcements.
- **No build tools required:** Run the application in a modern web browser without installing Node.js or npm.

## Technologies

- HTML5
- CSS3
- JavaScript
- [JSZip](<https://stuk.github.io/jszip/>) 3.10.2

## Project Structure

The project uses the following files and directories:

text

```
bulk-file-renamer/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── app.js
├── lib/
│   └── jszip.min.js
└── tests/
    ├── test.html
    └── app.test.js
```

The test directory names above assume your browser test files are stored in `tests/`. Adjust the paths if your actual project structure differs.

## Getting Started

### 1\. Download or clone the project

Obtain the project files and keep the directory structure intact.

### 2\. Verify the JSZip library

Ensure the bundled JSZip file exists at:

text

```
lib/jszip.min.js
```

The application loads this library directly from the local project.

### 3\. Launch the application

Open `index.html` in a modern web browser.

If your browser restricts local file access, run the project through a local static web server instead. No application build step is required.

## How to Use

1. **Add files:** Drag files into the upload area or use the file picker.
2. **Configure naming:** Choose a prefix, original-name behavior, suffix, and numbering option as needed.
3. **Review the preview:** Check the proposed filenames and confirm that the naming rules produce the intended results.
4. **Choose an archive name:** Enter a ZIP filename. The `.zip` extension is optional.
5. **Download:** Click **Download Renamed Archive (.zip)** and complete the browser's download process.
6. **Manage the queue:** Remove individual files or clear the queue to start again.

The original files are not renamed or overwritten on your computer. The application creates a ZIP archive containing the files under their proposed names.

## Filename Handling

The application applies filename sanitization and duplicate resolution before adding files to the ZIP archive.

- Invalid filename characters are replaced with underscores.
- Trailing spaces and dots are removed.
- Reserved Windows device names are prefixed with an underscore.
- Duplicate names are resolved by adding a numbered suffix before the final extension.
- Filename collision checks normalize Unicode to NFC and compare lowercase names.
- ZIP entry names are intended to remain flat rather than creating nested directories.

For example, duplicate filenames such as `report.txt` may become `report.txt` and `report (1).txt`.

The extension logic uses the final dot as the extension separator, except when the dot is the first character. Compound extensions such as `.tar.gz` are therefore not treated as a single extension unit.

## Privacy

Files are processed in the browser and packaged locally using JSZip. The application does not intentionally upload selected file contents to a server.

This describes the application's intended behavior; any additional scripts or hosting integrations should be reviewed separately if you need to verify network activity.

## Testing

The project includes a browser-based regression test suite that does not require Node.js or npm.

To run it:

1. Open `tests/test.html` in a browser.
2. Run the available tests.
3. Confirm that the results show all tests passing.

The reported test suite has passed **16 tests with 0 failures**. Coverage includes filename generation, duplicate handling, sanitization, ZIP entry names and content integrity, drag-and-drop behavior, and recovery from generation failures.

After modifying the application, rerun the test suite and manually verify the affected workflows.

## Known Limitations

- Native browser download completion cannot be reliably detected by the application.
- Browser compatibility and download behavior have not been exhaustively verified across different browsers.
- Very large files or batches may require substantial browser memory while the ZIP archive is generated.
- The project does not currently provide a Node.js-based build, lint, or test workflow.

## Contributing

When modifying the application:

- Preserve the existing interface and functionality unless a change is necessary.
- Prefer focused, minimal changes over a complete rewrite.
- Add regression tests for bug fixes and new behavior.
- Run the browser test suite after making changes.
- Review the final diff to ensure that unrelated files and features have not been changed.

## License

This project is licensed under the **Apache License 2.0** - see the [LICENSE](LICENSE) file for details.

### Third-Party Components

This project redistributes the following third-party software:

* **JSZip** - Licensed under the MIT License. See [libs/jszip-LICENSE.txt](libs/jszip-LICENSE.txt) for the full license text and copyright notice.

import { useState } from 'react';
import './AddDocumentModal.css';

function AddDocumentModal({ isOpen, onClose, onSave, parentName }) {
    const [docName, setDocName] = useState('');
    const [docType, setDocType] = useState('blank'); // 'blank', 'link', 'upload'
    const [filePath, setFilePath] = useState(''); // For 'link' type, just filename e.g. "myfile.md"
    const [localFile, setLocalFile] = useState(null); // For 'upload' type
    const [fileError, setFileError] = useState('');

    if (!isOpen) {
        return null;
    }

    const resetForm = () => {
        setDocName('');
        setDocType('blank');
        setFilePath('');
        setLocalFile(null);
        setFileError('');
        const fileInput = document.getElementById('localFileUploader');
        if (fileInput) fileInput.value = ''; // Reset file input
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleSave = async () => {
        if (!docName.trim()) {
            alert('Document name is required.');
            return;
        }

        let newDocData = {
            name: docName.trim(),
            type: 'document',
            isMarkdownContent: false, // Default, will be updated
            docSourceType: docType, // To inform App.jsx how to handle it (e.g., upload needed)
        };

        if (docType === 'blank') {
            newDocData.content = '<h1>New Document</h1><p>Start editing your content here.</p>';
            // isMarkdownContent remains false (assuming HTML)
        } else if (docType === 'link') {
            const trimmedFilePath = filePath.trim();
            if (!trimmedFilePath || !/^[a-zA-Z0-9_.-]+\.(md|html)$/i.test(trimmedFilePath)) {
                alert('Valid filename (e.g., myfile.md or myfile.html) is required for linking.');
                return;
            }
            newDocData.filePath = trimmedFilePath;
            if (trimmedFilePath.endsWith('.md')) {
                newDocData.isMarkdownContent = true;
            }
        } else if (docType === 'upload') {
            if (!localFile) {
                setFileError('Please select a file to upload.');
                return;
            }
            // Validation for .md or .html already happened in handleFileChange

            // For upload, App.jsx will handle the actual upload.
            // We pass the file object.
            newDocData.fileToUpload = localFile;
            if (localFile.name.endsWith('.md')) {
                newDocData.isMarkdownContent = true;
            }
            // Optionally, read content client-side for immediate optimistic update, though backend will manage the file.
            // This part can be simplified if App.jsx handles file reading after upload confirmation
            try {
                 const fileContent = await readFileContent(localFile);
                 newDocData.content = fileContent; // Temporary content for optimistic update or if backend stores it directly
            } catch (error) {
                console.error("Error reading file for optimistic update:", error);
                // Decide if this is critical. Usually, filePath is enough for uploaded files.
            }
        }

        onSave(newDocData); // Pass to App.jsx which now handles API interaction
        handleClose();
    };
    
    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            if (!file.name.endsWith('.md') && !file.name.endsWith('.html')) {
                setFileError('Please select a .md or .html file.');
                setLocalFile(null);
                event.target.value = ''; // Reset file input
                return;
            }
            setLocalFile(file);
            setFileError('');
        } else {
            setLocalFile(null);
        }
    };

    const readFileContent = (file) => { // This remains for cases where client needs content before API call
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = (error) => reject(error);
            reader.readAsText(file);
        });
    };


    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-content add-doc-modal" onClick={(e) => e.stopPropagation()}>
                <h2>Add New Document {parentName ? `to '${parentName}'` : ''}</h2>

                <div className="form-group">
                    <label htmlFor="docName">Document Name:</label>
                    <input
                        type="text"
                        id="docName"
                        value={docName}
                        onChange={(e) => setDocName(e.target.value)}
                        placeholder="My Awesome Document"
                    />
                </div>

                <div className="form-group">
                    <label>Document Type:</label>
                    <div>
                        <label className="radio-label">
                            <input type="radio" name="docType" value="blank" checked={docType === 'blank'} onChange={(e) => setDocType(e.target.value)} /> New Blank Document
                        </label>
                        <label className="radio-label">
                            <input type="radio" name="docType" value="link" checked={docType === 'link'} onChange={(e) => setDocType(e.target.value)} /> Link to Existing System File
                        </label>
                        <label className="radio-label">
                            <input type="radio" name="docType" value="upload" checked={docType === 'upload'} onChange={(e) => setDocType(e.target.value)} /> Create from Local File (Upload)
                        </label>
                    </div>
                </div>

                {docType === 'link' && (
                    <div className="form-group">
                        <label htmlFor="filePath">Filename in System (.md or .html):</label>
                        <input
                            type="text"
                            id="filePath"
                            value={filePath}
                            onChange={(e) => setFilePath(e.target.value)}
                            placeholder="example.md or another-doc.html"
                        />
                        <small>Enter the filename of a document managed by this system (e.g., `intro.md`).</small>
                    </div>
                )}

                {docType === 'upload' && (
                    <div className="form-group">
                        <label htmlFor="localFileUploader">Select Local File (.md or .html):</label>
                        <input
                            type="file"
                            id="localFileUploader"
                            accept=".md,.html,text/markdown,text/html"
                            onChange={handleFileChange}
                        />
                        {fileError && <p className="error-message">{fileError}</p>}
                    </div>
                )}


                <div className="modal-actions">
                    <button onClick={handleSave} className="save-btn">Add Document</button>
                    <button onClick={handleClose} className="cancel-btn">Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default AddDocumentModal;

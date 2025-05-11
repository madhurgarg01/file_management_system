// src/EditModal.jsx
import { useState, useEffect } from 'react';
import './EditModal.css'; // We'll create this CSS file next

function EditModal({ isOpen, onClose, initialContent, onSave, documentName }) {
    const [content, setContent] = useState(initialContent);

    useEffect(() => {
        setContent(initialContent); // Update content if the initialContent prop changes
    }, [initialContent, isOpen]);

    if (!isOpen) {
        return null;
    }

    const handleSave = () => {
        onSave(content);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>Edit: {documentName}</h2>
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows="20"
                    cols="80"
                />
                <div className="modal-actions">
                    <button onClick={handleSave} className="save-btn">Save</button>
                    <button onClick={onClose} className="cancel-btn">Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default EditModal;
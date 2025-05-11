import { useState, useEffect, useCallback } from 'react';
import { marked } from 'marked';
import { v4 as uuidv4 } from 'uuid'; // Import uuid
import './App.css';
import EditModal from './EditModal';
import AddDocumentModal from './AddDocumentModal';

// --- Helper function for IDs (using uuid) ---
function generateId() {
    return uuidv4();
}

// Initial Data is now fetched from backend
// const initialData = [...];

// --- Recursive CategoryItem Component (remains the same) ---
function CategoryItem({ item, level, onSelectItem, onShowContextMenu, activeItemId }) {
    const [isExpanded, setIsExpanded] = useState(true);

    const handleToggleExpand = (e) => {
        e.stopPropagation();
        if (item.type === 'category') {
            setIsExpanded(!isExpanded);
        }
    };

    const itemStyle = {
        paddingLeft: `${5 + level * 20}px`,
    };

    return (
        <>
            <li
                data-id={item.id}
                style={itemStyle}
                className={item.id === activeItemId ? 'active' : ''}
            >
                <span className="item-name" onClick={() => onSelectItem(item.id)}>
                    {item.type === 'category' && (
                        <span onClick={handleToggleExpand} style={{ cursor: 'pointer', marginRight: '5px' }}>
                            {isExpanded ? '▼' : '►'}
                        </span>
                    )}
                    {item.type === 'category' ? '📁' : '📄'} {item.name}
                </span>
                <button
                    className="options-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        onShowContextMenu(e, item.id, item.type);
                    }}
                >
                    ⋮
                </button>
            </li>
            {item.type === 'category' && isExpanded && item.children && item.children.length > 0 && (
                <ul style={{ padding: 0, margin: 0 }}>
                    {item.children.sort((a,b) => a.name.localeCompare(b.name)).map(child => (
                        <CategoryItem
                            key={child.id}
                            item={child}
                            level={level + 1}
                            onSelectItem={onSelectItem}
                            onShowContextMenu={onShowContextMenu}
                            activeItemId={activeItemId}
                        />
                    ))}
                </ul>
            )}
        </>
    );
}


// --- Main App Component ---
function App() {
    const [data, setData] = useState([]); // Initial data is empty, will be fetched
    const [activeItemId, setActiveItemId] = useState(null);
    const [activeDocumentContent, setActiveDocumentContent] = useState('');
    const [isLoadingContent, setIsLoadingContent] = useState(false);
    const [isLoadingStructure, setIsLoadingStructure] = useState(true);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingDocument, setEditingDocument] = useState(null);
    const [isAddDocumentModalOpen, setIsAddDocumentModalOpen] = useState(false);
    const [addDocumentParentInfo, setAddDocumentParentInfo] = useState({ id: null, name: '' });

    const [contextMenu, setContextMenu] = useState({
        visible: false, x: 0, y: 0, targetId: null, itemType: null,
    });

    const selectedItem = activeItemId ? findItemById(data, activeItemId) : null;

    // --- Utility Functions (findItemById remains mostly the same) ---
    function findItemById(items, id) {
        for (const item of items) {
            if (item.id === id) return item;
            if (item.children && item.children.length > 0) {
                const foundInChildren = findItemById(item.children, id);
                if (foundInChildren) return foundInChildren;
            }
        }
        return null;
    }
    
    // Fetch initial structure
    useEffect(() => {
        const fetchStructure = async () => {
            try {
                setIsLoadingStructure(true);
                const response = await fetch('/api/structure');
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const fetchedData = await response.json();
                setData(fetchedData);
                // Auto-select first document or category after data is loaded
                if (fetchedData.length > 0 && !activeItemId) {
                    const firstDoc = fetchedData.find(item => item.type === 'document') ||
                                     (fetchedData[0].type === 'category' && fetchedData[0].children && fetchedData[0].children.find(child => child.type === 'document'));
                    if (firstDoc) setActiveItemId(firstDoc.id);
                    else if (fetchedData[0]) setActiveItemId(fetchedData[0].id);
                }
            } catch (error) {
                console.error("Error fetching initial structure:", error);
                setActiveDocumentContent(`<p style="color:red;">Error loading site structure. Check console and backend. ${error.message}</p>`);
                // Optionally set some default data or error state for data
                setData([]);
            } finally {
                setIsLoadingStructure(false);
            }
        };
        fetchStructure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once on mount


    // --- Content Fetching and Handling ---
    useEffect(() => {
        if (selectedItem && selectedItem.type === 'document') {
            setIsLoadingContent(true);
            setActiveDocumentContent('');

            if (selectedItem.content) { // Inline content
                if (selectedItem.isMarkdownContent) {
                    setActiveDocumentContent(marked.parse(selectedItem.content));
                } else {
                    setActiveDocumentContent(selectedItem.content);
                }
                setIsLoadingContent(false);
            } else if (selectedItem.filePath) { // File-based content
                // Fetch from backend using the filePath which is just the filename
                fetch(`/api/files/${encodeURIComponent(selectedItem.filePath)}`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status} for /api/files/${selectedItem.filePath}`);
                        }
                        return response.text();
                    })
                    .then(text => {
                        if (selectedItem.filePath.endsWith('.md') || selectedItem.isMarkdownContent) {
                            setActiveDocumentContent(marked.parse(text));
                        } else {
                            setActiveDocumentContent(text);
                        }
                        // Optionally cache fetched content into the item in `data` state if needed for editing
                        // This would require updating the 'data' state here
                    })
                    .catch(error => {
                        console.error("Error fetching document content from API:", error);
                        setActiveDocumentContent(`<p style="color:red;">Error loading content for ${selectedItem.name} from ${selectedItem.filePath}. Check console.</p>`);
                    })
                    .finally(() => setIsLoadingContent(false));
            } else {
                setActiveDocumentContent('<p>No content or file path defined for this document.</p>');
                setIsLoadingContent(false);
            }
        } else if (selectedItem && selectedItem.type === 'category') {
             setActiveDocumentContent(`<p>This is the '<strong>${selectedItem.name}</strong>' category. Select a document or add a sub-item.</p>`);
             setIsLoadingContent(false);
        } else if (!isLoadingStructure) { // Only show if not initial loading
            setActiveDocumentContent('<p>Select an item from the sidebar.</p>');
            setIsLoadingContent(false);
        }
    }, [selectedItem, isLoadingStructure]); // Rerun when selectedItem changes or initial structure load finishes


    // --- Event Handlers ---
    const handleSelectItem = (itemId) => {
        setActiveItemId(itemId);
        setIsEditModalOpen(false); // Close edit modal if open
        handleHideContextMenu(); // Close context menu
    };

    const handleShowContextMenu = (event, itemId, itemType) => {
        event.preventDefault();
        setContextMenu({ visible: true, x: event.pageX, y: event.pageY, targetId: itemId, itemType: itemType });
    };

    const handleHideContextMenu = useCallback(() => {
        setContextMenu(prev => ({ ...prev, visible: false }));
    }, []);

    useEffect(() => {
        if (contextMenu.visible) {
            document.addEventListener('click', handleHideContextMenu);
            return () => document.removeEventListener('click', handleHideContextMenu);
        }
    }, [contextMenu.visible, handleHideContextMenu]);


    const openAddDocumentModal = (parentId = null) => {
        const parentItem = parentId ? findItemById(data, parentId) : null;
        setAddDocumentParentInfo({ id: parentId, name: parentItem ? parentItem.name : '' });
        setIsAddDocumentModalOpen(true);
        handleHideContextMenu();
    };

    const handleSaveNewDocument = async (newDocDataFromModal) => {
        const newItemId = generateId(); // Generate ID on client
        let itemToAdd = {
            id: newItemId,
            ...newDocDataFromModal, // name, type, content/filePath, isMarkdownContent
            children: [] // if it's a document
        };

        if (newDocDataFromModal.type === 'document' && newDocDataFromModal.docSourceType === 'upload') {
            // File needs to be uploaded first
            const formData = new FormData();
            formData.append('documentFile', newDocDataFromModal.fileToUpload); // fileToUpload added in AddDocumentModal
            try {
                const uploadResponse = await fetch('/api/upload', { method: 'POST', body: formData });
                if (!uploadResponse.ok) throw new Error('File upload failed');
                const uploadResult = await uploadResponse.json();
                
                itemToAdd.filePath = uploadResult.filePath; // Use backend-generated filePath
                delete itemToAdd.fileToUpload; // Clean up
                delete itemToAdd.docSourceType; // Clean up
                // content for uploaded files is typically not stored in structure.json, only filePath
                // but current AddDocumentModal reads content; let's align
                // If content was read on client for immediate display:
                // itemToAdd.content = newDocDataFromModal.content; // if we want to keep client-read content temporarily
                // OR rely on fetching from itemToAdd.filePath
                // For consistency, if it's an upload, it becomes a filePath doc.
                // The AddDocumentModal's `readFileContent` is for `newDocData.content`
                // If we store content directly for uploads (like AddDocumentModal does):
                // itemToAdd.content = newDocDataFromModal.content; (already there)
                // itemToAdd.filePath = undefined; // If content is primary
                // OR backend saves content from upload and returns it.
                // Let's stick to: upload creates a file, referenced by filePath.
                // The AddDocumentModal's onSave provides 'content' if uploaded.
                // We can choose: either store this content OR rely on filePath.
                // For uploaded files, it's better to rely on filePath.
                // So, remove content if filePath is set from upload.
                if (itemToAdd.filePath) {
                    delete itemToAdd.content;
                }

            } catch (error) {
                console.error('Error uploading file:', error);
                alert(`Failed to upload file: ${error.message}`);
                return;
            }
        } else if (newDocDataFromModal.docSourceType === 'link') {
             // filePath is already set in newDocDataFromModal
             // content should be undefined for linked files initially
             delete itemToAdd.content;
        }
        // Clean up docSourceType if it exists
        if (itemToAdd.docSourceType) delete itemToAdd.docSourceType;


        try {
            const response = await fetch('/api/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ parentId: addDocumentParentInfo.id, itemData: itemToAdd }),
            });
            if (!response.ok) throw new Error('Failed to save document on server');
            
            // Optimistically update UI or re-fetch structure
            // For simplicity, re-fetch structure, or merge based on response
            const updatedStructure = await fetch('/api/structure').then(res => res.json());
            setData(updatedStructure);
            handleSelectItem(newItemId); // Select the new item
        } catch (error) {
            console.error('Error saving new document:', error);
            alert(`Failed to save document: ${error.message}`);
        }
    };

    const handleAddItem = async (parentId = null, type = 'category') => {
        if (type === 'document') {
            openAddDocumentModal(parentId);
            return;
        }

        const name = prompt(`Enter name for new ${type}:`);
        if (!name) return;

        const newItem = {
            id: generateId(), name, type,
            ...(type === 'category' ? { children: [] } : {}),
            // For documents, other fields (content/filePath) handled by AddDocumentModal
        };

        try {
            const response = await fetch('/api/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ parentId, itemData: newItem }),
            });
            if (!response.ok) throw new Error('Failed to add item on server');
            
            const updatedStructure = await fetch('/api/structure').then(res => res.json());
            setData(updatedStructure);
            if (type === 'document') handleSelectItem(newItem.id); // Select if it was a document
        } catch (error) {
            console.error('Error adding item:', error);
            alert(`Failed to add item: ${error.message}`);
        }
        handleHideContextMenu();
    };

    const handleRenameItem = async () => {
        const { targetId } = contextMenu; if (!targetId) return;
        const item = findItemById(data, targetId); if (!item) return;
        const newName = prompt('Enter new name:', item.name);
        if (newName && newName.trim() && newName !== item.name) {
            try {
                const response = await fetch(`/api/items/${targetId}/rename`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newName: newName.trim() }),
                });
                if (!response.ok) throw new Error('Failed to rename item on server');
                
                const updatedStructure = await fetch('/api/structure').then(res => res.json());
                setData(updatedStructure);
                // If active item was renamed, its name in header will update due to re-render
            } catch (error) {
                console.error('Error renaming item:', error);
                alert(`Failed to rename item: ${error.message}`);
            }
        }
        handleHideContextMenu();
    };

    const handleDeleteItem = async () => {
        const { targetId } = contextMenu; if (!targetId) return;
        if (!confirm('Are you sure you want to delete this item and all its children (if any)? This may also delete associated files.')) {
            handleHideContextMenu(); return;
        }
        try {
            const response = await fetch(`/api/items/${targetId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete item on server');
            
            const updatedStructure = await fetch('/api/structure').then(res => res.json());
            setData(updatedStructure);

            if (activeItemId === targetId) {
                setActiveItemId(null); // Deselect if the active item was deleted
                // Optionally, select the first available item or parent
            }
        } catch (error) {
            console.error('Error deleting item:', error);
            alert(`Failed to delete item: ${error.message}`);
        }
        handleHideContextMenu();
    };

    const handleOpenEditModal = async () => {
        if (selectedItem && selectedItem.type === 'document') {
            let contentToEdit = selectedItem.content || '';
            let isMarkdown = selectedItem.isMarkdownContent || false;

            if (selectedItem.filePath && !selectedItem.content) { // If content is not already in state from a previous load/edit
                try {
                    setIsLoadingContent(true);
                    const response = await fetch(`/api/files/${encodeURIComponent(selectedItem.filePath)}`);
                    if (!response.ok) throw new Error(`Failed to fetch raw content for editing: ${selectedItem.filePath}`);
                    contentToEdit = await response.text();
                    isMarkdown = selectedItem.filePath.endsWith('.md') || selectedItem.isMarkdownContent;
                } catch (error) {
                    console.error("Error fetching raw document for edit:", error);
                    alert(`Could not load the original file content for editing: ${error.message}. Editing current view or a blank slate.`);
                    // Fallback: activeDocumentContent might be HTML. For MD, this is bad.
                    // A better fallback would be to ensure 'contentToEdit' is raw.
                    // For now, this uses what's available or previously fetched raw text.
                    // If activeDocumentContent is parsed HTML of MD, this is not ideal.
                    // It's better if loading for view also stores raw text in `data` state.
                    // For this iteration, we assume `contentToEdit` is raw if fetched here.
                } finally {
                    setIsLoadingContent(false);
                }
            }

            setEditingDocument({
                id: selectedItem.id,
                name: selectedItem.name,
                content: contentToEdit,
                originalIsMarkdown: isMarkdown,
            });
            setIsEditModalOpen(true);
        }
        handleHideContextMenu();
    };

    const handleCloseEditModal = () => {
        setIsEditModalOpen(false);
        setEditingDocument(null);
    };

    const handleSaveEditedDocument = async (newContent) => {
        if (!editingDocument || !editingDocument.id) return;
        try {
            const response = await fetch(`/api/documents/${editingDocument.id}/content`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    content: newContent, 
                    isMarkdownContent: editingDocument.originalIsMarkdown 
                }),
            });
            if (!response.ok) throw new Error('Failed to save document content on server');
            
            const updatedStructure = await fetch('/api/structure').then(res => res.json());
            setData(updatedStructure);
            // The active document content will re-render due to `selectedItem` potentially changing
            // and `useEffect` for content display running again.
        } catch (error) {
            console.error('Error saving edited document:', error);
            alert(`Failed to save document: ${error.message}`);
        }
        handleCloseEditModal();
    };
    

    if (isLoadingStructure) {
        return <div className="app-container" style={{justifyContent: 'center', alignItems: 'center'}}><h2>Loading Documentation System...</h2></div>;
    }

    return (
        <div className="app-container">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h2>DOCUMENTATION</h2>
                    <button onClick={() => handleAddItem(null, 'category')} title="Add Top-Level Category">+</button>
                </div>
                {data.length === 0 && !isLoadingStructure ? (
                     <p style={{padding: '10px', color: '#555'}}>No categories or documents yet. Click '+' to add a category.</p>
                ) : (
                    <ul id="categoryTree" className="category-tree">
                        {data.sort((a,b) => a.name.localeCompare(b.name)).map(item => (
                            <CategoryItem
                                key={item.id}
                                item={item}
                                level={0}
                                onSelectItem={handleSelectItem}
                                onShowContextMenu={handleShowContextMenu}
                                activeItemId={activeItemId}
                            />
                        ))}
                    </ul>
                )}
                <div className="quick-tips">
                    <h4>⚡ Quick Tips</h4>
                    <ul>
                        <li>Click '⋮' on items for options.</li>
                        <li>Click category/document names to view.</li>
                    </ul>
                </div>
            </aside>

            <main className="content-pane">
                <div className="content-header">
                    <h1>{selectedItem ? selectedItem.name : 'Select an item'}</h1>
                    {selectedItem && selectedItem.type === 'document' && selectedItem.lastUpdated && (
                        <p id="documentLastUpdated">Last updated: {new Date(selectedItem.lastUpdated).toLocaleDateString()}</p>
                    )}
                    {selectedItem && selectedItem.type === 'document' && (
                        <button id="editDocumentBtn" onClick={handleOpenEditModal}>Edit</button>
                    )}
                </div>

                {isLoadingContent ? (
                    <p>Loading content...</p>
                ) : (
                    <div
                        id="documentContent"
                        className="document-body"
                        dangerouslySetInnerHTML={{ __html: activeDocumentContent }}
                    />
                )}
            </main>

            {contextMenu.visible && (
                <div
                    id="contextMenu" className="context-menu"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()} // Prevent click from closing itself
                >
                    <div className="context-menu-item" onClick={handleRenameItem}>Rename</div>
                    {contextMenu.itemType === 'category' && (
                        <>
                            <div className="context-menu-item" onClick={() => handleAddItem(contextMenu.targetId, 'category')}>Add Subcategory</div>
                            <div className="context-menu-item" onClick={() => handleAddItem(contextMenu.targetId, 'document')}>Add Document</div>
                        </>
                    )}
                    {/* Edit option can also be here, but it's on header too */}
                    {/* contextMenu.itemType === 'document' && (
                        <div className="context-menu-item" onClick={handleOpenEditModal}>Edit Document</div>
                    )*/}
                    <div className="context-menu-item delete" onClick={handleDeleteItem}>Delete</div>
                </div>
            )}

            {editingDocument && (
                <EditModal
                    isOpen={isEditModalOpen}
                    onClose={handleCloseEditModal}
                    initialContent={editingDocument.content}
                    onSave={handleSaveEditedDocument}
                    documentName={editingDocument.name}
                />
            )}

            <AddDocumentModal
                isOpen={isAddDocumentModalOpen}
                onClose={() => setIsAddDocumentModalOpen(false)}
                onSave={handleSaveNewDocument} // This will now be async and handle API calls
                parentName={addDocumentParentInfo.name}
            />
        </div>
    );
}

export default App;
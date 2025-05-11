const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
require('dotenv').config();

const router = express.Router();

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DOCUMENTS_SUBDIR = process.env.DOCUMENTS_SUBDIR || 'documents';
const STRUCTURE_FILE = process.env.STRUCTURE_FILE || 'structure.json';

const structureFilePath = path.join(DATA_DIR, STRUCTURE_FILE);
const documentsPath = path.join(DATA_DIR, DOCUMENTS_SUBDIR);

fs.ensureDirSync(documentsPath); // Ensure documents directory exists

// Helper function to read structure data
const readStructure = async () => {
    try {
        const data = await fs.readJson(structureFilePath);
        return data;
    } catch (error) {
        // If file doesn't exist or is not valid JSON, return default
        console.warn('structure.json not found or invalid, returning default structure.');
        return [
             { id: '1', name: 'Introduction', type: 'document', filePath: 'introduction.md', lastUpdated: new Date().toISOString(), children: [], isMarkdownContent: true },
             { id: '2', name: 'EC2 Instances', type: 'category', children: [
                 { id: '2.1', name: 'Overview', type: 'document', filePath: 'ec2-overview.html', lastUpdated: new Date().toISOString(), children: [], isMarkdownContent: false },
                 { id: '2.2', name: 'Getting Started', type: 'document', filePath: 'getting-started-ec2.md', lastUpdated: new Date().toISOString(), children: [], isMarkdownContent: true }
             ]},
             { id: '3', name: 'S3 Buckets', type: 'document', filePath: 's3-storage.html', lastUpdated: new Date().toISOString(), children: [], isMarkdownContent: false },
             { id: "new_doc_example", name: "My New Doc (Inline)", type: "document", content: "<h1>Inline Content</h1><p>This content is directly in the data.</p>", lastUpdated: new Date().toISOString(), children: [], isMarkdownContent: false }
        ];
    }
};

// Helper function to write structure data
const writeStructure = async (data) => {
    await fs.writeJson(structureFilePath, data, { spaces: 2 });
};

// Recursive helper to find and update/delete item
const findAndModify = (items, targetId, actionFn) => {
    let itemFound = false;
    const newItems = items.reduce((acc, item) => {
        if (item.id === targetId) {
            itemFound = true;
            const modified = actionFn(item, true); // true indicates direct match
            if (modified) acc.push(modified); // Add if not deleted
            return acc;
        }
        if (item.children) {
            const [modifiedChildren, childFound] = findAndModify(item.children, targetId, actionFn);
            if (childFound) itemFound = true;
            item.children = modifiedChildren;
        }
        acc.push(item);
        return acc;
    }, []);
    return [newItems, itemFound];
};

// --- Structure Routes ---
router.get('/structure', async (req, res) => {
    try {
        const structure = await readStructure();
        res.json(structure);
    } catch (error) {
        res.status(500).json({ message: 'Error reading structure', error: error.message });
    }
});

// --- Item (Category/Document) Routes ---
// Add item (category or document)
router.post('/items', async (req, res) => {
    try {
        const { parentId, itemData } = req.body; // itemData includes id, name, type, content/filePath, etc.
        if (!itemData || !itemData.id || !itemData.name || !itemData.type) {
            return res.status(400).json({ message: 'Missing item data fields (id, name, type are required)' });
        }
        itemData.lastUpdated = new Date().toISOString();
        if (itemData.type === 'category' && !itemData.children) {
            itemData.children = [];
        }

        let structure = await readStructure();
        if (parentId) {
             const [, found] = findAndModify(structure, parentId, (parent) => {
                if (parent.type === 'category') {
                    parent.children = [...(parent.children || []), itemData].sort((a,b) => a.name.localeCompare(b.name));
                }
                return parent;
            });
            if (!found) return res.status(404).json({ message: 'Parent category not found' });
        } else {
            structure.push(itemData);
            structure.sort((a,b) => a.name.localeCompare(b.name));
        }
        await writeStructure(structure);
        res.status(201).json(itemData); // Or return the whole structure: res.json(structure)
    } catch (error) {
        res.status(500).json({ message: 'Error adding item', error: error.message });
    }
});

// Rename item
router.put('/items/:id/rename', async (req, res) => {
    try {
        const { id } = req.params;
        const { newName } = req.body;
        if (!newName) return res.status(400).json({ message: 'New name is required' });

        let structure = await readStructure();
        const [, found] = findAndModify(structure, id, (item) => {
            item.name = newName;
            item.lastUpdated = new Date().toISOString();
            return item;
        });

        if (!found) return res.status(404).json({ message: 'Item not found' });
        await writeStructure(structure);
        res.json({ message: 'Item renamed successfully', id, newName }); // or return updated item/structure
    } catch (error) {
        res.status(500).json({ message: 'Error renaming item', error: error.message });
    }
});

// Update document content (when editing)
router.put('/documents/:id/content', async (req, res) => {
    try {
        const { id } = req.params;
        const { content, isMarkdownContent } = req.body; // isMarkdownContent should be passed from client
        if (content === undefined) return res.status(400).json({ message: 'Content is required' });

        let structure = await readStructure();
        const [, found] = findAndModify(structure, id, (item) => {
            if (item.type === 'document') {
                item.content = content;
                item.filePath = undefined; // Content is now inline
                item.isMarkdownContent = !!isMarkdownContent;
                item.lastUpdated = new Date().toISOString();
            }
            return item;
        });

        if (!found) return res.status(404).json({ message: 'Document not found' });
        await writeStructure(structure);
        res.json({ message: 'Document content updated successfully', id });
    } catch (error) {
        res.status(500).json({ message: 'Error updating document content', error: error.message });
    }
});


// Delete item
router.delete('/items/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let structure = await readStructure();
        let deletedItem = null;

        // Find the item to get its filePath if it's a document with a file
         const findItem = (items, itemId) => {
             for (const item of items) {
                 if (item.id === itemId) return item;
                 if (item.children) {
                     const found = findItem(item.children, itemId);
                     if (found) return found;
                 }
             }
             return null;
         };
         deletedItem = findItem(structure, id);

        const [newStructure, found] = findAndModify(structure, id, () => null); // Return null to delete

        if (!found) return res.status(404).json({ message: 'Item not found' });

        // If deleted item was a document with a filePath (and not inline content), delete its file
        if (deletedItem && deletedItem.type === 'document' && deletedItem.filePath && !deletedItem.content) {
            const filePathToDelete = path.join(documentsPath, deletedItem.filePath);
            if (await fs.pathExists(filePathToDelete)) {
                await fs.remove(filePathToDelete);
                console.log(`Deleted file: ${filePathToDelete}`);
            }
        }
        
        await writeStructure(newStructure);
        res.json({ message: 'Item deleted successfully', id });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting item', error: error.message });
    }
});

// --- File Upload Route ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, documentsPath);
    },
    filename: (req, file, cb) => {
        // Sanitize filename, ensure uniqueness
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, extension).replace(/[^a-z0-9_.-]/gi, '_');
        cb(null, `${baseName}-${uniqueSuffix}${extension}`);
    }
});
const upload = multer({ storage: storage });

router.post('/upload', upload.single('documentFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).send({ message: 'No file uploaded.' });
    }
    // File is saved by multer. Return its path relative to the documentsPath
    res.status(201).json({
        message: 'File uploaded successfully',
        filePath: req.file.filename, // This is the filename in backend/data/documents/
        originalName: req.file.originalname
    });
});

module.exports = router;
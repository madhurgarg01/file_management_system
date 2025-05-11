const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const apiRoutes = require('./routes/api');
require('dotenv').config(); // If you use a .env file

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', apiRoutes);

// Serve static documents (e.g., uploaded files)
const documentsDir = path.join(__dirname, process.env.DATA_DIR || 'data', process.env.DOCUMENTS_SUBDIR || 'documents');
app.use('/api/files', express.static(documentsDir)); // Allows GET /api/files/filename.md

// Basic error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send({ message: 'Something broke!', error: err.message });
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
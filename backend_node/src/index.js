const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt_token = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const { initDb, User, File, Permission, Log } = require('./db');
const { generateKey, encryptFileData, decryptFileData } = require('./aes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret@securevault';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // for OAuth2 password grant compatibility

const upload = multer({ storage: multer.memoryStorage() });

const storageDir = path.join(__dirname, '..', 'storage_data');
if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir);
}

const logAction = async (userId, action) => {
    try {
        const logId = uuidv4();
        await Log.create({ log_id: logId, user_id: userId, action });
    } catch (err) {
        console.error('[Logs] Error logging action:', err);
    }
};

// Middleware to verify JWT
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ detail: 'Invalid token' });

    try {
        const payload = jwt_token.verify(token, JWT_SECRET);
        const user = await User.findOne({ email: payload.sub });
        if (!user) return res.status(401).json({ detail: 'User not found' });
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ detail: 'Invalid token' });
    }
};

app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ detail: 'Email already registered' });

        const passwordHash = await bcrypt.hash(password, 10);
        const userId = uuidv4();
        await User.create({
            user_id: userId,
            name,
            email,
            password_hash: passwordHash,
            role
        });

        await logAction(userId, 'User registration');
        res.json({ user_id: userId, name, email, role });
    } catch (err) {
        res.status(500).json({ detail: 'Server error' });
    }
});

// Using x-www-form-urlencoded to match FastAPI OAuth2 implementation
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ email: username });
        if (!user) return res.status(400).json({ detail: 'Incorrect email or password' });

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(400).json({ detail: 'Incorrect email or password' });

        const token = jwt_token.sign({ sub: user.email, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
        await logAction(user.user_id, 'User login');
        res.json({
            access_token: token,
            token_type: 'bearer',
            user: { user_id: user.user_id, role: user.role, name: user.name }
        });
    } catch (err) {
        res.status(500).json({ detail: 'Server error' });
    }
});

app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ detail: 'No file uploaded' });

        const user = req.user;
        const encryptionKey = generateKey();
        const encryptedData = encryptFileData(file.buffer, encryptionKey);
        const fileId = uuidv4();

        const filePath = path.join(storageDir, `${file.originalname}_${user.user_id}.enc`);
        fs.writeFileSync(filePath, encryptedData);

        await File.create({
            file_id: fileId,
            file_name: file.originalname,
            owner_id: user.user_id,
            encrypted_path: filePath,
            encryption_key: encryptionKey
        });

        await logAction(user.user_id, `Uploaded file ${file.originalname}`);
        res.json({ success: true, file_id: fileId, message: 'File uploaded and encrypted' });
    } catch (err) {
        res.status(500).json({ detail: 'Server error' });
    }
});

app.get('/api/files', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        let files = [];
        if (user.role === 'admin') {
            files = await File.find({});
        } else {
            const userPermissions = await Permission.find({ user_id: user.user_id });
            const allowedFileIds = userPermissions.map(p => p.file_id);
            files = await File.find({
                $or: [
                    { owner_id: user.user_id },
                    { file_id: { $in: allowedFileIds } }
                ]
            });
        }
        res.json(files.map(f => ({ file_id: f.file_id, file_name: f.file_name, upload_date: f.upload_date, owner_id: f.owner_id })));
    } catch (err) {
        res.status(500).json({ detail: 'Server error' });
    }
});

app.get('/api/download/:file_id', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        const fileId = req.params.file_id;
        const fileRecord = await File.findOne({ file_id: fileId });
        if (!fileRecord) return res.status(404).json({ detail: 'File not found' });

        let hasAccess = false;
        if (user.role === 'admin' || fileRecord.owner_id === user.user_id) {
            hasAccess = true;
        } else {
            const permission = await Permission.findOne({
                file_id: fileId,
                user_id: user.user_id,
                permission_type: { $in: ['view', 'download', 'edit'] }
            });
            if (permission) hasAccess = true;
        }

        if (!hasAccess) {
            await logAction(user.user_id, `Failed local download attempt for ${fileRecord.file_name}`);
            return res.status(403).json({ detail: 'Not authorized to download this file' });
        }

        let encryptedData;
        try {
            encryptedData = fs.readFileSync(fileRecord.encrypted_path);
        } catch (e) {
            return res.status(500).json({ detail: 'File corrupted or missing' });
        }

        const decryptedData = decryptFileData(encryptedData, fileRecord.encryption_key);
        await logAction(user.user_id, `Downloaded file ${fileRecord.file_name}`);

        res.setHeader('Content-Disposition', `attachment; filename="${fileRecord.file_name}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.send(decryptedData);
    } catch (err) {
        res.status(500).json({ detail: 'Server error' });
    }
});

app.post('/api/share', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        const { file_id, user_id, permission_type } = req.body;

        const fileRecord = await File.findOne({ file_id });
        if (!fileRecord) return res.status(404).json({ detail: 'File not found' });

        if (fileRecord.owner_id !== user.user_id && user.role !== 'admin') {
            return res.status(403).json({ detail: 'Only owner or admin can share this file' });
        }

        const permId = uuidv4();
        await Permission.create({
            permission_id: permId,
            file_id,
            user_id,
            permission_type
        });

        await logAction(user.user_id, `Shared file ${fileRecord.file_name} with user ${user_id}`);
        res.json({ message: 'File shared successfully' });
    } catch (err) {
        res.status(500).json({ detail: 'Server error' });
    }
});

app.delete('/api/files/:file_id', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        const fileId = req.params.file_id;

        const fileRecord = await File.findOne({ file_id: fileId });
        if (!fileRecord) return res.status(404).json({ detail: 'File not found' });

        if (user.role === 'admin' || fileRecord.owner_id === user.user_id) {
            await Permission.deleteMany({ file_id: fileId });
            await File.deleteOne({ file_id: fileId });

            try {
                if (fs.existsSync(fileRecord.encrypted_path)) {
                    fs.unlinkSync(fileRecord.encrypted_path);
                }
            } catch (fsErr) {
                console.error('[Files] Error deleting physical file:', fsErr);
            }

            await logAction(user.user_id, `Deleted file ${fileRecord.file_name} completely`);
            return res.json({ message: 'File deleted entirely' });
        } else {
            const permission = await Permission.findOne({ file_id: fileId, user_id: user.user_id });
            if (permission) {
                await Permission.deleteOne({ file_id: fileId, user_id: user.user_id });
                await logAction(user.user_id, `Removed shared access to file ${fileRecord.file_name}`);
                return res.json({ message: 'Removed from your shared files' });
            } else {
                return res.status(403).json({ detail: 'Not authorized to delete this file' });
            }
        }
    } catch (err) {
        res.status(500).json({ detail: 'Server error' });
    }
});

app.get('/api/logs', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        if (user.role !== 'admin') return res.status(403).json({ detail: 'Admin access only' });

        const logs = await Log.aggregate([
            {
                $lookup: {
                    from: 'users',
                    localField: 'user_id',
                    foreignField: 'user_id',
                    as: 'user'
                }
            },
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    log_id: 1,
                    action: 1,
                    timestamp: 1,
                    user_name: '$user.name'
                }
            },
            { $sort: { timestamp: -1 } }
        ]);

        res.json(logs);
    } catch (err) {
        res.status(500).json({ detail: 'Server error' });
    }
});

app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        if (user.role !== 'admin') return res.status(403).json({ detail: 'Admin access only' });

        const users = await User.find({}, 'user_id name email role');
        res.json(users);
    } catch (err) {
        res.status(500).json({ detail: 'Server error' });
    }
});

initDb()
  .then(() => {
    console.log("Database connected");

    app.listen(PORT, () => {
      console.log(`[Server] running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Startup failed:", err);
    process.exit(1);
  });

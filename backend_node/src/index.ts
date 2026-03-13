import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import bcrypt from 'bcrypt';
import jwt from 'jwt-simple'; // wait, using jsonwebtoken
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import jwt_token from 'jsonwebtoken';

import { pool, initDb } from './db';
import { generateKey, encryptFileData, decryptFileData } from './aes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret123';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // for OAuth2 password grant compatibility

const upload = multer({ storage: multer.memoryStorage() });

const storageDir = path.join(__dirname, '..', 'storage_data');
if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir);
}

const logAction = async (userId: string, action: string) => {
    try {
        const logId = uuidv4();
        await pool.query('INSERT INTO logs (log_id, user_id, action) VALUES ($1, $2, $3)', [logId, userId, action]);
    } catch (err) {
        console.error('[Logs] Error logging action:', err);
    }
};

// Middleware to verify JWT
const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ detail: 'Invalid token' });

    try {
        const payload = jwt_token.verify(token, JWT_SECRET) as any;
        const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [payload.sub]);
        if (rows.length === 0) return res.status(401).json({ detail: 'User not found' });
        (req as any).user = rows[0];
        next();
    } catch (err) {
        return res.status(401).json({ detail: 'Invalid token' });
    }
};

app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const { rows: existing } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (existing.length > 0) return res.status(400).json({ detail: 'Email already registered' });

        const passwordHash = await bcrypt.hash(password, 10);
        const userId = uuidv4();
        await pool.query(
            'INSERT INTO users (user_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)',
            [userId, name, email, passwordHash, role]
        );

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
        const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [username]);
        if (rows.length === 0) return res.status(400).json({ detail: 'Incorrect email or password' });

        const user = rows[0];
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

        const user = (req as any).user;
        const encryptionKey = generateKey();
        const encryptedData = encryptFileData(file.buffer, encryptionKey);
        const fileId = uuidv4();

        const filePath = path.join(storageDir, `${file.originalname}_${user.user_id}.enc`);
        fs.writeFileSync(filePath, encryptedData);

        await pool.query(
            'INSERT INTO files (file_id, file_name, owner_id, encrypted_path, encryption_key) VALUES ($1, $2, $3, $4, $5)',
            [fileId, file.originalname, user.user_id, filePath, encryptionKey]
        );

        await logAction(user.user_id, `Uploaded file ${file.originalname}`);
        res.json({ success: true, file_id: fileId, message: 'File uploaded and encrypted' });
    } catch (err) {
        res.status(500).json({ detail: 'Server error' });
    }
});

app.get('/api/files', authenticateToken, async (req, res) => {
    try {
        const user = (req as any).user;
        let query = '';
        let params: any[] = [];
        if (user.role === 'admin') {
            query = 'SELECT * FROM files';
        } else {
            query = `SELECT DISTINCT f.* FROM files f LEFT JOIN file_permissions fp ON f.file_id = fp.file_id WHERE f.owner_id = $1 OR fp.user_id = $1`;
            params = [user.user_id];
        }
        const { rows } = await pool.query(query, params);
        res.json(rows.map(f => ({ file_id: f.file_id, file_name: f.file_name, upload_date: f.upload_date, owner_id: f.owner_id })));
    } catch (err) {
        res.status(500).json({ detail: 'Server error' });
    }
});

app.get('/api/download/:file_id', authenticateToken, async (req, res) => {
    try {
        const user = (req as any).user;
        const fileId = req.params.file_id;
        const { rows: files } = await pool.query('SELECT * FROM files WHERE file_id = $1', [fileId]);
        if (files.length === 0) return res.status(404).json({ detail: 'File not found' });
        const fileRecord = files[0];

        let hasAccess = false;
        if (user.role === 'admin' || fileRecord.owner_id === user.user_id) {
            hasAccess = true;
        } else {
            const { rows: perms } = await pool.query(
                "SELECT * FROM file_permissions WHERE file_id = $1 AND user_id = $2 AND permission_type IN ('view', 'download', 'edit')",
                [fileId, user.user_id]
            );
            if (perms.length > 0) hasAccess = true;
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
        const user = (req as any).user;
        const { file_id, user_id, permission_type } = req.body;

        const { rows: files } = await pool.query('SELECT * FROM files WHERE file_id = $1', [file_id]);
        if (files.length === 0) return res.status(404).json({ detail: 'File not found' });
        const fileRecord = files[0];

        if (fileRecord.owner_id !== user.user_id && user.role !== 'admin') {
            return res.status(403).json({ detail: 'Only owner or admin can share this file' });
        }

        const permId = uuidv4();
        await pool.query(
            'INSERT INTO file_permissions (permission_id, file_id, user_id, permission_type) VALUES ($1, $2, $3, $4)',
            [permId, file_id, user_id, permission_type]
        );

        await logAction(user.user_id, `Shared file ${fileRecord.file_name} with user ${user_id}`);
        res.json({ message: 'File shared successfully' });
    } catch (err) {
        res.status(500).json({ detail: 'Server error' });
    }
});

app.delete('/api/files/:file_id', authenticateToken, async (req, res) => {
    try {
        const user = (req as any).user;
        const fileId = req.params.file_id;

        const { rows: files } = await pool.query('SELECT * FROM files WHERE file_id = $1', [fileId]);
        if (files.length === 0) return res.status(404).json({ detail: 'File not found' });
        const fileRecord = files[0];

        if (user.role === 'admin' || fileRecord.owner_id === user.user_id) {
            await pool.query('DELETE FROM file_permissions WHERE file_id = $1', [fileId]);
            await pool.query('DELETE FROM files WHERE file_id = $1', [fileId]);

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
            const { rows: perms } = await pool.query(
                "SELECT * FROM file_permissions WHERE file_id = $1 AND user_id = $2",
                [fileId, user.user_id]
            );

            if (perms.length > 0) {
                await pool.query('DELETE FROM file_permissions WHERE file_id = $1 AND user_id = $2', [fileId, user.user_id]);
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
        const user = (req as any).user;
        if (user.role !== 'admin') return res.status(403).json({ detail: 'Admin access only' });

        const { rows } = await pool.query(`
      SELECT l.log_id, l.action, l.timestamp, u.name as user_name 
      FROM logs l 
      LEFT JOIN users u ON l.user_id = u.user_id 
      ORDER BY l.timestamp DESC
    `);

        res.json(rows);
    } catch (err) {
        res.status(500).json({ detail: 'Server error' });
    }
});

app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const user = (req as any).user;
        if (user.role !== 'admin') return res.status(403).json({ detail: 'Admin access only' });

        const { rows } = await pool.query('SELECT user_id, name, email, role FROM users');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ detail: 'Server error' });
    }
});

initDb().then(() => {
    app.listen(PORT, () => {
        console.log(`[Server] running on http://localhost:${PORT}`);
    });
});

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

dotenv.config();

const userSchema = new mongoose.Schema({
    user_id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password_hash: { type: String, required: true },
    role: { type: String, required: true }
});

const fileSchema = new mongoose.Schema({
    file_id: { type: String, required: true, unique: true },
    file_name: { type: String, required: true },
    upload_date: { type: Date, default: Date.now },
    owner_id: { type: String, required: true },
    encrypted_path: { type: String, required: true },
    encryption_key: { type: String, required: true }
});

const permissionSchema = new mongoose.Schema({
    permission_id: { type: String, required: true, unique: true },
    file_id: { type: String, required: true },
    user_id: { type: String, required: true },
    permission_type: { type: String, required: true }
});

const logSchema = new mongoose.Schema({
    log_id: { type: String, required: true, unique: true },
    user_id: { type: String },
    action: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const File = mongoose.model('File', fileSchema);
const Permission = mongoose.model('Permission', permissionSchema);
const Log = mongoose.model('Log', logSchema);

const initDb = async () => {
    try {
        console.log("DATABASE_URL exists:", !!process.env.DATABASE_URL);
        await mongoose.connect(process.env.DATABASE_URL);
        console.log('[DB] Connected to MongoDB');

        // Seed Admin User
        const adminEmail = 'admin@securevault.com';
        const checkAdmin = await User.findOne({ email: adminEmail });
        if (!checkAdmin) {
            const passwordHash = await bcrypt.hash('admin@securevault', 10);
            const userId = uuidv4();
            await User.create({
                user_id: userId,
                name: 'SecureVault Admin',
                email: adminEmail,
                password_hash: passwordHash,
                role: 'admin'
            });
            console.log('[DB] Admin user created with email: admin@securevault.com');
        }
    } catch (err) {
        console.error('[DB] Error initializing MongoDB:', err);
        throw err; // IMPORTANT
    }
};

module.exports = {
    initDb,
    User,
    File,
    Permission,
    Log
};

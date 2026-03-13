import { Pool } from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

export const initDb = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
      CREATE TABLE IF NOT EXISTS users (
          user_id UUID PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS files (
          file_id UUID PRIMARY KEY,
          file_name VARCHAR(255) NOT NULL,
          upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          owner_id UUID REFERENCES users(user_id),
          encrypted_path VARCHAR(500) NOT NULL,
          encryption_key VARCHAR(500) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS file_permissions (
          permission_id UUID PRIMARY KEY,
          file_id UUID REFERENCES files(file_id),
          user_id UUID REFERENCES users(user_id),
          permission_type VARCHAR(50) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS logs (
          log_id UUID PRIMARY KEY,
          user_id UUID REFERENCES users(user_id),
          action VARCHAR(255) NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        console.log('[DB] Database tables initialized on PostgreSQL');

        // Seed Admin User
        const checkAdmin = await client.query('SELECT * FROM users WHERE email = $1', ['vamshi@gmail.com']);
        if (checkAdmin.rows.length === 0) {
            const passwordHash = await bcrypt.hash('Vamshi', 10);
            const userId = uuidv4();
            await client.query(
                'INSERT INTO users (user_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)',
                [userId, 'Vamshi Admin', 'vamshi@gmail.com', passwordHash, 'admin']
            );
            console.log('[DB] Admin user created with email: vamshi@gmail.com');
        }

    } catch (err) {
        console.error('[DB] Error initializing tables:', err);
    } finally {
        client.release();
    }
};

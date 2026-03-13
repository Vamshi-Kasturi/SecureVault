import crypto from 'crypto';

export const generateKey = (): string => {
    return crypto.randomBytes(32).toString('base64');
};

export const encryptFileData = (data: Buffer, keyBase64: string): Buffer => {
    const key = Buffer.from(keyBase64, 'base64');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    return Buffer.concat([iv, encrypted]);
};

export const decryptFileData = (encryptedData: Buffer, keyBase64: string): Buffer => {
    const key = Buffer.from(keyBase64, 'base64');
    const iv = encryptedData.subarray(0, 16);
    const encrypted = encryptedData.subarray(16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
};

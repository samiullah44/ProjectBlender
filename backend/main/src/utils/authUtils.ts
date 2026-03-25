// backend/src/utils/authUtils.ts
import { v4 as uuidv4 } from 'uuid';

export function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generateToken(): string {
    return uuidv4();
}

export function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export function validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

export function generateUsername(email: string): string {
    const username = email.split('@')[0] || '';
    return username.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
}
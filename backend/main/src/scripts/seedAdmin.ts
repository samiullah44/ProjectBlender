/**
 * Seed Admin User Script
 * 
 * Usage: npx tsx src/scripts/seedAdmin.ts
 * 
 * Creates an admin user or promotes an existing user to admin.
 * You can customize the admin credentials below.
 */
import mongoose from 'mongoose';
import { User } from '../models/User';
import { env } from '../config/env';

// ============================================================
// 🔧 CONFIGURE YOUR ADMIN USER HERE
// ============================================================
const ADMIN_EMAIL = 'admin@rendernodes.com';
const ADMIN_USERNAME = 'admin';
const ADMIN_NAME = 'Admin User';
const ADMIN_PASSWORD = 'Admin@123456'; // Change this!
// ============================================================

async function seedAdmin() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(env.mongodbUri);
        console.log('✅ Connected to MongoDB');

        // Check if user already exists
        const existingUser = await User.findOne({ email: ADMIN_EMAIL });

        if (existingUser) {
            if (existingUser.role === 'admin') {
                console.log('ℹ️  Admin user already exists with this email.');
                console.log(`   Email: ${existingUser.email}`);
                console.log(`   Username: ${existingUser.username}`);
                console.log(`   Role: ${existingUser.role}`);
                console.log('   No changes made.');
            } else {
                // Promote existing user to admin
                existingUser.role = 'admin';
                await existingUser.save();
                console.log('✅ Existing user promoted to admin!');
                console.log(`   Email: ${existingUser.email}`);
                console.log(`   Username: ${existingUser.username}`);
                console.log(`   Role: admin`);
            }
        } else {
            // Create new admin user
            const adminUser = new User({
                email: ADMIN_EMAIL,
                username: ADMIN_USERNAME,
                name: ADMIN_NAME,
                password: ADMIN_PASSWORD,
                role: 'admin',
                isVerified: true,
                provider: 'local',
                credits: 99999,
                stats: {
                    jobsCreated: 0,
                    framesRendered: 0,
                    totalSpent: 0,
                    totalEarned: 0
                }
            });

            await adminUser.save();

            console.log('✅ Admin user created successfully!');
            console.log('');
            console.log('   ┌─────────────────────────────────┐');
            console.log(`   │ Email:    ${ADMIN_EMAIL.padEnd(22)}│`);
            console.log(`   │ Password: ${ADMIN_PASSWORD.padEnd(22)}│`);
            console.log(`   │ Role:     admin                  │`);
            console.log('   └─────────────────────────────────┘');
            console.log('');
            console.log('   Log in at: http://localhost:5173/login');
            console.log('   Admin dashboard: http://localhost:5173/admin/dashboard');
        }

    } catch (error) {
        console.error('❌ Error seeding admin:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

seedAdmin();

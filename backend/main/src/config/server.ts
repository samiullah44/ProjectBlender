// import dotenv from 'dotenv';
// import path from 'path';
// import fs from 'fs';

// dotenv.config();

// export interface ServerConfig {
//   port: number;
//   host: string;
//   environment: string;
//   uploadsPath: string;
//   rendersPath: string;
//   maxFileSize: number;
// }

// export const getServerConfig = (): ServerConfig => {
//   const port = parseInt(process.env.PORT || '3000', 10);
//   const host = process.env.HOST || '0.0.0.0';
//   const environment = process.env.NODE_ENV || 'development';
  
//   // Use correct path based on environment
//   const baseDir = environment === 'production' ? 'dist' : 'src';
//   const uploadsPath = path.join(process.cwd(), baseDir, 'uploads');
//   const rendersPath = path.join(process.cwd(), baseDir, 'renders');

//   // Create directories if they don't exist
//   [uploadsPath, rendersPath].forEach(dir => {
//     if (!fs.existsSync(dir)) {
//       fs.mkdirSync(dir, { recursive: true });
//     }
//   });

//   return {
//     port,
//     host,
//     environment,
//     uploadsPath,
//     rendersPath,
//     maxFileSize: 500 * 1024 * 1024 // 500MB
//   };
// };

// export const printServerStartup = (config: ServerConfig): void => {
//   console.log('\n' + '='.repeat(50));
//   console.log('🚀 BlendFarm Backend Server Started');
//   console.log('='.repeat(50));
//   console.log(`📊 Port: ${config.port}`);
//   console.log(`🌍 Host: ${config.host}`);
//   console.log(`🌍 Environment: ${config.environment}`);
//   console.log(`📁 Uploads path: ${config.uploadsPath}`);
//   console.log(`📁 Renders path: ${config.rendersPath}`);
//   console.log('='.repeat(50));
// };
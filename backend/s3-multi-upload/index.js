// server.js
import app from "./src/app.js";
import env from "./src/config/env.js";
import connectDB from "./src/config/db.js";

// Connect to MongoDB
connectDB(env.MONGO_URI)
  .then(() => {
    // Start server only after DB is connected
    app.listen(env.PORT, () => {
      console.log(`🚀 Server running on port ${env.PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to start server:", err);
  });

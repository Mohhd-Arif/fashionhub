const { connectDatabase, closeDatabase, connectionErrorMessage } = require('../config/database');

(async () => {
  try {
    await connectDatabase();
    console.log('MongoDB connection and ping successful. No data was modified.');
  } catch (error) {
    console.error(connectionErrorMessage(error));
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
})();

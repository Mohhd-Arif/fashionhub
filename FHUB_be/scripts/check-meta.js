const { verifyConnection } = require('../service/meta-client');

verifyConnection()
  .then(({ pageName, pageId, instagramId }) => {
    console.log(`Facebook Page connected: ${pageName} (${pageId})`);
    console.log(`Linked Instagram Professional account: ${instagramId}`);
  })
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });

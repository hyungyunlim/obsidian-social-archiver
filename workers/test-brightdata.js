/**
 * BrightData API 테스트 스크립트
 *
 * 실행 방법:
 * node test-brightdata.js
 */

const BRIGHTDATA_API_KEY = '4e4c8e49ba05d96106eb549d2075438a6585ea9831046c7242f989cbcf908487';
const TEST_URL = 'https://www.facebook.com/jungdennim/posts/pfbid0bHPWsZ861M8mLujTeP9yn4m6d4t9NcyJvUHUJ9P7rUauK4QtAUy965MBqRq1TiKrl';
const DATASET_ID = 'gd_lkay758p1eanlolqw8'; // Facebook

async function testBrightData() {
  console.log('🚀 Starting BrightData API Test...\n');
  console.log(`📍 URL: ${TEST_URL}`);
  console.log(`📊 Dataset ID: ${DATASET_ID}\n`);

  const startTime = Date.now();

  try {
    // Step 1: Trigger Collection
    console.log('📡 Step 1: Triggering data collection...');
    const triggerResponse = await fetch(
      `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${DATASET_ID}&include_errors=true`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${BRIGHTDATA_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{
          url: TEST_URL,
          get_all_replies: false,
          limit_records: '',
          comments_sort: '',
        }]),
      }
    );

    if (!triggerResponse.ok) {
      const error = await triggerResponse.text();
      throw new Error(`Trigger failed (${triggerResponse.status}): ${error}`);
    }

    const triggerData = await triggerResponse.json();
    const snapshotId = triggerData.snapshot_id;

    console.log(`✅ Collection triggered successfully`);
    console.log(`📸 Snapshot ID: ${snapshotId}\n`);

    // Step 2: Poll for completion
    console.log('⏳ Step 2: Waiting for collection to complete...');
    const pollStartTime = Date.now();
    const maxWaitTime = 60000; // 60 seconds
    const pollInterval = 2000; // 2 seconds
    let pollCount = 0;

    while (Date.now() - pollStartTime < maxWaitTime) {
      pollCount++;
      const elapsed = ((Date.now() - pollStartTime) / 1000).toFixed(1);

      const statusResponse = await fetch(
        `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`,
        {
          headers: {
            'Authorization': `Bearer ${BRIGHTDATA_API_KEY}`,
          },
        }
      );

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.status}`);
      }

      const status = await statusResponse.json();

      console.log(`   Poll #${pollCount} (${elapsed}s): status = ${status.status}`);

      if (status.status === 'ready') {
        console.log(`✅ Collection completed in ${elapsed} seconds\n`);

        // Step 3: Download data
        console.log('📥 Step 3: Downloading snapshot data...');
        const downloadResponse = await fetch(
          `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}?format=json`,
          {
            headers: {
              'Authorization': `Bearer ${BRIGHTDATA_API_KEY}`,
            },
          }
        );

        if (!downloadResponse.ok) {
          throw new Error(`Download failed: ${downloadResponse.status}`);
        }

        const text = await downloadResponse.text();
        console.log(`✅ Data downloaded (${text.length} bytes)\n`);

        // Parse NDJSON
        console.log('🔍 Parsing NDJSON response...');
        const lines = text.trim().split('\n');
        const results = lines
          .filter(line => line.trim().length > 0)
          .map(line => {
            try {
              return JSON.parse(line);
            } catch (e) {
              console.error(`⚠️  Failed to parse line: ${line.substring(0, 100)}`);
              return null;
            }
          })
          .filter(result => result !== null);

        console.log(`✅ Parsed ${results.length} result(s)\n`);

        if (results.length > 0) {
          const data = results[0];
          console.log('📊 Sample Data:');
          console.log(`   Post ID: ${data.post_id || 'N/A'}`);
          console.log(`   Author: ${data.author_name || 'N/A'}`);
          console.log(`   Text: ${(data.text || '').substring(0, 100)}...`);
          console.log(`   Likes: ${data.likes_count || 0}`);
          console.log(`   Comments: ${data.comments_count || 0}`);
          console.log(`   Shares: ${data.shares_count || 0}`);
        }

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n✅ Test completed successfully in ${totalTime} seconds`);
        return;
      }

      if (status.status === 'failed') {
        throw new Error(`Collection failed: ${status.error || 'Unknown error'}`);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Timeout: Collection did not complete in 60 seconds');

  } catch (error) {
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`\n❌ Test failed after ${totalTime} seconds`);
    console.error(`Error: ${error.message}`);
    if (error.stack) {
      console.error(`\nStack trace:\n${error.stack}`);
    }
    process.exit(1);
  }
}

// Run test
testBrightData();

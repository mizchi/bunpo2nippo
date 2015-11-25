const {run} = require('./bunpo2nippo');
run().catch(e => {
  console.log('error', e);
});

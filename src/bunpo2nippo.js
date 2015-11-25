const moment = require('moment');
const fs = require('fs')
const path = require('path')

const Slack = require('slack-node');
const configPath = path.join(process.env.HOME, '.bunpo2nipporc');
let {
  token, userName, channelName, userId, channelId
} = JSON.parse(fs.readFileSync(configPath).toString());

const slack = new Slack(token);
function fetchUserAndChannel() {
  return new Promise(done => {
    slack.api("channels.list", (err, {ok, channels}) =>  {
      if (!ok) throw err;
      slack.api("users.list", (err, {ok, members}) =>  {
        if (!ok) throw err;
        const channel = channels.find(c => c.name === channelName);
        const user = members.find(c => c.name === userName);
        return done({user, channel});
      });
    });
  });
}

function fetchMessagesOfToday(channelId, userId) {
  return new Promise(done => {
    slack.api("channels.history", {channel: channelId}, (err, {ok, messages}) => {
      if (!ok) throw err;
      // const now = moment().tz('Asia/Tokyo');
      const now = moment();
      // const startOfToday = moment([now.year(), now.month(), now.date(), 0, 0]);
      const startOfToday = moment().startOf('day');
      const ret = messages
          .filter(m => m.user === userId)
          .filter(m => {
            m.user === userId
            const ts = parseInt(m.ts, 10);
            const thatTime = moment.unix(ts);
            return thatTime.unix() > startOfToday.unix();
          });
      ret.sort((a, b) => parseInt(a.ts, 10) - parseInt(b.ts, 10));
      return done(ret);
    });
  });
}

export async function run(config = {}) {
  if (!channelId || !userId) {
    const {user, channel} = await fetchUserAndChannel();
    channelId = channel.id;
    userId = user.id;
    fs.writeFileSync(configPath, JSON.stringify({
      token, userName, channelName, userId, channelId
    }, null, '  '));
  }
  const messages = await fetchMessagesOfToday(channelId, userId);
  console.log(messages.map(m => {
    return (moment.unix(parseInt(m.ts, 10)).format('a hh:mm ') + m.text);
  }).join('\n'));
};

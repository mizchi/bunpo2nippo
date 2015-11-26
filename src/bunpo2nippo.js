const moment = require('moment');
const fs = require('fs')
const path = require('path')
const groupBy = require('lodash.groupby');

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

const typeRegex = new RegExp("^([a-zA-Z-]+)(?!://):\s*");
function classifyMessagesByTag(messages) {
  return groupBy(messages, m => {
    const ret = m.text.match(typeRegex);
    return ret && ret[1];
  });
}

function processMessages(groupedMmessages) {
  const tasks = {};
  const uncategorized = [];
  const others = {};

  for (let type in groupedMmessages) {
    const typeMessages = groupedMmessages[type];

    if (type === 'task') {
      for (let m of typeMessages) {
        const raw = m.text.replace(typeRegex, '');
        tasks[raw] = false;
      }
    } else if (type === 'done') {
      for (let m of typeMessages) {
        const raw = m.text.replace(typeRegex, '');
        tasks[raw] = true;
      }
    } else if (type !== 'null'){
      for (let m of typeMessages) {
        if (!others[type]) others[type] = [];
        others[type].push(m);
      }
    } else {
      for (let m of typeMessages) {
        uncategorized.push(m);
      }
    }
  }
  // TODO
  // console.log('tasks', tasks);
  // console.log('uncategorized', uncategorized)

  console.log('## やったこと\n');
  for (let task in tasks) {
    const done = tasks[task];
    console.log(`${done ? '- [x]' : '- [ ]'}` + task)
  }
  console.log('');

  for (let key in others) {
    // console.log('others', key);
    const messages = others[key];
    console.log('##', key, '\n');
    for (let m of messages) {
      const raw = m.text.replace(typeRegex, '');
      console.log(`-${raw}`);
    }
    console.log('');
  }

  console.log('');
  console.log('## その他\n');
  for (let m of uncategorized) {
    console.log(`- ${m.text}`)
  }
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
  const processdeMessages = processMessages(classifyMessagesByTag(messages));

  // console.log(messages.map(m => {
  //   return (moment.unix(parseInt(m.ts, 10)).format('a hh:mm ') + m.text);
  // }).join('\n'));
};

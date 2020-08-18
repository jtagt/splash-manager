const Discord = require('discord.js');
const client = new Discord.Client();
const jsonConfig = require('./config.json');

const axios = require('axios');
const moment = require('moment');
const mongoose = require('mongoose');

const playerModel = mongoose.model('players', {
    _id: String,
    donator: Boolean,
    donatorType: String,
    mojangUUID: String,
    expires: Number,
    lastSplashRequest: Number,
    lastPotionRequest: Number,
    verified: Boolean,
    hasSentRemind: Boolean
});

const ignoreModel = mongoose.model('ignores', {
    _id: String,
    ignored: Boolean,
    username: String,
    reason: String,
    timestamp: Number
});

mongoose.connect(jsonConfig.mongodb, { useFindAndModify: false, useUnifiedTopology: true, useNewUrlParser: true }, () => console.log('Connected to MongoDB.'));

const MS_DAY = 86400000;

const STAFF_ROLE = "714143832991596674";
const VERIFIED_ROLE = "714425690727907329";
const MONTHLY_ROLE = "698681973861777408";
const WEEKLY_ROLE = "698681967499280414";
const INFINITE_ROLE = "698681976315576491";

const TICKETS_CHANNEL = "698704051411615789";
const DONATOR_CHANNEL = "698683619736027216";
const DONATOR_CHANNEL_ROLES = "714499793375723590";
const EARLY_WARNING_CHANNEL = "714501945771032577";


const donatorTypes = ['weekly', 'monthly', 'infinite'];
const roleManager = new Map();

const clean = text => {
    if (typeof (text) === "string") return text.replace(/`/g, "`" + String.fromCharCode(8203)).replace(/@/g, "@" + String.fromCharCode(8203));

    return text;
}

client.on('ready', async () => {
    console.log('Bot Ready');
    client.user.setPresence({ status: 'idle' });
    client.user.setActivity('skyblock || s!', { type: 'PLAYING' });

    setInterval(() => checkRoles(), 10000);

    const players = await playerModel.find({ donator: true, donatorType: { $in: ['weekly', 'monthly'] } }).lean();
    players.forEach(player => roleManager.set(player._id, player));
});

client.on('message', async message => {
    if (!message.guild?.id) return;

    const config = jsonConfig;
    const prefix = config.prefix || 's!';

    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.slice(prefix.length).split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === "verify") {
        const userData = await playerModel.findById(message.author.id);
        if (userData.verified) return message.channel.send('You have already verified.');

        if (!args[0]) {
            const responseMessage = await message.channel.send('Please provide a username.');

            message.delete({ timeout: 3000 });
            return responseMessage.delete({ timeout: 3000 });
        }

        const response = await axios(`https://api.hypixel.net/player?key=${jsonConfig.apiKey}&name=${args[0]}`);
        const data = response.data;

        if (!data.success || !data.player) {
            const responseMessage = await message.channel.send('Invalid username or Hypixel API is down.');

            message.delete({ timeout: 3000 });
            return responseMessage.delete({ timeout: 3000 });
        }

        const discord = data.player?.socialMedia?.links?.DISCORD;
        if (!discord) {
            const responseMessage = await message.channel.send('You must link your Discord account with your Hypixel account before you can continue.');

            message.delete({ timeout: 5000 });
            return responseMessage.delete({ timeout: 5000 });
        }

        if (discord !== `${message.author.username}#${message.author.discriminator}`) {
            const responseMessage = await message.channel.send('Your current Discord account and the one linked on your Hypixel account do not match please update them before you continue.');

            message.delete({ timeout: 5000 });
            return responseMessage.delete({ timeout: 5000 });
        }

        playerModel.findByIdAndUpdate(message.author.id, { _id: message.author.id, verified: true }, { upsert: true }, (err, res) => {
            if (err) return message.author.send('Something went wrong contact an admin.');

            message.guild.members.cache.get(message.author.id).roles.add(VERIFIED_ROLE);
            message.delete();
            message.author.send('Hello, \nThank you for verifying in Bald Splashes!\nIf you want to get pinged for our Splashes or Giveaways go to #reaction-roles!\nAlso, be sure to take a good look at #rules as it contains our Server Rules.');
        });
    } else if (command === "newdonator") {
        if (!message.guild.members.cache.get(message.author.id).roles.cache.has(STAFF_ROLE)) return;

        const ign = args[1];
        const type = args[2];

        const mention = message.mentions.users;
        if (!mention.size) return message.channel.send('You must mention a user.');

        if (!ign) return message.channel.send('You must provide a ign.');
        if (!type) return message.channel.send('You must provide a donator type.');

        const userId = mention.first().id;

        const response = await axios(`https://mc-heads.net/minecraft/profile/${ign}`);
        const data = response.data;

        if (!data) return message.channel.send('Invalid IGN or Mojang API is down.');
        if (!donatorTypes.includes(type.toLowerCase())) return message.channel.send('Invalid donator type.');

        let expires = Date.now();

        if (type === 'weekly') {
            expires = expires + (MS_DAY * 7);
        } else if (type === 'monthly') {
            expires = expires + (MS_DAY * 30);
        } else if (type === 'infinite') {
            expires = expires + (MS_DAY * 999999);
        }

        playerModel.findByIdAndUpdate(userId, { _id: userId, mojangUUID: data.id, donator: true, donatorType: type.toLowerCase(), expires, hasSentRemind: false }, { upsert: true, new: true }, (err, res) => {
            if (err) return message.reply('Something went wrong.');

            roleManager.set(res._id, res.toJSON());
            
            if (type === 'weekly') {
                client.guilds.cache.get(jsonConfig.guild).members.cache.get(userId).roles.add(WEEKLY_ROLE);
            } else if (type === 'monthly') {
                client.guilds.cache.get(jsonConfig.guild).members.cache.get(userId).roles.add(MONTHLY_ROLE);
            } else if (type === 'infinite') {
                client.guilds.cache.get(jsonConfig.guild).members.cache.get(userId).roles.add(INFINITE_ROLE);
            }

            client.guilds.cache.get(jsonConfig.guild).members.cache.get(userId).send(`Hello,\nThank you for your donation to Bald Splashes!\n\n**This is an automated message to give you some information about the Donator Perks.**\n\nTo start with, you get early access to our Splashes, which you will be notified for in: <#${DONATOR_CHANNEL}>.\nIf you want to be notified before a Splash is about to happen, you can go over to <#${DONATOR_CHANNEL_ROLES}> and click the reaction to be pinged for Early Splash Warnings which will be posted in <#${EARLY_WARNING_CHANNEL}>.\nYou also get access to a special Donator Only chat, which is only visible to other donators.\n\nIf you have any questions, feel free to DM any Bald Splashes Staff Members or open a ticket in <#${TICKETS_CHANNEL}> and one of our Staff Members will be ready to assist you with any questions you might have.`);

            message.reply(`Successfully added donator to ${ign}.`);
        });
    } else if (command === "getdiscord") {
        const ign = args[0];
        if (!ign) return message.channel.send('You must provide a ign.');

        const response = await axios(`https://api.hypixel.net/player?key=${jsonConfig.apiKey}&name=${ign}`);
        const data = response.data;

        if (!data.success || !data.player) return message.channel.send('Player does not exist.');

        const player = data.player;
        const discord = player?.socialMedia?.links?.DISCORD;
        if (!discord) return message.channel.send('That user has not linked their discord.');

        message.reply(`The user ${ign}'s discord is ${discord}`);
    } else if (command === "userinfo") {
        const target = args[0];
        if (!target) return message.channel.send('You must provide a ign.');

        let userData;
        let mojangUsername;

        const mention = message.mentions.users;

        if (mention.size) {
            const userId = mention.first().id;
            userData = await playerModel.findOne({ _id: userId });
        } else {
            const response = await axios(`https://mc-heads.net/minecraft/profile/${target}`);
            const data = response.data;

            if (!data) return message.channel.send('Invalid IGN or Mojang API is down.');
            const id = data.id;
            mojangUsername = data.name;

            userData = await playerModel.findOne({ mojangUUID: id });
        }

        if (!userData) return message.channel.send('No user in exists by that name or mention.');

        const embed = new Discord.MessageEmbed()
            .setTitle(`User Info for ${mention.size ? client.guilds.cache.get(jsonConfig.guild).members.cache.get(userData._id).user.username : mojangUsername}`)
            .addField('Donator', userData.donator ? 'True' : 'False')
            .addField('Donator Type', userData.donatorType !== '' ? userData.donatorType : "N/A")

        if (userData.donator) embed.addField('Expires', moment(userData.expires).fromNow());

        message.channel.send(embed);
    } else if (command === "update") {
        if (!message.guild.members.cache.get(message.author.id).roles.cache.has(STAFF_ROLE)) return;

        const mention = message.mentions.users;

        const time = args[1];

        if (!mention.size) return message.channel.send('You must mention a user.');
        if (!time) return message.channel.send('You must provide a time in days.');

        const userId = mention.first().id;

        const splitted = time.split("d");
        if (!Number(splitted[0])) return message.channel.send('You must provide a time in days. Ex: ``4d``');

        playerModel.findByIdAndUpdate(userId, { _id: userId, $inc: { expires: (Number(splitted[0] * MS_DAY)) } }, { upsert: true, new: true }, (err, res) => {
            if (err) return message.reply('Something went wrong.');

            roleManager.set(res._id, { ...res.toJSON(), hasSentRemind: false });
            message.reply(`Successfully updated their subscription.`);
        });
    } else if (command === "mutual") {
        const target = args[0];
        if (!target) return message.channel.send('You must provide a ign.');

        const response = await axios(`https://mc-heads.net/minecraft/profile/${target}`);
        const data = response.data;

        if (!data) return message.channel.send('Invalid IGN or Mojang API is down.');
        const id = data.id;

        const responseFriends = await axios(`https://api.hypixel.net/friends?key=${jsonConfig.apiKey}&uuid=${id}`);
        const dataFriends = responseFriends.data;

        if (!dataFriends.success) return message.channel.send('Something went wrong.');

        const outgoing = dataFriends.records.filter(record => record.uuidSender !== id).map(f => f.uuidSender);
        const receiving = dataFriends.records.filter(record => record.uuidReceiver !== id).map(f => f.uuidReceiver);
        const uniqueFriends = [...outgoing, ...receiving];

        const donators = await playerModel.find({ mojangUUID: { $in: uniqueFriends } });

        if (!donators.length) return message.channel.send('This user does not have any donators as friends.');

        const embed = new Discord.MessageEmbed()
            .setTitle('Donators in Common')

        let description = '';

        await Promise.all(donators.map(async donator => {
            const responseDonator = await axios(`https://mc-heads.net/minecraft/profile/${donator.mojangUUID}`);
            const donatorData = responseDonator.data;

            description = description + `${donatorData.name}\n`;
        }));
        embed.setDescription(`\`\`\`css\n${description}\`\`\``);

        message.channel.send(embed);
    } else if (command === "ignore") {
        if (!message.guild.members.cache.get(message.author.id).roles.cache.has(STAFF_ROLE)) return;

        const types = ['add', 'remove', 'view'];
        if (!args[0]) return message.channel.send('You must use ignore add or ignore remove or ignore view.');
        if (!types.includes(args[0])) return message.channel.send('You must use ignore add or ignore remove or ignore view.');

        const target = args[1];
        if (!target) return message.channel.send('You must provide a ign.');

        const response = await axios(`https://mc-heads.net/minecraft/profile/${target}`);
        const data = response.data;
        if (!data) return message.channel.send('User does not exist or Mojang API is down.');

        if (args[0] === 'add') {
            ignoreModel.findByIdAndUpdate(data.id, {
                _id: data.id,
                username: data.name,
                reason: args.slice(2).join(' ') ? args.slice(2).join(' ') : 'No reason',
                timestamp: Date.now()
            }, { upsert: true }, (err, res) => {
                if (err) message.channel.send('Something went wrong.');

                message.channel.send(`Successfully added ${data.name} to the ignore list.`);
            });
        } else if (args[0] === 'remove') {
            ignoreModel.findByIdAndDelete(data.id, (err, res) => {
                if (err) return message.channel.send('Something went wrong.');

                message.channel.send(`Removed ${data.name} from the ignore list.`);
            });
        } else if (args[0] === "view") {
            const ignore = await ignoreModel.findOne({ username: args[1] });
            if (!ignore) return message.channel.send('This person has not been ignored.');

            const embed = new Discord.MessageEmbed()
                .setTitle(`Ignore for ${ignore.username}`)
                .addField('Reason', ignore.reason ? ignore.reason : 'No reason', true)
                .addField('Added', moment(ignore.timestamp).fromNow(), true)

            message.channel.send(embed);
        }
    } else if (command === "splashrequest") {
        const target = args[0];
        if (!target) return message.channel.send('You must provide a username.');

        const mention = message.mentions.users;

        let userData;
        let mojangUsername;

        if (mention.size) {
            const userId = mention.first().id;
            userData = await playerModel.findOne({ _id: userId });

            mojangUsername = message.author.username;
        } else {
            const response = await axios(`https://mc-heads.net/minecraft/profile/${target}`);
            const data = response.data;

            if (!data) return message.channel.send('Invalid IGN or Mojang API is down.');
            const id = data.id;
            mojangUsername = data.name;

            userData = await playerModel.findOne({ mojangUUID: id });
        }

        if (!userData) return message.channel.send('No user in exists by that name or mention.');
        if (!userData.lastSplashRequest) return message.channel.send('This user has never requested a splash.');

        const embed = new Discord.MessageEmbed()
            .setTitle(`Splash Request Info for ${mojangUsername}`)
            .addField('Requested', moment(userData.lastSplashRequest).fromNow())

        message.channel.send(embed);
    } else if (command === "splashrequestlog") {
        if (!message.guild.members.cache.get(message.author.id).roles.cache.has(STAFF_ROLE)) return;

        const target = args[0];
        if (!target) return message.channel.send('You must provide a username.');

        const mention = message.mentions.users;

        let userData;
        let mojangUsername;

        if (mention.size) {
            const userId = mention.first().id;
            userData = await playerModel.findByIdAndUpdate(userId, { $set: { lastSplashRequest: Date.now() } }, (err, res) => {
                if (err) return message.channel.send('Something went wrong.');

                message.channel.send('Successfully updated last splash request.');
            });
        } else {
            const response = await axios(`https://mc-heads.net/minecraft/profile/${target}`);
            const data = response.data;

            if (!data) return message.channel.send('Invalid IGN or Mojang API is down.');
            const id = data.id;
            mojangUsername = data.name;

            userData = await playerModel.findOneAndUpdate({ mojangUUID: id }, { $set: { lastSplashRequest: Date.now() } }, (err, res) => {
                if (err) return message.channel.send('Something went wrong.');

                message.channel.send('Successfully updated last splash request.');
            });
        }
    } else if (command === "potionrequest") {
        const target = args[0];
        if (!target) return message.channel.send('You must provide a username.');

        let userData;
        let mojangUsername;

        const mention = message.mentions.users;

        if (mention.size) {
            const userId = mention.first().id;
            userData = await playerModel.findOne({ _id: userId });

            mojangUsername = message.author.username;
        } else {
            const response = await axios(`https://mc-heads.net/minecraft/profile/${target}`);
            const data = response.data;

            if (!data) return message.channel.send('Invalid IGN or Mojang API is down.');
            const id = data.id;
            mojangUsername = data.name;

            userData = await playerModel.findOne({ mojangUUID: id });
        }

        if (!userData) return message.channel.send('No user in exists by that name or mention.');
        if (!userData.lastPotionRequest) return message.channel.send('This user has never requested a potion.');

        const embed = new Discord.MessageEmbed()
            .setTitle(`Potion Request Info for ${mojangUsername}`)
            .addField('Requested', moment(userData.lastPotionRequest).fromNow())

        message.channel.send(embed);
    } else if (command === "potionrequestlog") {
        if (!message.guild.members.cache.get(message.author.id).roles.cache.has(STAFF_ROLE)) return;
        
        const target = args[0];
        if (!target) return message.channel.send('You must provide a username.');

        let userData;
        let mojangUsername;

        const mention = message.mentions.users;

        if (mention.size) {
            const userId = mention.first().id;
            userData = await playerModel.findByIdAndUpdate(userId, { $set: { lastPotionRequest: Date.now() } }, (err, res) => {
                if (err) return message.channel.send('Something went wrong.');

                message.channel.send('Successfully updated last potion request.');
            });
        } else {
            const response = await axios(`https://mc-heads.net/minecraft/profile/${target}`);
            const data = response.data;

            if (!data) return message.channel.send('Invalid IGN or Mojang API is down.');
            const id = data.id;
            mojangUsername = data.name;

            userData = await playerModel.findOneAndUpdate({ mojangUUID: id }, { $set: { lastPotionRequest: Date.now() } }, (err, res) => {
                if (err) return message.channel.send('Something went wrong.');

                message.channel.send('Successfully updated last potion request.');
            });
        }
    } else if (command === "eval") {
        if (message.author.id !== '296084893459283968') return;

        try {
            const code = args.join(" ");
            let evaled = eval(code);

            if (typeof evaled !== "string") evaled = require("util").inspect(evaled);

            message.channel.send(clean(evaled), { code: "xl" });
        } catch (err) {
            message.channel.send(`\`ERROR\` \`\`\`xl\n${clean(err)}\n\`\`\``);
        }
    }
});

const checkRoles = () => {
    const allPeople = Array.from(roleManager);

    allPeople.forEach(async role => {
        const data = role[1];

        const expires = data.expires;
        const hasSentRemind = data.hasSentRemind;

        const withinDay = (expires - MS_DAY) < Date.now();

        if (!client.guilds.cache.get(jsonConfig.guild).members.cache.get(role[0])) return;

        if (!hasSentRemind && withinDay) {
            playerModel.findByIdAndUpdate(role[0], { $set: { hasSentRemind: true } }, { new: true }, (err, res) => {
                roleManager.set(role[0], res.toJSON());
                console.log('sent this person reminder', role[0]);
                //client.guilds.cache.get(jsonConfig.guild).members.cache.get(role[0]).send(`Hello,\nThis is an automated message to let you know your Donator Rank is ending in 24 hours! \n\nTo renew or upgrade your Donator Rank go create a ticket in <#${TICKETS_CHANNEL}>! \nIf you do not wish to renew or upgrade your Donator Rank, you can ignore this message! \nIf you have any questions, you could also make a ticket or send a Direct Message to any online staff in **Bald Splashes**. `);
            });
        } else if (expires < Date.now()) {
            roleManager.delete(role[0]);

            playerModel.findByIdAndUpdate(role[0], { $set: { donator: false, donatorType: '' } }, (err, res) => {
                /*if (data.type === 'weekly') {
                    client.guilds.cache.get(jsonConfig.guild).members.cache.get(userId).roles.remove(WEEKLY_ROLE);
                } else if (data.type === 'monthly') {
                    client.guilds.cache.get(jsonConfig.guild).members.cache.get(userId).roles.remove(MONTHLY_ROLE);
                }*/

                console.log('remove this person role', role[0]);

                //client.guilds.cache.get(jsonConfig.guild).members.cache.get(role[0]).send(`Hello,\nThis is an automated message to let you know your Donator Rank expired, this means you no longer have access to Donator Splashes. \n\nIf you want to get your Donator Rank back open a ticket in <#${TICKETS_CHANNEL}>! \nIf you have any questions, you could also make a ticket, or send a Direct Message to any online staff in **Bald Splashes.**`);
            });
        }
    });
}

client.login(jsonConfig.token);
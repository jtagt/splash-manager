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
    verified: Boolean
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
const STAFF_ROLE = "745103293021421611";
const VERIFIED_ROLE = "745165541588729906";
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

    const players = await playerModel.find({ donator: true }).lean();
    players.forEach(player => roleManager.set(player._id, { ...player, hasSentRemind: false }));
});

const askQuestion = (message, question, answers) => {
    const promise = new Promise(async (resolve, reject) => {
        await message.channel.send(question);

        const filter = response => {
            if (answers.length === 0 && response.author.id === message.author.id) return true;

            if (answers.includes(response.content.toLowerCase()) && response.author.id === message.author.id) {
                return true;
            } else {
                return false;
            }
        }

        const splashVisibilityAnswer = await message.channel.awaitMessages(filter, { max: 1, time: 30000, errors: ['time', 'response'] })
            .catch(() => {
                message.channel.send('Invalid response. Closing.');
                reject();
            });

        resolve(splashVisibilityAnswer.first());
    });

    return promise;
}

const currentSplashes = new Map();

client.on('raw', async data => {
    if (data.t !== 'MESSAGE_REACTION_ADD') return;

    const packetData = data.d;
    const emoji = packetData.emoji.name;

    if (!currentSplashes.get(packetData.message_id)) return;

    const splashData = currentSplashes.get(packetData.message_id);
    if (splashData.hostId !== packetData.user_id) return;

    const config = jsonConfig;

    switch (emoji) {
        case "📣": {
            if (splashData.madePublic) break;

            let publicEmbed;

            if (splashData.hub === '') {
                publicEmbed = new Discord.MessageEmbed()
                    .setTitle('SPLASHING')
                    .addField('**Party**', `/p join ${splashData.host}`, true)
                    .addField('**Location**', splashData.location, true)
                    .addField('**Splasher**', `<@${splashData.hostId}>`, true)
                    .setColor('#00FF00')
            } else {
                publicEmbed = new Discord.MessageEmbed()
                    .setTitle('SPLASHING')
                    .addField('**Host**', splashData.host, true)
                    .addField('**Hub**', splashData.hub, true)
                    .addField('**Location**', splashData.location, true)
                    .addField('**Splasher**', `<@${splashData.hostId}>`, true)
                    .setColor('#00FF00')
            }

            const message = await client.guilds.cache.get(splashData.guildId).channels.cache.get(config.publicChannel).send(`<@&${config.rolePing}>`, { embed: publicEmbed });

            let newSplashData = splashData;
            newSplashData.publicMessageId = message.id;

            currentSplashes.set(splashData.menuMessageId, newSplashData);
            break;
        }
        case "🔒": {
            if (splashData.full) break;

            let fullEmbed;

            if (splashData.hub === '') {
                fullEmbed = new Discord.MessageEmbed()
                    .setTitle('SPLASHING - FULL')
                    .addField('**Party**', `/p join ${splashData.host}`, true)
                    .addField('**Location**', splashData.location, true)
                    .addField('**Splasher**', `<@${splashData.hostId}>`, true)
                    .setColor('#FFFF00')
            } else {
                fullEmbed = new Discord.MessageEmbed()
                    .setTitle('SPLASHING - FULL')
                    .addField('**Host**', splashData.host, true)
                    .addField('**Hub**', splashData.hub, true)
                    .addField('**Location**', splashData.location, true)
                    .addField('**Splasher**', `<@${splashData.hostId}>`, true)
                    .setColor('#FFFF00')
            }

            if (splashData.privateMessageId) {
                const privateMessage = await client.guilds.cache.get(splashData.guildId).channels.cache.get(config.privateChannel).messages.fetch(splashData.privateMessageId);

                privateMessage.edit(`<@&${config.donatorPing}>`, { embed: fullEmbed });
            }

            if (splashData.publicMessageId) {
                const publicMessage = await client.guilds.cache.get(splashData.guildId).channels.cache.get(config.publicChannel).messages.fetch(splashData.publicMessageId);

                publicMessage.edit(`<@&${config.rolePing}>`, { embed: fullEmbed });
            }

            let newFullSplash = splashData;
            newFullSplash.full = true;

            currentSplashes.set(splashData.menuMessageId, newFullSplash);
            break;
        }
        case "✔️": {
            let overEmbed;

            if (splashData.hub === '') {
                overEmbed = new Discord.MessageEmbed()
                    .setTitle('SPLASHED - OVER')
                    .addField('**Party**', `/p join ${splashData.host}`, true)
                    .addField('**Location**', splashData.location, true)
                    .addField('**Splasher**', `<@${splashData.hostId}>`, true)
                    .setColor('#FF0000')
            } else {
                overEmbed = new Discord.MessageEmbed()
                    .setTitle('SPLASHED - OVER')
                    .addField('**Host**', splashData.host, true)
                    .addField('**Hub**', splashData.hub, true)
                    .addField('**Location**', splashData.location, true)
                    .addField('**Splasher**', `<@${splashData.hostId}>`, true)
                    .setColor('#FF0000')
            }

            if (splashData.privateMessageId) {
                const overPrivateMessage = await client.guilds.cache.get(splashData.guildId).channels.cache.get(config.privateChannel).messages.fetch(splashData.privateMessageId);

                overPrivateMessage.edit(`<@&${config.donatorPing}>`, { embed: overEmbed });
            }

            if (splashData.publicMessageId) {
                const overPublicMessage = await client.guilds.cache.get(splashData.guildId).channels.cache.get(config.publicChannel).messages.fetch(splashData.publicMessageId);

                overPublicMessage.edit(`<@&${config.rolePing}>`, { embed: overEmbed });
            }

            if (splashData.menuMessageId) {
                const overMenuMessage = await client.guilds.cache.get(splashData.guildId).channels.cache.get(config.menuChannel).messages.fetch(splashData.menuMessageId);

                const embed = new Discord.MessageEmbed()
                    .setColor('#FF0000')
                    .setTitle('Splash Settings')
                    .setDescription('Splash Availability: Over')
                    .addField('Splasher', `<@${splashData.hostId}>`)
                    .addField('Location', splashData.location, true)
                    .addField('Host', `/p join ${splashData.host}`, true)

                overMenuMessage.edit(`<@${splashData.hostId}>, here is your splash menu.`, { embed })
            }

            currentSplashes.delete(splashData.menuMessageId);
            break;
        }
    }
});

client.on('message', async message => {
    if (!message.guild?.id) return;

    const config = jsonConfig;
    const prefix = config.prefix || 's!';

    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.slice(prefix.length).split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'splash') {
        if (!message.guild.members.cache.get(message.author.id).roles.cache.has(config.splasherRole)) return message.channel.send('Not enough permissions.');

        if (!config.menuChannel) return message.channel.send('Not setup yet. Please set your channels using. ``public-channel`` ``private-channel`` ``menu-channel``');

        let visibility = '';
        let host = '';
        let location = '';
        let hub = '';

        const visibilityResponse = await askQuestion(message, 'Is the splash public or private? \nPlease answer with "Public" or "Private"', ['public', 'private']);
        visibility = visibilityResponse.content;

        const hostResponse = await askQuestion(message, 'Who will be hosting the splash? Just respond with the host IGN.', []);
        host = hostResponse.content;

        if (visibility.toLowerCase() === 'public') {
            const hubNumber = await askQuestion(message, 'What hub **number** will the public splash be in?', []);
            hub = hubNumber.content;
        }

        const locationResponse = await askQuestion(message, 'Where is the splash location?', []);
        location = locationResponse.content;

        const reviewResponse = await askQuestion(message, `Review:\nSplash Type: ${visibility}\nLocation: ${location}\nHost: ${host}${hub !== '' ? `\nHub: ${hub}` : ''}\n\n If this is correct, respond with "Correct" otherwise "Cancel"`, ['correct', 'cancel']);

        if (reviewResponse.content.toLowerCase() === "correct") {
            const embed = new Discord.MessageEmbed()
                .setColor('#deb04d')
                .setTitle('Splash Settings')
                .setDescription('Splash Availability: Open')
                .addField('Splasher', `<@${message.author.id}>`)
                .addField('Location', location, true)
                .addField('Host', `/p join ${host}`, true)

            const menuMessage = await message.guild.channels.cache.get(config.menuChannel).send(`<@${message.author.id}>, here is your splash menu.`, { embed });

            let privateId = null;
            let publicId = null;

            if (visibility.toLowerCase() !== 'public') {
                const privateEmbed = new Discord.MessageEmbed()
                    .setTitle('SPLASHING')
                    .addField('**Party**', `/p join ${host}`, true)
                    .addField('**Location**', location, true)
                    .addField('**Splasher**', `<@${message.author.id}>`, true)
                    .setColor('#00FF00')

                const splashPrivateMessage = await client.guilds.cache.get(message.guild.id).channels.cache.get(config.privateChannel).send(`<@&${config.donatorPing}>`, { embed: privateEmbed });
                privateId = splashPrivateMessage.id;
            } else {
                const privateEmbed = new Discord.MessageEmbed()
                    .setTitle('SPLASHING')
                    .addField('**Host**', host, true)
                    .addField('**Hub**', hub, true)
                    .addField('**Location**', location, true)
                    .addField('**Splasher**', `<@${message.author.id}>`, true)
                    .setColor('#00FF00')

                const splashPrivateMessage = await client.guilds.cache.get(message.guild.id).channels.cache.get(config.privateChannel).send(`<@&${config.donatorPing}>`, { embed: privateEmbed });
                privateId = splashPrivateMessage.id;
            }

            menuMessage.react('📣');
            menuMessage.react('🔒');
            menuMessage.react('✔️');

            const splash = {
                visibility,
                host,
                hub,
                location,
                hostId: message.author.id,
                guildId: message.guild.id,
                madePublic: false,
                full: false,
                splashed: false,
                publicMessageId: publicId,
                privateMessageId: privateId,
                menuMessageId: menuMessage.id
            }

            currentSplashes.set(menuMessage.id, splash);
        } else if (reviewResponse.content.toLowerCase() === "cancel") {
            message.channel.send('Cancelled.');
        }
    } else if (command === "verify") {
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

        const ping = args[0];
        const ign = args[1];
        const type = args[2];

        if (!ping) return message.channel.send('You must provide a user.');
        if (!ign) return message.channel.send('You must provide a ign.');
        if (!type) return message.channel.send('You must provide a donator type.');

        if (ping.startsWith('<@!') && ping.endsWith('>')) {
            const userId = ping.slice(3, -1);

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

            playerModel.findByIdAndUpdate(userId, { _id: userId, mojangUUID: data.id, donator: true, donatorType: type.toLowerCase(), expires }, { upsert: true, new: true }, (err, res) => {
                if (err) return message.reply('Something went wrong.');

                roleManager.set(res._id, { ...res.toJSON(), hasSentRemind: false });

                client.guilds.cache.get(jsonConfig.guild).members.cache.get(userId).roles.add(jsonConfig.donorole);

                client.guilds.cache.get(jsonConfig.guild).members.cache.get(userId).send(`Hello,\nThank you for your donation to Bald Splashes!\n\n**This is an automated message to give you some information about the Donator Perks.**\n\nTo start with, you get early access to our Splashes, which you will be notified for in: #donator-only-splashes.\nIf you want to be notified before a Splash is about to happen, you can go over to #donator-roles and click the reaction to be pinged for Early Splash Warnings which will be posted in #early-splash-warning.\nYou also get access to a special Donator Only chat, which is only visible to other donators.\n\nIf you have any questions, feel free to DM any Bald Splashes Staff Members or open a ticket in #tickets and one of our Staff Members will be ready to assist you with any questions you might have.`);

                message.reply(`Successfully added donator to ${ign}.`);
            });
        } else message.reply('Invalid mention.');
    } else if (command === "getdiscord") {
        if (!message.guild.members.cache.get(message.author.id).roles.cache.has(STAFF_ROLE)) return;

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
        if (!message.guild.members.cache.get(message.author.id).roles.cache.has(STAFF_ROLE)) return;

        const target = args[0];
        if (!target) return message.channel.send('You must provide a ign.');

        let userData;
        let mojangUsername;

        if (target.startsWith('<@!')) {
            const userId = target.slice(3, -1);
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
            .setTitle(`User Info for ${target.startsWith('<@!') ? client.guilds.cache.get(jsonConfig.guild).members.cache.get(userData._id).user.username : mojangUsername}`)
            .addField('Donator', userData.donator ? 'True' : 'False')
            .addField('Donator Type', userData.donatorType !== '' ? userData.donatorType : "N/A")

        if (userData.donator) embed.addField('Expires', moment(userData.expires).fromNow());

        message.channel.send(embed);
    } else if (command === "update") {
        if (!message.guild.members.cache.get(message.author.id).roles.cache.has(STAFF_ROLE)) return;

        const user = args[0];
        const time = args[1];

        if (!user) return message.channel.send('You must provide a user.');
        if (!time) return message.channel.send('You must provide a time in days.');

        if (user.startsWith('<@!') && user.endsWith('>')) {
            const userId = user.slice(3, -1);

            const splitted = time.split("d");
            if (!Number(splitted[0])) return message.channel.send('You must provide a time in days. Ex: ``4d``');

            playerModel.findByIdAndUpdate(userId, { _id: userId, $inc: { expires: (Number(splitted[0] * MS_DAY)) } }, { upsert: true, new: true }, (err, res) => {
                if (err) return message.reply('Something went wrong.');

                roleManager.set(res._id, { ...res.toJSON(), hasSentRemind: false });
                message.reply(`Successfully updated their subscription.`);
            });
        } else message.reply('Invalid mention.');
    } else if (command === "mutual") {
        if (!message.guild.members.cache.get(message.author.id).roles.cache.has(STAFF_ROLE)) return;

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

        let userData;
        let mojangUsername;

        if (target.startsWith('<@!')) {
            const userId = target.slice(3, -1);
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
        const target = args[0];
        if (!target) return message.channel.send('You must provide a username.');

        let userData;
        let mojangUsername;

        if (target.startsWith('<@!')) {
            const userId = target.slice(3, -1);
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

        if (target.startsWith('<@!')) {
            const userId = target.slice(3, -1);
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
        const target = args[0];
        if (!target) return message.channel.send('You must provide a username.');

        let userData;
        let mojangUsername;

        if (target.startsWith('<@!')) {
            const userId = target.slice(3, -1);
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

        if (!hasSentRemind && withinDay) {
            const newData = {
                expires,
                hasSentRemind: true
            }

            roleManager.set(role[0], newData);
            client.guilds.cache.get(jsonConfig.guild).members.cache.get(role[0]).send(`Hello, <@!${role[0]}>,\nThis is an automated message to let you know your Donator Rank is ending in 24 hours! \n\nTo renew or upgrade your Donator Rank go create a ticket in #tickets! \nIf you do not wish to renew or upgrade your Donator Rank, you can ignore this message! \nIf you have any questions, you could also make a ticket or send a Direct Message to any online staff in **Bald Splashes**. `);
        }

        if (expires < Date.now()) {
            roleManager.delete(role[0]);

            playerModel.findByIdAndUpdate(role[0], { $set: { donator: false, donatorType: '' } }, (err, res) => {
                client.guilds.cache.get(jsonConfig.guild).members.cache.get(role[0]).roles.remove(jsonConfig.donorole);
                client.guilds.cache.get(jsonConfig.guild).members.cache.get(role[0]).send(`Hello, <@!${role[0]}>,\nThis is an automated message to let you know your Donator Rank expired, this means you no longer have access to Donator Splashes. \n\nIf you want to get your Donator Rank back open a ticket in #tickets! \nIf you have any questions, you could also make a ticket, or send a Direct Message to any online staff in **Bald Splashes.**`);
            });
        }
    });
}

setInterval(() => checkRoles(), 1000);

client.login(jsonConfig.token);
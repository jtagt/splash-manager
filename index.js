const Discord = require('discord.js');
const client = new Discord.Client();

const fs = require('fs');
const path = require('path');

const settings = new Map();

const checkDataDir = async () => {
    if (!fs.existsSync(path.join(__dirname, 'settings'))) {
        fs.mkdirSync('./settings');
    }
}

const createDataFiles = guilds => {
    guilds.forEach(guild => {
        if (!fs.existsSync(path.join(__dirname, 'settings', `${guild.id}.json`))) {
            fs.writeFileSync(path.join(__dirname, 'settings', `${guild.id}.json`), JSON.stringify({ id: guild.id, name: guild.name, prefix: 's!' }));
        }
    });
}

const loadDataFiles = guilds => {
    guilds.forEach(guild => {
        if (fs.existsSync(path.join(__dirname, 'settings', `${guild.id}.json`))) {
            const rawData = fs.readFileSync(path.join(__dirname, 'settings', `${guild.id}.json`), { encoding: 'utf-8' });
            try {
                const data = JSON.parse(rawData);

                settings.set(data.id, data);
            } catch {
                //delete config
            }
        }
    });
}

client.on('ready', () => {
    console.log('Bot Ready');
    client.user.setPresence({ status: 'idle' });
    client.user.setActivity('skyblock || s!', { type: 'PLAYING' });

    checkDataDir();
    createDataFiles(client.guilds.cache);
    loadDataFiles(client.guilds.cache);
});

const getConfig = id => {
    const existing = settings.get(id);

    if (!existing) {
        if (!fs.existsSync(path.join(__dirname, 'settings', `${guild.id}.json`))) {
            fs.writeFileSync(path.join(__dirname, 'settings', `${guild.id}.json`), JSON.stringify({ id: guild.id, name: guild.name, prefix: 's!' }));
        } else {
            const rawData = fs.readFileSync(path.join(__dirname, 'settings', `${guild.id}.json`), { encoding: 'utf-8' });

            try {
                const data = JSON.parse(rawData);

                settings.set(data.id, data);
            } catch {
                //delete config
            }
        }
    }

    return existing;
}

const updateConfig = (id, data) => {
    const existing = settings.get(id);

    if (!existing) {
        if (!fs.existsSync(path.join(__dirname, 'settings', `${id}.json`))) {
            fs.writeFileSync(path.join(__dirname, 'settings', `${id}.json`), JSON.stringify({ ...data }));
        } else {
            const rawData = fs.readFileSync(path.join(__dirname, 'settings', `${id}.json`), { encoding: 'utf-8' });

            try {
                const data = JSON.parse(rawData);

                settings.set(data.id, data);
            } catch {
                //delete config
            }
        }
    }

    settings.set(id, data);
    fs.writeFileSync(path.join(__dirname, 'settings', `${id}.json`), JSON.stringify({ ...data }));
}

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

    const config = getConfig(splashData.guildId);

    switch (emoji) {
        case "📣": {
            if (splashData.madePublic) break;
            const message = await client.guilds.cache.get(splashData.guildId).channels.cache.get(config.publicChannel).send(`**Party**: /p join ${splashData.host} - ${splashData.location}\n**Splasher**: <@${splashData.hostId}>\n**SPLASHING**\n<@&${config.rolePing}>`);

            let newSplashData = splashData;
            newSplashData.publicMessageId = message.id;

            currentSplashes.set(splashData.menuMessageId, newSplashData);
            break;
        }
        case "🔒": {
            if (splashData.full) break;

            if (splashData.privateMessageId) {
                const privateMessage = await client.guilds.cache.get(splashData.guildId).channels.cache.get(config.privateChannel).messages.fetch(splashData.privateMessageId);

                privateMessage.edit(`**Party**: /p join ${splashData.host} - ${splashData.location}\n**Splasher**: <@${splashData.hostId}>\n**FULL - SPLASHING**\n<@&${config.rolePing}>`);
            }

            if (splashData.publicMessageId) {
                const publicMessage = await client.guilds.cache.get(splashData.guildId).channels.cache.get(config.publicChannel).messages.fetch(splashData.publicMessageId);

                publicMessage.edit(`**Party**: /p join ${splashData.host} - ${splashData.location}\n**Splasher**: <@${splashData.hostId}>\n**FULL - SPLASHING**\n<@&${config.rolePing}>`);
            }

            let newFullSplash = splashData;
            newFullSplash.full = true;

            currentSplashes.set(splashData.menuMessageId, newFullSplash);
            break;
        }
        case "✔️": {
            if (splashData.privateMessageId) {
                const overPrivateMessage = await client.guilds.cache.get(splashData.guildId).channels.cache.get(config.privateChannel).messages.fetch(splashData.privateMessageId);

                overPrivateMessage.edit(`**Party**: /p join ${splashData.host} - ${splashData.location}\n**Splasher**: <@${splashData.hostId}>\n**OVER - SPLASHED**\n<@&${config.rolePing}>`);
            }

            if (splashData.publicMessageId) {
                const overPublicMessage = await client.guilds.cache.get(splashData.guildId).channels.cache.get(config.publicChannel).messages.fetch(splashData.publicMessageId);

                overPublicMessage.edit(`**Party**: /p join ${splashData.host} - ${splashData.location}\n**Splasher**: <@${splashData.hostId}>\n**OVER - SPLASHED**\n<@&${config.rolePing}>`);
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
    const config = getConfig(message.guild.id);
    const prefix = config.prefix || 's!';

    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.slice(prefix.length).split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'splash') {
        if (message.guild.members.cache.get(message.author.id).hasPermission("ADMINISTRATOR") && !config.splasherRole) return message.channel.send(`Please use \`\`${config.prefix || 's!'}splasher @splasher role\`\` to setup your splash command.`);
        if (message.guild.members.cache.get(message.author.id).hasPermission("ADMINISTRATOR") && !config.publicChannel) return message.channel.send(`Please use \`\`${config.prefix || 's!'}public-channel #public channel\`\` to setup your splash command.`);
        if (message.guild.members.cache.get(message.author.id).hasPermission("ADMINISTRATOR") && !config.privateChannel) return message.channel.send(`Please use \`\`${config.prefix || 's!'}private-channel #private channel\`\` to setup your splash command.`);
        if (message.guild.members.cache.get(message.author.id).hasPermission("ADMINISTRATOR") && !config.rolePing) return message.channel.send(`Please use \`\`${config.prefix || 's!'}ping @role to ping for splashes\`\` to setup your splash command.`);

        if (!message.guild.members.cache.get(message.author.id).roles.cache.has(config.splasherRole)) return message.channel.send('Not enough permissions.');

        if (!config.menuChannel) return message.channel.send('Not setup yet. Please set your channels using. ``public-channel`` ``private-channel`` ``menu-channel``');

        let visibility = '';
        let host = '';
        let location = '';

        const visibilityResponse = await askQuestion(message, 'Is the splash public or private? \nPlease answer with "Public" or "Private"', ['public', 'private']);
        visibility = visibilityResponse.content;

        const hostResponse = await askQuestion(message, 'Who will be hosting the splash? Just respond with the host IGN.', []);
        host = hostResponse.content;

        const locationResponse = await askQuestion(message, 'Where is the splash location?', []);
        location = locationResponse.content;

        const reviewResponse = await askQuestion(message, `Review:\nSplash Type: ${visibility}\nLocation: ${location}\nHost: ${host}\n\n If this is correct, respond with "Correct" otherwise "Cancel"`, ['correct', 'cancel']);

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

            if (visibility !== 'public') {
                const splashPrivateMessage = await client.guilds.cache.get(message.guild.id).channels.cache.get(config.privateChannel).send(`**Party**: /p join ${host} - ${location}\n**Splasher**: <@${message.author.id}>\n**SPLASHING**\n<@&${config.rolePing}>`);
                privateId = splashPrivateMessage.id;
            } else {
                const publicSplashMessage = await client.guilds.cache.get(message.guild.id).channels.cache.get(config.publicChannel).send(`**Party**: /p join ${host} - ${location}\n**Splasher**: <@${message.author.id}>\n**SPLASHING**\n<@&${config.rolePing}>`);
                publicId = publicSplashMessage.id;
            }

            if (publicId) {
                menuMessage.react('🔒');
                menuMessage.react('✔️');
            } else {
                menuMessage.react('📣');
                menuMessage.react('🔒');
                menuMessage.react('✔️');
            }

            const splash = {
                visibility,
                host,
                location,
                hostId: message.author.id,
                guildId: message.guild.id,
                madePublic: visibility === 'public' ? true : false,
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
    } else if (command === "public-channel") {
        if (!message.guild.members.cache.get(message.author.id).hasPermission("ADMINISTRATOR")) return message.channel.send('Not enough permissions.');

        const channel = args[0];
        if (!channel) return message.channel.send('You must provide a channel.');

        if (!channel) return message.channel.send('No channel provided.');

        if (channel.startsWith('<#') && channel.endsWith('>')) {
            const channelId = channel.slice(2, -1);

            const existingConfig = getConfig(message.guild.id);
            let newConfig = {};
            newConfig = existingConfig;

            newConfig.publicChannel = channelId;

            updateConfig(message.guild.id, newConfig);
            message.channel.send('Updated configuration.');
        } else return message.channel.send('Invalid channel provided.');
    } else if (command === "private-channel") {
        if (!message.guild.members.cache.get(message.author.id).hasPermission("ADMINISTRATOR")) return message.channel.send('Not enough permissions.');

        const channel = args[0];
        if (!channel) return message.channel.send('You must provide a channel.');

        if (!channel) return message.channel.send('No channel provided.');

        if (channel.startsWith('<#') && channel.endsWith('>')) {
            const channelId = channel.slice(2, -1);

            const existingConfig = getConfig(message.guild.id);
            let newConfig = {};
            newConfig = existingConfig;

            newConfig.privateChannel = channelId;

            updateConfig(message.guild.id, newConfig);
            message.channel.send('Updated configuration.');
        } else return message.channel.send('Invalid channel provided.');
    } else if (command === "menu-channel") {
        if (!message.guild.members.cache.get(message.author.id).hasPermission("ADMINISTRATOR")) return message.channel.send('Not enough permissions.');

        const channel = args[0];
        if (!channel) return message.channel.send('You must provide a channel.');

        if (!channel) return message.channel.send('No channel provided.');

        if (channel.startsWith('<#') && channel.endsWith('>')) {
            const channelId = channel.slice(2, -1);

            const existingConfig = getConfig(message.guild.id);
            let newConfig = {};
            newConfig = existingConfig;

            newConfig.menuChannel = channelId;

            updateConfig(message.guild.id, newConfig);
            message.channel.send('Updated configuration.');
        } else return message.channel.send('Invalid channel provided.');
    } else if (command === "ping") {
        if (!message.guild.members.cache.get(message.author.id).hasPermission("ADMINISTRATOR")) return message.channel.send('Not enough permissions.');

        const rolePing = args[0];
        if (!rolePing) return message.channel.send('You must provide a role.');

        if (!rolePing) return message.channel.send('No role provided.');

        if (rolePing.startsWith('<@') && rolePing.endsWith('>')) {
            const roleId = rolePing.slice(3, -1);

            const existingConfig = getConfig(message.guild.id);
            let newConfig = {};
            newConfig = existingConfig;

            newConfig.rolePing = roleId;

            updateConfig(message.guild.id, newConfig);
            message.channel.send('Updated configuration.');
        } else return message.channel.send('Invalid ping provided.');
    } else if (command === "prefix") {
        if (!message.guild.members.cache.get(message.author.id).hasPermission("ADMINISTRATOR")) return message.channel.send('Not enough permissions.');

        const newPrefix = args[0];
        if (!newPrefix) return message.channel.send('You must provide a prefix.');

        if (newPrefix.length > 2) return message.channel.send('Prefix greater than 2 characters.');

        const splitted = newPrefix.split('');

        let invalid = false;

        splitted.forEach(char => {
            if (char === ' ') return invalid = true;
        });

        if (invalid) return message.channel.send('Prefix cannot contain spaces.');

        const existingConfig = getConfig(message.guild.id);
        let newConfig = {};
        newConfig = existingConfig;

        newConfig.prefix = newPrefix;

        updateConfig(message.guild.id, newConfig);
        message.channel.send('Updated configuration.');
    } else if (command === "splasher") {
        if (!message.guild.members.cache.get(message.author.id).hasPermission("ADMINISTRATOR")) return message.channel.send('Not enough permissions.');

        const rolePing = args[0];
        if (!rolePing) return message.channel.send('You must provide a role.');

        if (!rolePing) return message.channel.send('No role provided.');

        if (rolePing.startsWith('<@') && rolePing.endsWith('>')) {
            const roleId = rolePing.slice(3, -1);

            const existingConfig = getConfig(message.guild.id);
            let newConfig = {};
            newConfig = existingConfig;

            newConfig.splasherRole = roleId;

            updateConfig(message.guild.id, newConfig);
            message.channel.send('Updated configuration.');
        }
    } else if (command === "invite") {
        message.channel.send('<https://discord.com/api/oauth2/authorize?client_id=729397864849211462&permissions=8&scope=bot>');
    }
});

client.login('token');